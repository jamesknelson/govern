import { getUniqueId } from './utils/getUniqueId'
import { isPlainObject } from './utils/isPlainObject'
import { Component, getDisplayName } from './Component'
import { createElement, convertToElement, doElementsReconcile, GovernElement } from './Element'
import { instantiateWithManualFlush, Instantiable, InstantiableClass } from './Instantiable'
import { Store } from './Store'
import { StoreSubject } from './StoreSubject'
import { Subscription } from './Subscription'
import { TransactionalObservable, TransactionalObserver } from './TransactionalObservable'
import { isValidStore } from './index';

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Subs=any> {
    constructor: Function & {
        getDerivedStateFromProps?(nextProps: Props, prevState: State): Partial<State>;
    }

    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: Props);
    subscribe?(): any;
    shouldComponentPublish?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    publish(): Value;
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    componentWillBeDisposed?();
}

export class ComponentImplementation<Props, State, Value, Subs> {
    // Keep track of whether side effects are allowed to help keep
    // components responsible.
    //
    // general side effects (setstate, setprops, dispose, subs changes, starting a transaction) are not allowed:
    //
    // - after disposing
    // - during getDerivedStateFromProps
    // - during setstate updaters
    // - while running connect (with the exception of expected keys from children)
    // - during shouldComponentPublish
    // - during `publish`
    // - while publishing via "transactionStart"
    // - while publishing via "next"
    disallowChangesReason: (string | null)[] = []

    props: Props;
    state: State;
    subs: Subs;

    // What the associated Component instance sees.
    fixed: { props: Props, state: State, subs: Subs }[] = [];

    // Keep the previously published values around for shouldComponentPublish
    previousPublish: { props: Props, state: State, subs: Subs };

    // Arbitrary functions to be run after componentDidUpdate
    callbacks: Function[] = []

    // Use a map so we have access to a list of keys, even if it contains
    // symbols.
    children: Map<string, {
        type: 'store' | 'element' | 'constant',
        element: GovernElement<any, any>,
        subscription?: Subscription,
        store?: Store<any, any>
    }> = new Map()

    // A list of children that have been disposed and removed from
    // this.children, but still haven't had the transaction ended.
    disposedChildren: Store<any, any>[] = []

    // If we're running `connect`, we can defer handling of new subs values
    // to the end of the connect.
    expectingChildChangeFor?: string

    // Keep track of whether we need to call componentDidInstantiate on the
    // next flush.
    hasCalledComponentDidInstantiate: boolean = false

    // Keep track of whether a specific transaction caused a publish, as we'll
    // running our own componentDidUpdate if it didn't.
    hasPublishedSinceLastUpdate: boolean = false

    // Keep track of whether we're in a componentWillReceiveProps lifecycle
    // method, so that we don't double connect/double publish.
    isReceivingProps: boolean = false

    // Keep track of whether the user is running "subscribe", so we can
    // prevent them from accessing the existing child.
    isRunningSubscribe: boolean = false

    // The last result of the `subscribe` function
    lastSubscribeElement?: GovernElement<any, any>

    lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>

    store?: Store<Value, Props>

    // A pipe for events out of this object
    subject: StoreSubject<Value>

    // Keep track of what props, state and subs were at the start of a
    // transaction, so we can pass them through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, subs: Subs }

    transactionIdLevels: Map<string, number> = new Map()
    transactionIdPropagatedToChildren?: string
    transactionIdPropagatedToSubscribers?: string
    transactionLevel: number = 0

    willDispose: boolean = false

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>, props: Props) {
        this.lifecycle = lifecycle
        this.props = props
        this.subject = new StoreSubject(this.dispatch)

        // This will be shifted off the stack during `instantiate`, which
        // is guaranteed to run directly after the subclass constructor.
        this.disallowChangesReason.unshift('in constructor')
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

    dispatch = (runner: Function): void => {
        if (!this.store) {
            throw new Error(`You cannot call "transaction" within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.disallowChangesReason[0]) {
            throw new Error(`You cannot call "transaction" while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.constructor)}".`)
        }

        let transactionId = getUniqueId()
        this.transactionStart(transactionId)
        runner()
        this.transactionEnd(transactionId)
    }

    dispose = () => {
        if (this.disallowChangesReason[0] && this.transactionLevel !== 0) {
            throw new Error(`You cannot call "dispose" on a governor while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
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
        if (this.disallowChangesReason[0]) {
            throw new Error(`You cannot update governor's props while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        if (this.transactionLevel === 0) {
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
            this.disallowChangesReason.unshift("running `getDerivedStateFromProps`")
            this.state = Object.assign({}, this.state, this.lifecycle.constructor.getDerivedStateFromProps(props, this.state))
            this.disallowChangesReason.shift()
        }
        
        this.connect()
        this.publish()
    }

    setState(updater: (prevState: Readonly<State>, props: Props) => Partial<State>, callback?: Function) {
        if (this.disallowChangesReason[0]) {
            throw new Error(`A Govern component cannot call "setState" outside while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        if (this.transactionLevel === 0) {
            throw new Error(`"setState" cannot be called outside of a transaction.`)
        }

        if (callback) {
            this.callbacks.push(callback)
        }

        this.disallowChangesReason.unshift("running a setState updater")
        this.state = Object.assign({}, this.state, updater(this.state, this.props))
        this.disallowChangesReason.shift()

        // If `setState` is called within `componentWillReceiveProps`, then
        // a `connect` and `publish` is already scheduled immediately
        // afterward, so we don't need to run them.
        if (!this.isReceivingProps) {
            this.connect()
            this.publish()
        }
    }

    connect() {
        if (this.lifecycle.subscribe) {
            this.disallowChangesReason.unshift("running subscribe")

            this.pushFix()
            this.isRunningSubscribe = true
            let result = this.lifecycle.subscribe()
            this.isRunningSubscribe = false
            this.popFix()

            if (result === undefined) {
                console.warn(`The "${getDisplayName(this.lifecycle.constructor)}" component returned "undefined" from its subscribe method. If you really want to return an empty value, return "null" instead.`)
            }

            let lastRootElement = this.lastSubscribeElement
            let nextRootElement = convertToElement(result)
            this.lastSubscribeElement = nextRootElement

            let { keys: lastKeys, elements: lastElements } = getChildrenFromSubscribedElement(lastRootElement)
            let { keys: nextKeys, elements: nextElements } = getChildrenFromSubscribedElement(nextRootElement)

            // Indicates whether all existing children should be destroyed and
            // recreated, even if they reconcile. We'll want to do this if the
            // children move from a `combine` to a `combineArray`, etc.
            let typeHasChanged = !lastRootElement || nextRootElement.type !== lastRootElement.type
            
            // Create a new `subs` object, keeping around appropriate previous
            // values, so we don't have to rerequest them from subscribed
            // stores.
            if (nextRootElement.type === 'combine') {
                this.subs = typeHasChanged ? {} : Object.assign({}, this.subs) as any
            }
            else if (nextRootElement.type === 'combineArray') {
                this.subs = typeHasChanged ? [] : (this.subs as any).slice(0) as any
            }

            // A list of keys on the existing `this.children` that need to be
            // disposed. We'll start with all of the previous keys, and remove
            // holdovers as we find them.
            let childKeysToDispose = new Set(lastKeys)

            // A list of keys which have new child information, and must be
            // added to this.children after any previous keys are cleaned up.
            let childKeysToAdd = [] as string[]

            for (let i = 0; i < nextKeys.length; i++) {
                let key = nextKeys[i]
                let nextElement = nextElements[key]
                if (typeHasChanged || !doElementsReconcile(lastElements[key], nextElement)) {
                    childKeysToAdd.push(key)
                }
                else {
                    childKeysToDispose.delete(key)
                    this.expectingChildChangeFor = key
                    this.updateChild(key, nextElement.props)
                    delete this.expectingChildChangeFor
                }
            }

            // Clean up after any previous children that are no longer
            // subscribed to
            let childKeysToDisposeArray = Array.from(childKeysToDispose)
            for (let i = 0; i < childKeysToDisposeArray.length; i++) {
                let key = childKeysToDisposeArray[i]
                this.removeChild(key)
                if (nextRootElement.type === 'combine' || nextRootElement.type === 'combineArray') {
                    delete this.subs[key]
                }
            }

            for (let i = 0; i < childKeysToAdd.length; i++) {
                let key = childKeysToAdd[i]

                // Stores will immediately emit their current value
                // on subscription, ensuring that `subs` is updated.
                this.expectingChildChangeFor = key
                this.addChild(
                    key,
                    nextElements[key],
                    value => this.handleChildChange(key, value)
                )
                delete this.expectingChildChangeFor
            }

            this.disallowChangesReason.shift()
        }
    }

    addChild(key: string, element: GovernElement<any, any>, changeHandler: Function) {
        let store: Store<any> | undefined
        let subscription
        let type = 'constant' as 'constant' | 'store' | 'element'

        if (element.type === 'subscribe') {
            type = 'store'

            // If the store already exists, it must propagate
            // any transaction starts to other subscribers, so
            // we pass in `true`
            store = element.props.to
            store!.transactionStart(this.transactionIdPropagatedToChildren!, true)
        }
        else if (element.type !== 'constant') {
            type = 'element'

            store = instantiateWithManualFlush(element, this.transactionIdPropagatedToChildren!)
        }

        if (store) {
            // TODO: pass in a ComponentTarget object
            subscription = store.subscribe(
                changeHandler as any,
                this.handleChildError,
                this.handleChildComplete,
                this.transactionStart,
                this.transactionEnd,
            )
        }
        else {
            this.setKey(key, element.props.of)
        }
        
        this.children.set(key, { type, store, subscription, element })
    }

    updateChild(key: string, nextProps: any) {
        // Note that stores never need updating.
        let child = this.children.get(key)!
        if (child.type === 'constant') {
            this.setKey(key, nextProps.of)
        }
        else if (child.type === 'element') {
            this.children.get(key)!.store!.setProps(nextProps)
        }
    }

    removeChild(key) {
        let child = this.children.get(key)!
        if (child.type !== 'constant') {
            child.subscription!.unsubscribe()
            this.disposedChildren.push(child.store!)
        }
        if (child.type === 'element') {
            // The child will be disposed when its transaction ends.
            child.store!.dispose()
        }
        
        this.children.delete(key)
    }

    setKey(key, value) {
        if (key === Root) {
            this.subs = value
        }
        else {
            this.subs[key as any] = value
        }
    }

    // Handle each published value from our children.
    handleChildChange(key: string, value) {
        // Was this called as part of a `subscribe` or `setProps` call
        // within `connect`?
        let isExpectingChange = this.expectingChildChangeFor === key

        if (!isExpectingChange && this.disallowChangesReason[0]) {
            throw new Error(`A Govern component cannot receive new values from children while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        if (!isExpectingChange && this.transactionLevel === 0) {
            throw new Error(`A Govern component cannot receive new values from children outside of a transaction.`)
        }
 
        // If this method wasn't called while wrapped in `connect`, and our
        // current child is a `<combine />`, we'll need to shallow clone our
        // child before updating it. Otherwise we'll also overwrite our last
        // published child, breaking `shouldComponentPublish`.
        if (!isExpectingChange && this.lastSubscribeElement) {
            if (this.lastSubscribeElement.type === 'combineArray') {
                this.subs = (this.subs as any).slice(0)
            }
            else if (this.lastSubscribeElement.type === 'combine') {
                this.subs = Object.assign({}, this.subs)
            }
        }

        // Mutatively update `subs`
        this.setKey(key, value)

        // We don't need to `publish` if there is already one scheduled.
        if (!isExpectingChange && !this.isReceivingProps) {
            this.publish()
        }
    }

    publish() {
        this.pushFix()

        this.disallowChangesReason.unshift("running shouldComponentPublish")
        let shouldComponentPublish =
            !this.previousPublish ||
            !this.lifecycle.shouldComponentPublish ||
            this.lifecycle.shouldComponentPublish(this.previousPublish.props, this.previousPublish.state, this.previousPublish.subs)
        this.disallowChangesReason.shift()
        
        // Publish a new value based on the current props, state and subs.
        if (shouldComponentPublish) {
            this.broadcastPublish()
        }

        this.popFix()
    }

    broadcastPublish() {
        this.disallowChangesReason.unshift("publishing a value")
        this.subject.next(this.lifecycle.publish())
        this.disallowChangesReason.shift()
        this.previousPublish = {
            props: this.props,
            state: this.state,
            subs: Object.assign({}, this.subs),
        }
        this.hasPublishedSinceLastUpdate = true
    }

    createStore(): Store<Value, Props> {
        if (this.store) {
            throw new Error('You cannot create multiple governors for a single Component')
        }

        // Side effects were disallowed during the subclass' constructor.
        this.disallowChangesReason.shift()

        // Props and any state were set in the constructor, so we can jump
        // directly to `connect`.
        this.connect()
        this.pushFix()
        this.broadcastPublish()
        this.popFix()

        this.store = new Store(this)

        return this.store
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
            let children = Array.from(this.children.values())
            for (let i = 0; i < children.length; i++) {
                let child = children[i]
                if (child.store) {
                    child.store.transactionStart(transactionId, child.type === "store")
                }
            }
        }

        if (propagateToSubscribers && !this.transactionIdPropagatedToSubscribers && transactionIdLevel === 1) {
            this.transactionIdPropagatedToSubscribers = transactionId
            this.disallowChangesReason.unshift("publishing transactionStart")
            this.subject.transactionStart(transactionId)
            this.disallowChangesReason.shift()
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
            // Keep the transaction level positive while we're running
            // lifecycle methods, so they can use `setState`.
            ++this.transactionLevel

            // Run lifecycle methods
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
                    this.lastUpdate.subs
                )
                this.popFix()
            }
            else {
                this.hasPublishedSinceLastUpdate = false
            }

            this.lastUpdate = {
                props: this.props,
                state: this.state,
                subs: this.subs,
            }

            if (this.willDispose) {
                // The children will be disposed before the parent, so that
                // children can always assume that they can call callbacks on
                // the parent during disposal.
                let children = Array.from(this.children.values())
                for (let i = 0; i < children.length; i++) {
                    let child = children[i]
                    if (child.subscription) {
                        child.subscription.unsubscribe()
                        if (child.type === 'element') {
                            child.store!.dispose()
                        }
                    }
                }

                this.broadcastTransactionEndToChildren()
                this.children.clear()

                // Lower the internal transaction level before calling the
                // lifecycle, so that it can't cause further updates.
                --this.transactionLevel

                if (this.lifecycle.componentWillBeDisposed) {
                    this.pushFix()
                    this.lifecycle.componentWillBeDisposed()
                    this.popFix()
                }

                // So long, everybody, I've got to go...
                this.broadcastTransactionEndToSubscribers()
                this.subject.complete()

                delete this.state
                delete this.subs
            }
            else {
                this.broadcastTransactionEndToChildren()

                // Only lower transaction level after ending transaction on
                // subscribers, in case their lifecycle methods cause updates on us.
                --this.transactionLevel

                // Lower the transaction level before emitting transactionEnd,
                // so that the transactionEnd event itself cannot have any
                // side effects without opening a new dispatch.
                let transactionIdPropagatedToSubscribers = this.transactionIdPropagatedToSubscribers
                this.broadcastTransactionEndToSubscribers()

                // Run callbacks passed into `setState`
                while (this.callbacks.length) {
                    let callback = this.callbacks.shift() as Function
                    callback()
                }

                // If our `componentDidInstantiate` / `componentDidUpdate` lifecycle
                // methods caused any further calls to `connect`, we may need to
                // recursively process the queue.
                if (this.hasPublishedSinceLastUpdate && this.transactionLevel === 0) {
                    this.transactionStart(transactionId, !!transactionIdPropagatedToSubscribers)
                    this.transactionEnd(transactionId)
                }
            }
        }
    }

    broadcastTransactionEndToChildren() {
        let stores: Store<any, any>[] =
            Array.from(this.children.values())
                .filter(child => child.store)
                .map(child => child.store!)
                .concat(this.disposedChildren)
        for (let i = 0; i < stores.length; i++) {
            this.disallowChangesReason.unshift("publishing transactionEnd")
            stores[i].transactionEnd(this.transactionIdPropagatedToChildren!)
            this.disallowChangesReason.shift()
        }
        this.disposedChildren.length = 0
    }

    broadcastTransactionEndToSubscribers() {
        if (this.transactionIdPropagatedToSubscribers) {
            this.disallowChangesReason.unshift("publishing transactionEnd")
            this.subject.transactionEnd(this.transactionIdPropagatedToSubscribers)
            this.disallowChangesReason.shift()
            delete this.transactionIdPropagatedToSubscribers
        }
    }

    handleChildError = (error) => {
        this.subject.error(error)
    }

    handleChildComplete() {
        // noop
    }
}


// TODO: memoize this with a weakmap
function getChildrenFromSubscribedElement(element?: GovernElement<any, any>): { keys: string[], elements: { [key: string]: GovernElement<any, any> } } {
    if (!element) {
        return { keys: [], elements: {} }
    }

    switch (element.type) {
        case 'combine':
            if (typeof element.props.children !== 'object') {
                throw new Error(`<combine> cannot be used with children of type "${typeof element.props.children}".`)
            }

            let elements = {}
            let childNodes = element.props.children
            let keys = Object.keys(childNodes)
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i]
                elements[key] = convertToElement(childNodes[key])
            }

            return {
                keys: Object.keys(element.props.children),
                elements: elements,
            }

        case 'combineArray':
            if (!Array.isArray(element.props.children)) {
                throw new Error(`<combineArray> can only be used with arrays, but instead received a "${typeof element.props.children}".`)
            }

            return {
                keys: Object.keys(element.props.children),
                elements: element.props.children.map(convertToElement),
            }
        
        default:
            return {
                keys: [Root],
                elements: { [Root]: element }
            }
    }
}