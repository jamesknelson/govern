import { Outlet, OutletSubject, Subscription, TransactionalObservable, TransactionalObserver } from 'outlets'
import { isPlainObject } from './utils/isPlainObject'
import { Component, getDisplayName } from './Component'
import { doNodesReconcile } from './doNodesReconcile'
import { isValidElement } from './Element'
import { Governable, GovernableClass } from './Governable'
import { internalCreateGovernor, InternalGovernor } from './Governor'

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Subs=any> {
    componentDidInstantiate?();

    // TODO: rename to UNSAFE_componentWillReceiveProps.
    componentWillReceiveProps?(nextProps: Props);

    constructor: Function & {
        getDerivedStateFromProps?(nextProps: Props, prevState: State): Partial<State>;
    }

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
            governor?: InternalGovernor<any, any>
        }
    } = {}

    // These are stored separately to children, as they may contain a symbol,
    // which doesn't appear in the result of Object.keys()
    childrenKeys: any[] = []

    // If we're running `connect`, we can defer handling of new child values
    // to the end of the connect.
    expectingChildChangeFor?: string

    // If we know there is a flush coming up, then let's wait for the flush
    // before ending any transactions.
    shouldEndTransactionOnFlush: boolean = false

    governor?: InternalGovernor<Props, Value>

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
    queue: { governor: InternalGovernor<any, any>, action: 'flush' | 'dispose' }[] = []

    // A pipe for events out of this object
    subject: OutletSubject<Value>

    // Keep track of what props, state and subs were at the start of a
    // transaction, so we can pass them through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, subs: Subs }

    transactionLevel: number = 0

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>, props: Props, isStrict = false) {
        this.isStrict = isStrict
        this.lifecycle = lifecycle
        this.props = props

        // This will be shifted off the stack during `createGovernor`, which
        // is guaranteed to run directly after the subclass constructor.
        this.disallowSideEffectsReason.unshift('in constructor')
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

    setPropsWithoutFlush = (props: Props): void => {
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
            this.isReceivingProps = true
            this.lifecycle.componentWillReceiveProps(props)
            this.isReceivingProps = false
            this.popFix()
        }

        this.props = props

        if (this.lifecycle.constructor.getDerivedStateFromProps) {
            this.disallowSideEffectsReason.unshift("running `getDerivedStateFromProps`")
            this.state = Object.assign({}, this.state, this.lifecycle.constructor.getDerivedStateFromProps(props, this.state))
            this.disallowSideEffectsReason.shift()
        }
        
        this.connect()
        this.publish()
    }

    // A convencience method for manually changing the props of a Governor.
    // Avoid using this if possible.
    setProps = (props: Props, dontFlush=false): void => {
        this.setPropsWithoutFlush(props)
        if (!dontFlush) {
            this.flush()
        }
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

        // If we're not awaiting flush from a call to `setPropsWithoutFlush`,
        // we're not in `componentWillReceiveProps`, and we're not in a
        // transaction, then this call was likely triggered by an action
        // function in a subclass that was too lazy to add a transaction
        // manually, so we'll add one here.
        let needTransaction =
            !this.awaitingFlush &&
            !this.isReceivingProps &&
            this.transactionLevel === 0
        if(needTransaction) {
            this.increaseTransactionLevel()
        }

        this.disallowSideEffectsReason.unshift("running a setState updater")
        this.state = Object.assign({}, this.state, updater(this.state, this.props))
        this.disallowSideEffectsReason.shift()

        // If `setState` is called within `componentWillReceiveProps`, then
        // a `connect` and `publish` is already scheduled immediately
        // afterwards.
        if (!this.isReceivingProps) {
            this.connect()
            this.publish()
        }

        if (needTransaction) {
            this.decreaseTransactionLevel()
        }
    }

    // TODO:
    // this method feels like it could be a lot cleaner.
    connect() {
        if (this.lifecycle.subscribe) {
            this.disallowSideEffectsReason.unshift("running connectChild")

            this.pushFix()
            this.isRunningConnectChild = true
            let element = this.lifecycle.subscribe()
            this.isRunningConnectChild = false
            this.popFix()

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
                        let governor: InternalGovernor<any, any> | undefined
                        let observable: TransactionalObservable<any>
                        if (nextChildNode.type === 'subscribe') {
                            observable = nextChildNode.props.to
                        }
                        else {
                            governor = internalCreateGovernor(nextChildNode)
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
                            prevChild.governor!.setPropsWithoutFlush(nextChildNode.props)
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
                    
                    if (key === Root) {
                        this.subs = nextChildNode
                    }
                    else {
                        this.subs[key as any] = nextChildNode
                    }
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

    // Handle each published value from our children.
    handleChildChange(key: string, value) {
        // Was this called as part of a `subscribe` or `setProps` call
        // within `connect`?
        let isExpectingChange = this.expectingChildChangeFor === key

        if ((!isExpectingChange && this.disallowSideEffectsReason[0]) || this.transactionLevel === 0) {
            if (this.isStrict) {
                throw new Error(`A Govern component cannot receive new values from children while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
            else if (this.transactionLevel !== 0) {
                console.warn(`A Govern component should not receive new values from children while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}"`)
            }
        }
 
        // If we're not awaiting flush from a call to `setPropsWithoutFlush`,
        // and we're not expecting a change due to a `connectChild` call, then
        // we must have received an event from a raw ES Observable that
        // doesn't support transactions, and we'll wrap it in a transaction
        // before passing it on.
        let needTransaction = !this.awaitingFlush && !isExpectingChange
        if (needTransaction) {
            this.increaseTransactionLevel()
        }

        // If this method wasn't called while wrapped in `connect`, and our
        // current child is a `<combine />`, we'll need to shallow clone our
        // child before updating it. Otherwise we'll also overwrite our last
        // published child, breaking `shouldComponentPublish`.
        if (!isExpectingChange) {
            if (this.lastCombinedType === 'array') {
                this.subs = (this.subs as any).slice(0)
            }
            else if (this.lastCombinedType === 'object') {
                this.subs = Object.assign({}, this.subs)
            }
        }

        // Mutatively update our child
        if (key === Root) {
            this.subs = value
        }
        else {
            this.subs[key as any] = value
        }

        // We don't need to `publish` if there is already one scheduled.
        if (!isExpectingChange && !this.isReceivingProps) {
            this.publish()
        }

        if (needTransaction) {
            this.decreaseTransactionLevel()
        }
    }

    publish() {
        this.pushFix()

        this.disallowSideEffectsReason.unshift("running shouldComponentPublish")
        let shouldComponentPublish =
            !this.previousPublish ||
            !this.lifecycle.shouldComponentUpdate ||
            this.lifecycle.shouldComponentUpdate(this.previousPublish.props, this.previousPublish.state, this.previousPublish.subs)
        this.disallowSideEffectsReason.shift()
        
        // Publish a new value based on the current props, state and child.
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

    createGovernor(): InternalGovernor<Props, Value> {
        if (this.governor) {
            throw new Error('You cannot create multiple governors for a single Component')
        }

        // Side effects were disallowed during the subclass' constructor.
        this.disallowSideEffectsReason.shift()

        // Props and any state were set in the constructor, so we can jump
        // directly to `connect`.
        this.connect()

        // Skip `publish`, as we need to use the initial value when creating
        // the outlet.
        this.pushFix()
        this.disallowSideEffectsReason.unshift("publishing a value")
        this.subject = new OutletSubject(this.lifecycle.getValue())
        this.disallowSideEffectsReason.shift()
        this.popFix()

        // Used by shouldComponentPublish
        this.previousPublish = {
            props: this.props,
            state: this.state,
            subs: Object.assign({}, this.subs),
        }

        let outlet = new Outlet(this.subject)
        this.governor = Object.assign(outlet, {
            getOutlet: () => new Outlet(this.subject),
            setProps: this.setProps,
            setPropsWithoutFlush: this.setPropsWithoutFlush,
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

        // Iterate through children that have been created, updated or
        // destroyed, calling `flush` or `dispose` to process any side
        // effects in their children, or their `componentDidUpdate`/
        // `componentWillBeDisposed` lifecycle methods.
        let nextItem: { governor: InternalGovernor<any, any>, action: 'flush' | 'dispose' } | undefined
        while (nextItem = this.queue.shift()) {
            if (nextItem.action === 'flush') {
                nextItem.governor.flush()
            }
            else {
                nextItem.governor.dispose()
            }
        }
        
        // Once we've emptied the queue of possible side effects in children,
        // we'll run our own unpure lifecycle methods.
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

        // Run callbacks passed into `setState`
        while (this.callbacks.length) {
            let callback = this.callbacks.shift() as Function
            callback()
        }

        // If our `componentDidInstantiate` / `componentDidUpdate` lifecycle
        // methods caused any further calls to `connect`, we'll need to
        // recursively process the queue.
        if (this.queue.length && !this.awaitingFlush) {
            this.flush()
        }

        if (this.shouldEndTransactionOnFlush) {
            this.shouldEndTransactionOnFlush = false
            this.decreaseTransactionLevel()
        }
    }
    
    decreaseTransactionLevel = () => {
        // If we know that a flush will be called by the parent in the
        // future, then we can defer the transaction end until then.
        if (this.awaitingFlush) {
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
     * Add to the flush queue if the specified item isn't already there.
     */
    addToQueue(item: { governor: InternalGovernor<any, any>, action: 'flush' | 'dispose' }) {
        for (let i = 0; i < this.queue.length; i++) {
            let currentItem = this.queue[i]
            if (currentItem.governor === item.governor && currentItem.action === item.action) {
                return
            }
        }
        this.queue.push(item)
    }
}
