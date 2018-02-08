import { Outlet, OutletSubject, Subscription, TransactionalObservable, TransactionalObserver } from 'outlets'
import { isPlainObject } from './isPlainObject'
import { Component, getDisplayName } from './Component'
import { doNodesReconcile } from './doNodesReconcile'
import { isValidElement } from './Element'
import { Governable, GovernableClass } from './Governable'
import { createGovernor, Governor } from './Governor'

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Subs=any> {
    componentDidInstantiate?();

    // TODO: rename to UNSAFE_componentWillReceiveProps.
    componentWillReceiveProps?(nextProps: Props);

    // TODO: move these to static method
    getDerivedStateFromProps?(nextProps: Props, prevState: State): Partial<State>;

    // TODO: rename to "connect"
    subscribe?(): any;

    // TODO: rename to "shouldComponentPublish"
    shouldComponentUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);

    // TODO: rename to "publish"
    getValue(): Value;
    
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    componentWillBeDisposed?();
}

export class ComponentImplementation<Props, State, Value, Subs> {
    // Has `setProps` or the constructor been called, but a corresponding
    // `flush` not yet been called?
    awaitingFlush: boolean = true

    // Keep track of whether side effects are allowed to help keep
    // components responsible.
    //
    // general side effects (setstate, setprops, dispose, child changes, starting a transaction) are not allowed:
    //
    // - after disposing
    // - during getDerivedStateFromProps
    // - during setstate updaters
    // - while running connect (with the exception of expected keys from children)
    // - during shouldComponentPublish
    // - during `publish`
    // - while publishing via "transactionStart"
    // - while publishing via "next"
    disallowSideEffectsReason: (string | null)[] = []

    props: Props;
    state: State;
    subs: Subs;

    // What the associated Component instance sees.
    fixed: { props: Props, state: State, subs: Subs }[] = [];

    // Keep the previously published values around for shouldComponentPublish
    previousPublish: { props: Props, state: State, subs: Subs };

    // Arbitrary functions to be run after componentDidUpdate
    callbacks: Function[] = []
    
    children: {
        [key: string]: {
            node: any,
            subscription: Subscription,

            // A governor will not exist in the case of a `subscribe` element.
            governor?: Governor<any, any>
        }
    } = {}

    // These are stored separately to children, as they may contain a symbol,
    // which doesn't appear in the result of Object.keys()
    childrenKeys: any[] = []

    // If we're running `connect`, we can defer handling of new child values
    // to the end of the connect.
    expectingChildChangeFor?: string

    shouldEndTransactionOnFlush: boolean = false

    governor?: Governor<Props, Value>

    // Keep track of whether we need to call componentDidInstantiate on the
    // next flush.
    hasCalledComponentDidInstantiate: boolean = false

    // Keep track of whether a specific transaction caused a publish, as we'll
    // running our own componentDidUpdate if it didn't.
    hasPublishedSinceLastUpdate: boolean = false

    willDispose: boolean = false

    // Keep track of whether we're in a componentWillReceiveProps lifecycle
    // method, so that we don't double connect/double publish.
    isReceivingProps: boolean = false

    // Keep track of whether the user is running "connectChild", so we can
    // prevent them from accessing the existing child.
    isRunningConnectChild: boolean = false
    
    // If true, side effects when disallowed will cause an exception.
    isStrict: boolean

    // If our last child was an array or object of further elements, store the
    // type.
    lastCombinedType?: 'array' | 'object'

    lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>

    // A queue of side effects that must be run on children
    queue: { governor: Governor<any, any>, action: 'flush' | 'dispose' }[] = []

    // A pipe for events out of this object
    subject: OutletSubject<Value>

    // Keep track of what props, state and subs were at the start of a
    // transaction, so we can pass them through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, subs: Subs }

    transactionLevel: number = 0

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>, props: Props, isStrict = false) {
        this.disallowSideEffectsReason.unshift('in constructor')
        this.isStrict = isStrict
        this.lifecycle = lifecycle
        this.props = props
    }

    /**
     * Create a fixed set of props/state/subs that can be used
     * within one method of a component instance.
     */
    fix(wrappedFn: Function) {
        this.pushFix()
        wrappedFn()
        this.popFix()
    }
    getFix() {
        return this.fixed[0] || { props: this.props, state: this.state, subs: this.subs }
    }
    pushFix() {
        this.fixed.unshift({
            props: this.props,
            state: this.state,
            subs: this.subs,
        })
    }
    popFix() {
        this.fixed.shift()
    }

    dispose = () => {
        if (this.disallowSideEffectsReason[0] && this.transactionLevel !== 0) {
            if (this.isStrict) {
                throw new Error(`You cannot call "dispose" on a governor while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
            else {
                console.warn(`You should not call "dispose" on a governor while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
        }
        this.willDispose = true

        // If we're not in a transaction, bumping the level will run the end
        // transaction handler and trigger disposal.
        if (!this.transactionLevel) {
            this.increaseTransactionLevel()
            this.decreaseTransactionLevel()
        }
    }

    setProps = (props: Props): void => {
        if (this.disallowSideEffectsReason[0]) {
            if (this.isStrict) {
                throw new Error(`You cannot update governor's props while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
            else {
                console.warn(`You should not update governor's props while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
        }
        this.awaitingFlush = true
        if (this.lifecycle.componentWillReceiveProps) {
            this.pushFix()
            // TODO: add test that we don't start/stop a transaction if setState is called within here.
            this.isReceivingProps = true
            this.lifecycle.componentWillReceiveProps(props)
            this.isReceivingProps = false
            this.popFix()
        }
        this.props = props
        if (this.lifecycle.getDerivedStateFromProps) {
            this.disallowSideEffectsReason.unshift("running `getDerivedStateFromProps`")
            this.state = Object.assign({}, this.state, this.lifecycle.getDerivedStateFromProps(props, this.state))
        }
        this.disallowSideEffectsReason.shift()
        this.connect()
        this.publish()
    }

    setState(updater: (prevState: Readonly<State>, props: Props) => Partial<State>, callback?: Function) {
        if (this.disallowSideEffectsReason[0]) {
            if (this.isStrict) {
                throw new Error(`A Govern component cannot call "setState" outside while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
            else if (this.transactionLevel !== 0) {
                console.warn(`A Govern component should not call "setState" outside while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}"`)
            }
        }

        if (callback) {
            this.callbacks.push(callback)
        }

        let needTransaction = !this.awaitingFlush
        if(needTransaction) {
            // hack to deal with componentWillReceiveProps so that it doesn't
            // start a transaction just when calling `setProps` I wish it
            // would die.
            this.increaseTransactionLevel()
        }
        this.disallowSideEffectsReason.unshift("running a setState updater")
        this.state = Object.assign({}, this.state, updater(this.state, this.props))
        this.disallowSideEffectsReason.shift()
        if (!this.isReceivingProps) {
            this.connect()
            this.publish()
        }
        if (needTransaction) {
            this.decreaseTransactionLevel()
        }
    }

    connect() {
        if (this.lifecycle.subscribe) {
            this.disallowSideEffectsReason.unshift("running connect")
            this.isRunningConnectChild = true
            this.pushFix()
            let element = this.lifecycle.subscribe()
            this.popFix()
            this.isRunningConnectChild = false
            if (element === undefined) {
                console.warn(`The "${getDisplayName(this.lifecycle.constructor)}" component returned "undefined" from its subscribe method. If you really want to return an empty value, return "null" instead.`)
            }
            else if (this.lifecycle instanceof Component && element !== null && !isValidElement(element)) {
                throw new Error(`You must return an element from "subscribe", but instead received a "${typeof element}". See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }

            // If the child element has changed between array/object/plain
            // element, we want to destroy/recreate any chidlren on the same
            // key.
            let forceFullUpdate = false

            let nextChildrenKeys: string[]
            let nextChildNodes
            if (isValidElement(element) && element!.type === "combine") {
                if (Array.isArray(element.props.children)) {
                    // this will wipe out any changes from directly set stuff
                    if (this.lastCombinedType !== 'array') {
                        this.lastCombinedType = 'array'
                        this.subs = [] as any
                        forceFullUpdate = true
                    }
                    else {
                        this.subs = (this.subs as any).slice(0)
                    }
                        
                    nextChildNodes = element.props.children
                    nextChildrenKeys = Object.keys(element.props.children)
                }
                else if (isPlainObject(element.props.children)) {
                    if (this.lastCombinedType !== 'object') {
                        this.lastCombinedType = 'object'
                        this.subs = {} as any
                        forceFullUpdate = true
                    }
                    else {
                        this.subs = Object.assign({}, this.subs)
                    }
                    nextChildNodes = element.props.children
                    nextChildrenKeys = Object.keys(element.props.children)
                }
                else {
                    if (this.lastCombinedType) {
                        delete this.subs
                        delete this.lastCombinedType
                        forceFullUpdate = true
                    }
                    nextChildNodes = { [Root]: element.props.children }
                    nextChildrenKeys = [Root]
                }
            }
            else {
                if (this.lastCombinedType) {
                    delete this.subs
                    delete this.lastCombinedType
                    forceFullUpdate = true
                }
                nextChildNodes = { [Root]: element }
                nextChildrenKeys = [Root]
            }

            let childrenToDisposeKeys = new Set(this.childrenKeys)
            let subsKeysToRemove = new Set(this.lastCombinedType ? Object.keys(this.subs) : [])
            let nextChildren = {}
            for (let i = 0; i < nextChildrenKeys.length; i++) {
                let key = nextChildrenKeys[i]
                let prevChild = this.children[key]
                let nextChildNode = nextChildNodes[key]
                nextChildren[key] = this.children[key]
                subsKeysToRemove.delete(key)
                if (isValidElement(nextChildNode)) {
                    if (forceFullUpdate || !doNodesReconcile(prevChild && prevChild.node, nextChildNode)) {
                        let governor: Governor<any, any> | undefined
                        let observable: TransactionalObservable<any>
                        if (nextChildNode.type === 'subscribe') {
                            observable = nextChildNode.props.to
                        }
                        else {
                            governor = createGovernor(
                                nextChildNode,
                                false /* don't autoflush */
                            )
                            this.addToQueue({
                                governor: governor,
                                action: 'flush',
                            })
                            observable = governor
                        }

                        // Outlets will immediately emit their current value
                        // on subscription, ensuring that `subs` is updated.
                        this.expectingChildChangeFor = key
                        if (typeof observable.subscribe !== 'function') {
                            debugger
                        }
                        let subscription = observable.subscribe(
                            value => this.handleChildChange(key, value),
                            this.handleChildError,
                            this.handleChildComplete,
                            this.increaseTransactionLevel,
                            this.decreaseTransactionLevel,
                        )
                        delete this.expectingChildChangeFor

                        nextChildren[key] = {
                            node: nextChildNode,
                            subscription: subscription,
                            governor: governor,
                        }
                    }
                    else {
                        // Keep around the previous child, and update it if
                        // necessary
                        childrenToDisposeKeys.delete(key)
                        if (nextChildNode.type !== 'subscribe') {
                            this.expectingChildChangeFor = key
                            prevChild.governor!.setProps(nextChildNode.props)
                            delete this.expectingChildChangeFor
                            this.addToQueue({
                                governor: prevChild.governor!,
                                action: 'flush',
                            })
                        }
                    }
                }
                else {
                    delete nextChildren[key]
                    this.setSubs(key, nextChildNode)
                }
            }

            // Clean up after any previous children that are no longer being
            // subscribed.
            let childrenToDisposeArray = Array.from(childrenToDisposeKeys)
            for (let i = 0; i < childrenToDisposeArray.length; i++) {
                let key = childrenToDisposeArray[i]
                let prevChild = this.children[key]
                if (prevChild) {
                    prevChild.subscription.unsubscribe()
                    if (prevChild.governor) {
                        this.addToQueue({
                            governor: prevChild.governor,
                            action: 'dispose'
                        })
                    }
                }
                delete this.children[key]
            }

            let subsToRemoveArray = Array.from(subsKeysToRemove)
            for (let i = 0; i < subsToRemoveArray.length; i++) {
                delete this.subs[subsToRemoveArray[i]]
            }

            this.children = nextChildren
            this.childrenKeys = nextChildrenKeys

            this.disallowSideEffectsReason.shift()
        }
    }

    setSubs(key: string | Symbol, value: any) {
        if (key === Root) {
            this.subs = value
        }
        else {
            this.subs[key as any] = value
        }
    }

    handleChildChange(key: string, value) {
        let isExpectingChange = this.expectingChildChangeFor === key
        if ((!isExpectingChange && this.disallowSideEffectsReason[0]) || this.transactionLevel === 0) {
            if (this.isStrict) {
                throw new Error(`A Govern component cannot receive new values from children while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
            else if (this.transactionLevel !== 0) {
                console.warn(`A Govern component should not receive new values from children while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}"`)
            }
        }
 
        let needTransaction = !this.awaitingFlush && !isExpectingChange
        if (needTransaction) {
            this.increaseTransactionLevel()
        }
        if (!isExpectingChange) {
            if (this.lastCombinedType === 'array') {
                this.subs = (this.subs as any).slice(0)
            }
            else if (this.lastCombinedType === 'object') {
                this.subs = Object.assign({}, this.subs)
            }
        }
        this.setSubs(key, value)
        if (!isExpectingChange && !this.isReceivingProps) {
            this.publish()
        }
        if (needTransaction) {
            this.decreaseTransactionLevel()
        }
    }

    publish() {
        this.pushFix()
        this.disallowSideEffectsReason.unshift("running shouldComponentUpdate")
        let shouldComponentPublish =
            !this.previousPublish ||
            !this.lifecycle.shouldComponentUpdate ||
            this.lifecycle.shouldComponentUpdate(this.previousPublish.props, this.previousPublish.state, this.previousPublish.subs)
        this.disallowSideEffectsReason.shift()
        
        if (shouldComponentPublish) {
            this.disallowSideEffectsReason.unshift("publishing a value")
            this.subject.next(this.lifecycle.getValue())
            this.disallowSideEffectsReason.shift()
            this.previousPublish = {
                props: this.props,
                state: this.state,
                subs: this.subs,
            }
            this.hasPublishedSinceLastUpdate = true
        }
        this.popFix()
    }

    createGovernor(): Governor<Props, Value> {
        if (this.governor) {
            throw new Error('You cannot create multiple governors for a single Component')
        }

        this.disallowSideEffectsReason.shift()
        this.connect()
        this.pushFix()
        this.disallowSideEffectsReason.unshift("publishing a value")
        this.subject = new OutletSubject(this.lifecycle.getValue())
        this.disallowSideEffectsReason.shift()
        this.previousPublish = {
            props: this.props,
            state: this.state,
            subs: Object.assign({}, this.subs),
        }
        this.popFix()

        let outlet = new Outlet(this.subject)
        this.governor = Object.assign(outlet, {
            getOutlet: () => new Outlet(this.subject),
            setProps: this.setProps,
            flush: this.flush,
            dispose: this.dispose,
        })

        return this.governor
    }
    
    increaseTransactionLevel = () => {
        if (++this.transactionLevel === 1) {
            this.disallowSideEffectsReason.unshift("publishing transactionStart")
            this.subject.transactionStart()
            this.disallowSideEffectsReason.shift()
        }
    }

    /**
     * The flush phase is where we work through possible side effects; first
     * in children, and then in our own lifecycle methods.
     */
    flush = () => {
        this.awaitingFlush = false

        let nextItem: { governor: Governor<any, any>, action: 'flush' | 'dispose' } | undefined
        while (nextItem = this.queue.shift()) {
            if (nextItem.action === 'flush') {
                nextItem.governor.flush()
            }
            else {
                nextItem.governor.dispose()
            }
        }
        
        if (!this.hasCalledComponentDidInstantiate) {
            this.hasCalledComponentDidInstantiate = true
            if (this.lifecycle.componentDidInstantiate) {
                this.pushFix()
                this.lifecycle.componentDidInstantiate()
                this.popFix()
            }
        }
        else if (this.hasPublishedSinceLastUpdate && this.lifecycle.componentDidUpdate) {
            this.hasPublishedSinceLastUpdate = false
            this.pushFix()
            this.lifecycle.componentDidUpdate(
                this.lastUpdate.props,
                this.lastUpdate.state,
                this.lastUpdate.subs
            )
            this.popFix()
        }

        this.lastUpdate = {
            props: this.props,
            state: this.state,
            subs: this.subs,
        }

        while (this.callbacks.length) {
            let callback = this.callbacks.shift() as Function
            callback()
        }

        // Our lifecycle methods / callbacks may have caused more changes
        if (this.queue.length && !this.awaitingFlush) {
            this.flush()
        }

        if (this.shouldEndTransactionOnFlush) {
            this.shouldEndTransactionOnFlush = false
            this.decreaseTransactionLevel()
        }
    }
    
    decreaseTransactionLevel = () => {
        if (this.awaitingFlush) {
            // We can safely bail, a flush will be called by the parent in the
            // future, and a parent will never call `dispose` on a child until
            // it has flushed it.
            this.shouldEndTransactionOnFlush = true
            return
        }

        if (this.transactionLevel === 1) {
            if (this.willDispose) {
                this.flush()
                this.disallowSideEffectsReason.unshift('disposed')

                for (let i = 0; i < this.childrenKeys.length; i++) {
                    let key = this.childrenKeys[i]
                    let child = this.children[key]

                    if (child) {
                        child.subscription.unsubscribe()
                        if (child.governor) {
                            this.addToQueue({
                                governor: child.governor,
                                action: 'dispose',
                            })
                        }
                        delete this.children[key]
                    }
                }

                // Flush once more to run `componentWillBeDisposed` on children
                this.flush()

                if (this.lifecycle.componentWillBeDisposed) {
                    this.pushFix()
                    this.lifecycle.componentWillBeDisposed()
                    this.popFix()
                }

                this.subject.transactionEnd()
                this.subject.complete()
                this.state = {} as any
                this.subs = {} as any
                this.transactionLevel -= 1
            }
            else {
                // Lower the transaction level before emitting transactionEnd,
                // and flushing, so that any side effects of the flush will
                // be executed properly.
                // so that any side effects of transactionEnd start a new
                // transaction.
                this.transactionLevel -= 1
                this.flush()
                this.subject.transactionEnd()
            }
        }
        else {
            this.transactionLevel--
        }
    }

    handleChildError = (error) => {
        this.subject.error(error)
    }

    handleChildComplete() {
        // noop
    }

    /**
     * Add to the queue if the specified item isn't already there.
     */
    addToQueue(item: { governor: Governor<any, any>, action: 'flush' | 'dispose' }) {
        for (let i = 0; i < this.queue.length; i++) {
            let currentItem = this.queue[i]
            if (currentItem.governor === item.governor && currentItem.action === item.action) {
                return
            }
        }
        this.queue.push(item)
    }
}
