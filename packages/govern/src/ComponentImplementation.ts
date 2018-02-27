import { getUniqueId } from './utils/getUniqueId'
import { isPlainObject } from './utils/isPlainObject'
import { Component, getDisplayName } from './Component'
import { createElement, convertToElement, doElementsReconcile, isValidElement, GovernElement } from './Element'
import { instantiateWithManualFlush, Instantiable, InstantiableClass } from './Instantiable'
import { isValidStore, Store } from './Store'
import { StoreSubject } from './StoreSubject'
import { Subscription } from './Subscription'
import { Target } from './Target'
import { TransactionalObservable, TransactionalObserver } from './TransactionalObservable'
import { ComponentTarget } from './ComponentTarget'

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Subs=any> {
    constructor: Function & {
        getDerivedStateFromProps?(nextProps: Props, prevState: State): Partial<State>;
    }

    componentWillEnterTransaction?(transactionId: string): void;
    componentDidInstantiate?(): void;
    componentWillReceiveProps?(nextProps: Props): void;
    subscribe?(): any;
    shouldComponentPublish?(prevProps?: Props, prevState?: State, prevSubs?: Subs): boolean;
    publish(): Value;
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs): void;
    componentWillLeaveTransaction?(transactionId: string): void;
    componentWillBeDisposed?(): void;
}

interface Child {
    element: GovernElement<any, any>,
    subscription?: Subscription,
    target?: ComponentTarget<any>,
    store?: Store<any, any>,
    index: string,
    value: any
}

interface SubscribableChild {
    element: GovernElement<any, any>,
    subscription: Subscription,
    target: ComponentTarget<any>,
    store: Store<any, any>,
    index: string,
    value: any
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
    children: Map<string, Child> = new Map()

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
    // prevent it from accessing `this.subs`.
    isRunningSubscribe: boolean = false

    // The last result of the `subscribe` function
    lastSubscribeElement?: GovernElement<any, any>

    // Keep track of what props, state and subs were at the start of a
    // transaction, so we can pass them through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, subs: Subs }

    lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>

    store?: Store<Value, Props>

    // A pipe for events out of this object
    subject: StoreSubject<Value>

    // The currently active transaction object
    activeTransaction?: ComponentTransaction

    // A map of transaction id to the transaction objects that handled them.
    transactions: { [name: string]: ComponentTransaction } = {}

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
        if (this.disallowChangesReason[0]) {
            throw new Error(`You cannot call "dispatch" while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.constructor)}".`)
        }

        // If we've already opened a transaction on children, we don't need
        // to do it again.
        let requireDispatch = !this.activeTransaction || !this.activeTransaction.hasPropagatedToChildren
        let transactionId = requireDispatch && (this.activeTransaction ? this.activeTransaction.id : getUniqueId())

        if (transactionId) {
            this.transactionStart(transactionId, undefined)
        }
        runner()
        if (transactionId) {
            this.transactionEnd(transactionId)
        }
    }

    dispose = () => {
        if (this.disallowChangesReason[0] && this.activeTransaction) {
            throw new Error(`You cannot call "dispose" on a governor while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        this.willDispose = true

        // If we're not in a transaction, bumping the level will run the end
        // transaction handler and trigger disposal.
        if (!this.activeTransaction) {
            let transactionId = getUniqueId()
            this.transactionStart(transactionId, undefined)
            this.transactionEnd(transactionId)
        }
    }

    setProps = (props: Props): void => {
        if (this.disallowChangesReason[0]) {
            throw new Error(`You cannot update governor's props while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        if (!this.activeTransaction) {
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
        if (!this.activeTransaction) {
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

            let { keys: lastKeys, indexes: lastIndexes, elements: lastElements } = getChildrenFromSubscribedElement(lastRootElement)
            let { keys: nextKeys, indexes: nextIndexes, elements: nextElements } = getChildrenFromSubscribedElement(nextRootElement)

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

            // A list of known indexes, which we'll use to decide whether to
            // remove old values from `subs`
            let knownIndexes = new Set(Object.values(nextIndexes))

            for (let i = 0; i < nextKeys.length; i++) {
                let key = nextKeys[i]
                let nextElement = nextElements[key]
                if (typeHasChanged || !doElementsReconcile(lastElements[key], nextElement)) {
                    childKeysToAdd.push(key)
                }
                else {
                    childKeysToDispose.delete(key)
                    this.updateChild(key, nextIndexes[key], nextElement.props, knownIndexes)
                }
            }

            // Clean up after any previous children that are no longer
            // subscribed to
            let childKeysToDisposeArray = Array.from(childKeysToDispose)
            for (let i = 0; i < childKeysToDisposeArray.length; i++) {
                this.removeChild(childKeysToDisposeArray[i], knownIndexes)
            }

            for (let i = 0; i < childKeysToAdd.length; i++) {
                let key = childKeysToAdd[i]
                this.addChild(
                    key,
                    nextIndexes[key],
                    nextElements[key],
                )
            }

            this.disallowChangesReason.shift()
        }
    }

    addChild(key: string, index: string, element: GovernElement<any, any>) {
        let store: Store<any> | undefined
        let target: Target<any> | undefined
        let type = 'constant' as 'constant' | 'store' | 'element'
        
        // As `addChild` is only called by `connect`, which must happen inside
        // a transaction that has been propagated to children, we must also
        // start a transaction on subscriptions.
        if (element.type === 'subscribe') {
            target = new ComponentTarget(this, key)
            store = element.props.to
            store!.transactionStart(this.activeTransaction!.id, target)
        }
        else if (element.type !== 'constant') {
            target = new ComponentTarget(this, key)
            store = instantiateWithManualFlush(element, this.activeTransaction!.id, target)
        }

        let child = { index, store, element, target: undefined as any, subscription: undefined as any, value: undefined }
        this.children.set(key, child)

        if (store) {
            // TODO: fix types
            this.activeTransaction!.addChildToCleanupList(child as any)

            // Stores will immediately emit their current value
            // on subscription, ensuring that `subs` is updated.
            this.expectingChildChangeFor = key
            child.target = target
            child.subscription = store.subscribe(target!)
            delete this.expectingChildChangeFor
        }
        else {
            this.setSubs(key, element.props.of)
        }
    }

    updateChild(key: string, index: string, nextProps: any, knownIndexes: Set<string>) {
        let child = this.children.get(key)!
        let oldIndex = child.index
        if (index !== oldIndex) {
            child.index = index
            this.subs[index] = child.value
            if (!knownIndexes.has(oldIndex)) {
                delete this.subs[oldIndex]
            }
        }

        // Note that subscriptions never need updating.
        if (child.element.type === 'constant') {
            this.setSubs(key, nextProps.of)
        }
        else if (child.element.type !== 'subscribe') {
            this.expectingChildChangeFor = key
            this.children.get(key)!.store!.setProps(nextProps)
            delete this.expectingChildChangeFor
        }
    }

    removeChild(key, knownIndexes: Set<string>) {
        let child = this.children.get(key)!

        if (child.store) {
            if (child.element.type !== 'subscribe') {
                // The child will be disposed when its transaction ends.
                child.store.dispose()
            }

            // TODO: fix types
            this.activeTransaction!.unsubscribeChildWhenReady(child as any)
        }

        if (child.index !== Root && !knownIndexes.has(child.index)) {
            delete this.subs[child.index]
        }
        
        this.children.delete(key)
    }

    setSubs(key: string, value: any) {
        let child = this.children.get(key)!

        child.value = value

        if (child.index === Root) {
            this.subs = value
        }
        else {
            this.subs[child.index] = value
        }
    }

    // Handle each published value from our children.
    receiveChangeFromChild(key: string, value) {
        // Was this called as part of a `subscribe` or `setProps` call
        // within `connect`?
        let isExpectingChange = this.expectingChildChangeFor === key

        if (!isExpectingChange) {
            if (this.disallowChangesReason[0]) {
                throw new Error(`A Govern component cannot receive new values from children while ${this.disallowChangesReason[0]}. See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }
            if (!this.activeTransaction) {
                throw new Error(`A Govern component cannot receive new values from children outside of a transaction.`)
            }
 
            // This method wasn't called while wrapped in `connect`, so if our
            // current child is a `<combine />`, we'll need to shallow clone our
            // child before updating it. Otherwise we'll also overwrite our last
            // published child, breaking `shouldComponentPublish`.
            if (this.lastSubscribeElement) {
                if (this.lastSubscribeElement.type === 'combineArray') {
                    this.subs = (this.subs as any).slice(0)
                }
                else if (this.lastSubscribeElement.type === 'combine') {
                    this.subs = Object.assign({}, this.subs)
                }
            }
        }

        // Mutatively update `subs`
        this.setSubs(key, value)

        // We don't need to `publish` if there is already one scheduled.
        if (!isExpectingChange && !this.isReceivingProps) {
            this.publish()
        }
    }

    publish() {
        this.pushFix()

        this.disallowChangesReason.unshift("running shouldComponentPublish")
        let shouldComponentPublish =
            !this.store ||
            !this.previousPublish ||
            !this.lifecycle.shouldComponentPublish ||
            this.lifecycle.shouldComponentPublish(this.previousPublish.props, this.previousPublish.state, this.previousPublish.subs)
        this.disallowChangesReason.shift()
        
        // Publish a new value based on the current props, state and subs.
        if (shouldComponentPublish) {
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

        this.popFix()
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
        this.publish()

        this.store = new Store(this)
        return this.store
    }

    transactionStart = (transactionId: string, sourceTarget: Target<any> | undefined, originChildKey?: string) => {
        if (this.activeTransaction && originChildKey) {
            // We're already in a transaction, so ignore this and the
            // corresponding transactionEnd call.
            this.children.get(originChildKey)!.target!.ignoreOneTransactionEnd(transactionId)
            return
        }

        this.disallowChangesReason.unshift("starting transaction")
        if (!this.activeTransaction) {
            // TODO: fix types
            this.activeTransaction = new ComponentTransaction(transactionId, sourceTarget, originChildKey, this.children as any, this.subject)

            if (this.lifecycle.componentWillEnterTransaction) {
                this.lifecycle.componentWillEnterTransaction(transactionId)
            }

            this.activeTransaction.enter()
        }
        else {
            this.activeTransaction.increaseTransactionLevel(transactionId)
        }
        this.transactions[transactionId] = this.activeTransaction
        this.disallowChangesReason.shift()
    }

    transactionEnd = (transactionId: string) => {
        let transaction = this.transactions[transactionId]
        if (!transaction) {
            throw new Error(`An unknown transaction id was passed to "transactionEnd".`)
        }

        transaction.decreaseTransactionLevel(transactionId)

        if (transaction.awaitingEndCount === 0) {
            delete this.transactions[transactionId]
        }
        
        if (this.activeTransaction === transaction && transaction.level === 0) {
            let transaction = this.activeTransaction

            // Run lifecycle methods, ensuring that the active transaction
            // has been propagated to children if necessary.
            if (!this.hasCalledComponentDidInstantiate) {
                this.hasCalledComponentDidInstantiate = true
                this.hasPublishedSinceLastUpdate = false
                if (this.lifecycle.componentDidInstantiate) {
                    this.pushFix()
                    this.activeTransaction.propagateTransactionToChildren()
                    this.lifecycle.componentDidInstantiate!()
                    this.popFix()
                }
            }
            else if (this.hasPublishedSinceLastUpdate && this.lifecycle.componentDidUpdate) {
                this.hasPublishedSinceLastUpdate = false
                this.pushFix()
                this.activeTransaction.propagateTransactionToChildren()
                this.lifecycle.componentDidUpdate!(
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
                    }
                    if (child.store && child.element.type !== 'subscribe') {
                        // As `willDispose` is true, children must be in a
                        // transaction right now, so this will have no
                        // immediate effect.
                        child.store!.dispose()
                    }
                }
            }

            if (this.lifecycle.componentWillLeaveTransaction) {
                this.lifecycle.componentWillLeaveTransaction(transaction.id)
            }

            this.disallowChangesReason.unshift("ending transaction")
            delete this.activeTransaction
            transaction.leave()
            this.disallowChangesReason.shift()

            if (this.willDispose) {
                if (this.lifecycle.componentWillBeDisposed) {
                    this.pushFix()
                    this.lifecycle.componentWillBeDisposed()
                    this.popFix()
                }

                this.children.clear()
                delete this.state
                delete this.subs

                this.subject.complete()
            }
            else {                
                // Run callbacks passed into `setState`
                while (this.callbacks.length) {
                    let callback = this.callbacks.shift() as Function
                    callback()
                }

                // If anything has caused further calls to `connect`, we may
                // need to recursively run lifecycle methods.
                if (this.hasPublishedSinceLastUpdate && !this.activeTransaction) {
                    let id = getUniqueId()
                    this.transactionStart(id, transaction.sourceTarget)
                    this.transactionEnd(id)
                }
            }
        }
    }
}


// TODO: memoize this with a weakmap if it results in significantly improved perf
function getChildrenFromSubscribedElement(element?: GovernElement<any, any>): { keys: string[], indexes: { [key: string]: string }, elements: { [key: string]: GovernElement<any, any> } } {
    if (!element) {
        return { keys: [], indexes: {}, elements: {} }
    }

    if (element.type === 'combine') {
        if (typeof element.props.children !== 'object') {
            throw new Error(`<combine> cannot be used with children of type "${typeof element.props.children}".`)
        }

        let elements = {}
        let indexes = {}
        let childNodes = element.props.children
        let indexesArray = Object.keys(childNodes)
        let keys = [] as string[]
        for (let i = 0; i < indexesArray.length; i++) {
            let index = indexesArray[i]
            let node = childNodes[index]
            let key = (isValidElement(node) && node.key) ? String(node.key) : index
            elements[key] = convertToElement(node)
            indexes[key] = index
            keys.push(key)
        }

        return { keys, indexes, elements }
    }
    else if (element.type === 'combineArray') {
        if (!Array.isArray(element.props.children)) {
            throw new Error(`<combineArray> can only be used with arrays, but instead received a "${typeof element.props.children}".`)
        }

        let elements = {}
        let indexes = {}
        let childNodes = element.props.children
        let keys = [] as string[]
        for (let i = 0; i < childNodes.length; i++) {
            let node = childNodes[i]
            let key = isValidElement(node) ? (String(node.key) || String(i)) : String(i)
            elements[key] = convertToElement(node)
            indexes[key] = i
            keys.push(key)
        }

        return { keys, indexes, elements }
    }
    else {
        return {
            keys: [Root],
            indexes: { [Root]: Root },
            elements: { [Root]: element }
        }
    }
}


class ComponentTransaction {
    awaitingEndCount: number
    children: Set<SubscribableChild>
    hasPropagatedToChildren: boolean
    idLevels: { [name: string]: number }
    id: string
    level: number
    subject: StoreSubject<any>
    originatedFromChild?: SubscribableChild
    wasOriginRemoved: boolean = false
    sourceTarget?: Target<any>

    constructor(id: string, sourceTarget: Target<any> | undefined, originChildKey: string | undefined, children: Map<string, SubscribableChild>, subject: StoreSubject<any>) {
        this.awaitingEndCount = 1
        this.idLevels = { [id]: 1 }
        this.level = 1
        this.id = id
        this.children = new Set(Array.from(children.values()))
        this.subject = subject
        this.sourceTarget = sourceTarget

        if (originChildKey) {
            this.originatedFromChild = children.get(originChildKey)!
            this.hasPropagatedToChildren = false
        }

        if (__DEV__) {
            setTimeout(() => {
                if (this.level !== 0) {
                    throw new Error('Govern Error: a transaction did not end within the same tick. Please file an issue.')
                }
            })
            setTimeout(() => {
                if (this.awaitingEndCount !== 0) {
                    throw new Error('Govern Error: a transaction did not complete successfully. Please file an issue.')
                }
            })
        }
    }

    enter() {
        if (!this.originatedFromChild) {
            this.propagateTransactionToChildren()
        }

        this.subject.transactionStart(this.id, this.sourceTarget)
    }

    addChildToCleanupList(child: SubscribableChild) {
        if (!this.hasPropagatedToChildren) {
            throw new Error('Govern Error: a child was added to cleanup list before transaction propagated to children')
        }

        this.children.add(child)
    }

    unsubscribeChildWhenReady(child: SubscribableChild) {
        if (child === this.originatedFromChild) {
            child.target!.preventFurtherChangeEvents()
            this.wasOriginRemoved = true
        }
        else {
            child.subscription!.unsubscribe()
        }
    }
    
    propagateTransactionToChildren() {
        if (!this.hasPropagatedToChildren) {
            this.hasPropagatedToChildren = true
            let children = Array.from(this.children)
            for (let i = 0; i < children.length; i++) {
                let child = children[i]
                if (child.store) {
                    child.store.transactionStart(this.id, child.target)
                }
            }
        }
    }

    increaseTransactionLevel(id: string) {
        let idLevel = this.idLevels[id] || 0
        this.idLevels[id] = idLevel + 1
        this.level += 1
        this.awaitingEndCount += 1
        
        // Only parents can increase the transaction level above one; they do
        // so when they want to make changes in response to a transaction
        // initiated elsewhere.
        // 
        // As the parents increase the level in preparation for changes, we'll
        // need to increase the level on children too.
        if (!this.hasPropagatedToChildren) {
            this.propagateTransactionToChildren()
        }
    }

    decreaseTransactionLevel(id: string) {
        let level: number = this.idLevels[id]

        if (level === undefined) {
            throw new Error("Unknown transaction id")
        }

        // It is important to consider the transaction closed on the first
        // completion notification, otherwise we can get circular dependencies
        // that never close.
        //
        // We only keep track of thet total number of closes to emit an
        // error if it doesn't match up.
        
        this.awaitingEndCount -= 1

        if (level) {
            this.idLevels[id] = 0
            this.level -= level
        }

        if (this.level < 0) {
            throw new Error('Tried to lower transaction level below 0')
        }
    }

    leave() {
        // The child which originated the transaction has been removed, but
        // we haven't unsubscribed yet, as we were waiting for it to end
        // the transaction. Now that the transaction has ended, we can
        // finish unsubscribing.
        if (this.wasOriginRemoved) {
            this.originatedFromChild!.subscription!.unsubscribe()
        }

        // End transaction internally before publishing transactionEnd, so
        // that any `transactionStart` calls caused by `transactionEnd`
        // will result in new transactions.
        if (this.hasPropagatedToChildren) {
            let children = Array.from(this.children)
            for (let i = 0; i < children.length; i++) {
                if (children[i].store) {
                    children[i].store.transactionEnd(this.id)
                }
            }

        }

        this.subject.transactionEnd(this.id)

        this.children.clear()
        delete this.sourceTarget
        delete this.originatedFromChild
    }
}