import { getUniqueId } from './utils/getUniqueId'
import { isPlainObject } from './utils/isPlainObject'
import { Component, getDisplayName } from './Component'
import { doNodesReconcile } from './doNodesReconcile'
import { isValidElement } from './Element'
import { Governable, GovernableClass } from './Governable'
import { instantiateWithManualFlush } from './Governor'
import { Outlet } from './Outlet'
import { OutletSubject } from './OutletSubject'
import { Subscription } from './Subscription'
import { TransactionalObservable, TransactionalObserver } from './TransactionalObservable'

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Child=any> {
    constructor: Function & {
        getDerivedStateFromProps?(nextProps: Props, prevState: State): Partial<State>;
    }

    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: Props);
    connectChild?(): any;
    shouldComponentPublish?(prevProps?: Props, prevState?: State, prevChild?: Child);
    publish(): Value;
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevChild?: Child);
    componentWillBeDisposed?();
}

export class ComponentImplementation<Props, State, Value, Child> {
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
    child: Child;

    // What the associated Component instance sees.
    fixed: { props: Props, state: State, child: Child }[] = [];

    // Keep the previously published values around for shouldComponentPublish
    previousPublish: { props: Props, state: State, child: Child };

    // Arbitrary functions to be run after componentDidUpdate
    callbacks: Function[] = []
    
    children: {
        [key: string]: {
            node: any,
            subscription: Subscription,

            // A governor will not exist in the case of a `subscribe` element.
            governor?: Outlet<any, any>
        }
    } = {}

    // These are stored separately to children, as they may contain a symbol,
    // which doesn't appear in the result of Object.keys()
    childrenKeys: any[] = []

    // If we're running `connect`, we can defer handling of new child values
    // to the end of the connect.
    expectingChildChangeFor?: string

    governor?: Outlet<Value, Props>

    // Keep track of whether we need to call componentDidInstantiate on the
    // next flush.
    hasCalledComponentDidInstantiate: boolean = false

    // Keep track of whether a specific transaction caused a publish, as we'll
    // running our own componentDidUpdate if it didn't.
    hasPublishedSinceLastUpdate: boolean = false

    // Keep track of whether we're in a componentWillReceiveProps lifecycle
    // method, so that we don't double connect/double publish.
    isReceivingProps: boolean = false

    // Keep track of whether the user is running "connectChild", so we can
    // prevent them from accessing the existing child.
    isRunningConnectChild: boolean = false

    // If our last child was an array or object of further elements, store the
    // type.
    lastCombinedType?: 'array' | 'object'

    lifecycle: ComponentImplementationLifecycle<Props, State, Value, Child>

    // A queue of side effects that must be run on children
    queue: {
        governor: Outlet<any, any>,
        action: 'endTransaction' | 'dispose',
        transactionId?: string,
    }[] = []

    // A pipe for events out of this object
    subject: OutletSubject<Value> = new OutletSubject()

    // Keep track of what props, state and child were at the start of a
    // transaction, so we can pass them through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, child: Child }

    transactionIdLevels: Map<string, number> = new Map()
    transactionIdPropagatedToChildren?: string
    transactionIdPropagatedToSubscribers?: string
    transactionLevel: number = 0

    willDispose: boolean = false

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value, Child>, props: Props) {
        this.lifecycle = lifecycle
        this.props = props

        // This will be shifted off the stack during `instantiate`, which
        // is guaranteed to run directly after the subclass constructor.
        this.disallowSideEffectsReason.unshift('in constructor')
    }

    /**
     * Create a fixed set of props/state/child that can be used
     * within one method of a component instance.
     */
    fix(wrappedFn: Function) {
        this.pushFix()
        wrappedFn()
        this.popFix()
    }
    getFix() {
        return this.fixed[0] || { props: this.props, state: this.state, child: this.child }
    }
    pushFix() {
        this.fixed.unshift({
            props: this.props,
            state: this.state,
            child: this.child,
        })
    }
    popFix() {
        this.fixed.shift()
    }

    dispose = () => {
        if (this.disallowSideEffectsReason[0] && this.transactionLevel !== 0) {
            throw new Error(`You cannot call "dispose" on a governor while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        this.willDispose = true

        // If we're not in a transaction, bumping the level will run the end
        // transaction handler and trigger disposal.
        // TODO: flush without transaction
        if (!this.transactionLevel) {
            let transactionId = getUniqueId()
            this.transactionStart(transactionId, false)
            this.transactionEnd(transactionId, false)
        }
    }

    setProps = (props: Props): void => {
        if (this.disallowSideEffectsReason[0]) {
            throw new Error(`You cannot update governor's props while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        else if (this.transactionLevel === 0) {
            throw new Error(`setProps cannot be called outside of a transaction.`)
        }

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

    setState(updater: (prevState: Readonly<State>, props: Props) => Partial<State>, callback?: Function) {
        if (this.disallowSideEffectsReason[0]) {
            throw new Error(`A Govern component cannot call "setState" outside while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        else if (this.transactionLevel === 0) {
            throw new Error(`"setState" cannot be called outside of a transaction.`)
        }

        if (callback) {
            this.callbacks.push(callback)
        }

        this.disallowSideEffectsReason.unshift("running a setState updater")
        this.state = Object.assign({}, this.state, updater(this.state, this.props))
        this.disallowSideEffectsReason.shift()

        // If `setState` is called within `componentWillReceiveProps`, then
        // a `connect` and `publish` is already scheduled immediately
        // afterward, so we don't need to run them.
        if (!this.isReceivingProps) {
            this.connect()
            this.publish()
        }
    }

    // TODO:
    // this method feels like it could be a lot cleaner.
    connect() {
        if (this.lifecycle.connectChild) {
            this.disallowSideEffectsReason.unshift("running connectChild")

            this.pushFix()
            this.isRunningConnectChild = true
            let element = this.lifecycle.connectChild()
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
                        this.child = [] as any
                        forceFullUpdate = true
                    }
                    else {
                        this.child = (this.child as any).slice(0)
                    }
                        
                    nextChildNodes = element.props.children
                    nextChildrenKeys = Object.keys(element.props.children)
                }
                else if (isPlainObject(element.props.children)) {
                    if (this.lastCombinedType !== 'object') {
                        this.lastCombinedType = 'object'
                        this.child = {} as any
                        forceFullUpdate = true
                    }
                    else {
                        this.child = Object.assign({}, this.child)
                    }
                    nextChildNodes = element.props.children
                    nextChildrenKeys = Object.keys(element.props.children)
                }
                else {
                    if (this.lastCombinedType) {
                        delete this.child
                        delete this.lastCombinedType
                        forceFullUpdate = true
                    }
                    nextChildNodes = { [Root]: element.props.children }
                    nextChildrenKeys = [Root]
                }
            }
            else {
                if (this.lastCombinedType) {
                    delete this.child
                    delete this.lastCombinedType
                    forceFullUpdate = true
                }
                nextChildNodes = { [Root]: element }
                nextChildrenKeys = [Root]
            }

            let childrenToDisposeKeys = new Set(this.childrenKeys)
            let childKeysToRemove = new Set(this.lastCombinedType ? Object.keys(this.child) : [])
            let nextChildren = {}
            for (let i = 0; i < nextChildrenKeys.length; i++) {
                let key = nextChildrenKeys[i]
                let prevChild = this.children[key]
                let nextChildNode = nextChildNodes[key]
                nextChildren[key] = this.children[key]
                childKeysToRemove.delete(key)
                if (isValidElement(nextChildNode)) {
                    if (forceFullUpdate || !doNodesReconcile(prevChild && prevChild.node, nextChildNode)) {
                        let governor: Outlet<any, any> | undefined
                        let observable: Outlet<any>
                        if (nextChildNode.type === 'subscribe') {
                            observable = nextChildNode.props.to
                            observable.transactionStart(this.transactionIdPropagatedToChildren!, false)
                        }
                        else {
                            let transactionId = getUniqueId()
                            governor = instantiateWithManualFlush(nextChildNode, transactionId)
                            governor.transactionStart(this.transactionIdPropagatedToChildren!, false)
                            this.addToQueue({
                                governor: governor,
                                action: 'endTransaction',
                                transactionId: transactionId,
                            })
                            observable = governor
                        }

                        // Outlets will immediately emit their current value
                        // on subscription, ensuring that `child` is updated.
                        this.expectingChildChangeFor = key
                        // TODO: pass in a ComponentTarget object
                        let subscription = observable.subscribe(
                            value => this.handleChildChange(key, value),
                            this.handleChildError,
                            this.handleChildComplete,
                            this.transactionStart,
                            this.transactionEnd,
                        )
                        delete this.expectingChildChangeFor

                        nextChildren[key] = {
                            node: nextChildNode,
                            subscription: subscription,
                            governor: observable,
                        }
                    }
                    else {
                        // Keep around the previous child, and update it if
                        // necessary
                        childrenToDisposeKeys.delete(key)
                        if (nextChildNode.type !== 'subscribe') {
                            this.expectingChildChangeFor = key
                            let transactionId = getUniqueId()
                            prevChild.governor!.transactionStart(transactionId, false)
                            prevChild.governor!.setProps(nextChildNode.props)
                            delete this.expectingChildChangeFor
                            this.addToQueue({
                                governor: prevChild.governor!,
                                action: 'endTransaction',
                                transactionId: transactionId,
                            })
                        }
                    }
                }
                else {
                    delete nextChildren[key]
                    
                    if (key === Root) {
                        this.child = nextChildNode
                    }
                    else {
                        this.child[key as any] = nextChildNode
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

            let childrenToRemoveArray = Array.from(childKeysToRemove)
            for (let i = 0; i < childrenToRemoveArray.length; i++) {
                delete this.child[childrenToRemoveArray[i]]
            }

            this.children = nextChildren
            this.childrenKeys = nextChildrenKeys

            this.disallowSideEffectsReason.shift()
        }
    }

    // Handle each published value from our children.
    handleChildChange(key: string, value) {
        // Was this called as part of a `connectChild` or `setProps` call
        // within `connect`?
        let isExpectingChange = this.expectingChildChangeFor === key

        if (!isExpectingChange && this.disallowSideEffectsReason[0]) {
            throw new Error(`A Govern component cannot receive new values from children while ${this.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        if (!isExpectingChange && this.transactionLevel === 0) {
            throw new Error(`A Govern component cannot receive new values from children outside of a transaction.`)
        }
 
        // If this method wasn't called while wrapped in `connect`, and our
        // current child is a `<combine />`, we'll need to shallow clone our
        // child before updating it. Otherwise we'll also overwrite our last
        // published child, breaking `shouldComponentPublish`.
        if (!isExpectingChange) {
            if (this.lastCombinedType === 'array') {
                this.child = (this.child as any).slice(0)
            }
            else if (this.lastCombinedType === 'object') {
                this.child = Object.assign({}, this.child)
            }
        }

        // Mutatively update our child
        if (key === Root) {
            this.child = value
        }
        else {
            this.child[key as any] = value
        }

        // We don't need to `publish` if there is already one scheduled.
        if (!isExpectingChange && !this.isReceivingProps) {
            this.publish()
        }
    }

    publish() {
        this.pushFix()

        this.disallowSideEffectsReason.unshift("running shouldComponentPublish")
        let shouldComponentPublish =
            !this.previousPublish ||
            !this.lifecycle.shouldComponentPublish ||
            this.lifecycle.shouldComponentPublish(this.previousPublish.props, this.previousPublish.state, this.previousPublish.child)
        this.disallowSideEffectsReason.shift()
        
        // Publish a new value based on the current props, state and child.
        if (shouldComponentPublish) {
            this.broadcastPublish()
        }

        this.popFix()
    }

    broadcastPublish() {
        this.disallowSideEffectsReason.unshift("publishing a value")
        this.subject.next(this.lifecycle.publish())
        this.disallowSideEffectsReason.shift()
        this.previousPublish = {
            props: this.props,
            state: this.state,
            child: Object.assign({}, this.child),
        }
        this.hasPublishedSinceLastUpdate = true
    }

    createOutlet(initialTransactionId: string): Outlet<Value, Props> {
        if (this.governor) {
            throw new Error('You cannot create multiple governors for a single Component')
        }

        // Side effects were disallowed during the subclass' constructor.
        this.disallowSideEffectsReason.shift()

        // Props and any state were set in the constructor, so we can jump
        // directly to `connect`.
        this.transactionStart(initialTransactionId, false)
        this.connect()
        this.pushFix()
        this.broadcastPublish()
        this.popFix()

        this.governor = new Outlet(this)

        return this.governor
    }

    transactionStart = (transactionId: string, propagateToSubscribers: boolean = true) => {
        if (!transactionId) {
            throw new Error('You must pass a transactionId to "transactionStart"')
        }

        this.transactionLevel += 1
        let transactionIdLevel = (this.transactionIdLevels.get(transactionId) || 0) + 1
        this.transactionIdLevels.set(transactionId, transactionIdLevel)

        if (this.transactionLevel === 1) {
            this.transactionIdPropagatedToChildren = transactionId
            for (let i = 0; i < this.childrenKeys.length; i++) {
                let key = this.childrenKeys[i]
                let child = this.children[key]

                // child.governor only exists when the element was instantiated
                // from an element, and thus we're the only subscriber -- so
                // we can set `false` for `propagateToSubscribers`.
                if (child && child.governor) {
                    child.governor.transactionStart(transactionId, false)
                }
            }
        }

        if (propagateToSubscribers && !this.transactionIdPropagatedToSubscribers) {
            this.transactionIdPropagatedToSubscribers = transactionId
            this.disallowSideEffectsReason.unshift("publishing transactionStart")
            this.subject.transactionStart(transactionId)
            this.disallowSideEffectsReason.shift()
        }
    }

    transactionEnd = (transactionId: string, propagateToSubscribers: boolean = true) => {
        let transactionIdLevel: number = this.transactionIdLevels.get(transactionId)!
        
        // Negative transaction levels are used to denote transactions that
        // have already been ended from one subscriber or child, but still
        // need to be ended by other subscribers or children. 
        //
        // It is important to consider the transaction closed on the first
        // completion notification, otherwise we can get circular dependencies
        // that never close.
        if (transactionIdLevel < 0) {
            if (transactionIdLevel === -1) {
                this.transactionIdLevels.delete(transactionId)
            }
            else {
                this.transactionIdLevels.set(transactionId, transactionIdLevel + 1)
            }

            // We've already processed this transaction id, so we just need
            // to update the expected number of events remaining for debugging
            // purposes.
            return
        }
        else {
            if (transactionIdLevel === 1) {
                this.transactionIdLevels.delete(transactionId)
            }
            else {
                this.transactionIdLevels.set(transactionId, 1 - transactionIdLevel)

                // TODO: figure out something more useful to do than just whinging
                // to the developer. Also, only do it in dev mode.
                setTimeout(() => {
                    if (this.transactionIdLevels.get(transactionId) !== undefined) {
                        console.error('A Govern transaction did not complete successfully!')
                    }
                })
            }

            this.transactionLevel -= transactionIdLevel
        }

        if (transactionIdLevel === 0 || this.transactionLevel < 0) {
            throw new Error('Tried to lower transaction level below 0')
        }

        if (this.transactionLevel === 0) {
            ++this.transactionLevel
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

                --this.transactionLevel
                this.broadcastTransactionEnd()
                this.subject.complete()
                this.state = {} as any
                this.child = {} as any
            }
            else {
                // Lower the transaction level before emitting transactionEnd,
                // so that any side effects of the flush will be executed
                // properly. However, leave transactionLevel as 1 for the flush
                // itself, so that setState can be called.
                this.flush()
                --this.transactionLevel
                this.broadcastTransactionEnd()
            }
        }
    }

    broadcastTransactionEnd() {
        for (let i = 0; i < this.childrenKeys.length; i++) {
            let key = this.childrenKeys[i]
            let child = this.children[key]

            // child.governor only exists when the element was instantiated
            // from an element, and thus we're the only subscriber -- so
            // we can set `false` for `propagateToSubscribers`.
            if (child && child.governor) {
                this.disallowSideEffectsReason.unshift("publishing transactionEnd")
                child.governor.transactionEnd(this.transactionIdPropagatedToChildren!)
                this.disallowSideEffectsReason.shift()
            }
        }

        if (this.transactionIdPropagatedToSubscribers) {
            this.disallowSideEffectsReason.unshift("publishing transactionEnd")
            this.subject.transactionEnd(this.transactionIdPropagatedToSubscribers)
            this.disallowSideEffectsReason.shift()
            delete this.transactionIdPropagatedToSubscribers
        }
    }

    /**
     * The flush phase is where we work through possible side effects; first
     * in children, and then in our own lifecycle methods.
     */
    flush = () => {
        // Iterate through children that have been created, updated or
        // destroyed, calling `flush` or `dispose` to process any side
        // effects in their children, or their `componentDidUpdate`/
        // `componentWillBeDisposed` lifecycle methods.
        let nextItem: { governor: Outlet<any, any>, action: 'endTransaction' | 'dispose', transactionId?: string } | undefined
        while (nextItem = this.queue.shift()) {
            if (nextItem.action === 'endTransaction') {
                nextItem.governor.transactionEnd(nextItem.transactionId!)
            }
            else {
                nextItem.governor.dispose()
            }
        }
        
        // Once we've emptied the queue of possible side effects in children,
        // we'll run our own unpure lifecycle methods.
        if (!this.hasCalledComponentDidInstantiate) {
            this.hasCalledComponentDidInstantiate = true
            this.hasPublishedSinceLastUpdate = false
            if (this.lifecycle.componentDidInstantiate) {
                this.pushFix()
                this.lifecycle.componentDidInstantiate()
                this.popFix()
            }
        }
        else if (this.hasPublishedSinceLastUpdate && this.lifecycle.componentDidUpdate) {
            this.pushFix()
            this.hasPublishedSinceLastUpdate = false
            this.lifecycle.componentDidUpdate(
                this.lastUpdate.props,
                this.lastUpdate.state,
                this.lastUpdate.child
            )
            this.popFix()
        }
        else {
            this.hasPublishedSinceLastUpdate = false
        }

        this.lastUpdate = {
            props: this.props,
            state: this.state,
            child: this.child,
        }

        // Run callbacks passed into `setState`
        while (this.callbacks.length) {
            let callback = this.callbacks.shift() as Function
            callback()
        }

        // If our `componentDidInstantiate` / `componentDidUpdate` lifecycle
        // methods caused any further calls to `connect`, we may need to
        // recursively process the queue.
        if ((this.hasPublishedSinceLastUpdate || this.queue.length) && this.transactionLevel === 1) {
            this.flush()
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
    addToQueue(item: { governor: Outlet<any, any>, action: 'endTransaction' | 'dispose', transactionId?: string }) {
        for (let i = 0; i < this.queue.length; i++) {
            let currentItem = this.queue[i]
            if (currentItem.governor === item.governor && currentItem.action === item.action && currentItem.transactionId === item.transactionId) {
                return
            }
        }
        this.queue.push(item)
    }
}
