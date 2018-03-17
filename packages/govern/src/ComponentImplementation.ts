import { Component, getDisplayName } from './Component'
import { convertToElement, doElementsReconcile, isValidElement, GovernElement } from './Element'
import { ComponentTarget } from './ComponentTarget'
import { DispatcherEmitter } from './DispatcherEmitter'
import { Dispatcher } from './Dispatcher';
import { createStoreGovernor, StoreGovernor } from './StoreGovernor'

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Subs=any> {
    constructor: Function & {
        getDerivedStateFromProps?(nextProps: Props, prevState: State): Partial<State>;
    }

    componentWillReceiveProps?(nextProps: Props): void;
    subscribe?(): any;

    shouldComponentUpdate?(nextProps?: Props, nextState?: State, nextSubs?: Subs): boolean;

    publish(): Value

    // These lifecycle methods will be called after other Govern components have
    // received a published value, but before the update is flushed to the UI.
    // 
    // They can be used in a similar way to a theoretical
    // `componentWillReceiveSubs`. I've opted for this method instead, as it
    // is more obvious that an unguarded `setState` will cause an infinite
    // loop.
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs): void;
    componentDidInstantiate?(): void;

    // This will be called after a component's published value has been flushed
    // to any subscribers. It will not be called on instantiation.
    componentDidFlush?(): void;
    
    componentWillBeDisposed?(): void;
}

interface Child {
    element: GovernElement<any, any>,
    index: string,
    value: any,
    subscription?: ChildSubscription,
}

export interface ChildSubscription {
    target: ComponentTarget<any>,
    governor: StoreGovernor<any, any>,
}

export class ComponentImplementation<Props, State, Value, Subs> implements StoreGovernor<Value, Props> {
    props: Props;
    state: State;
    subs: Subs;

    // What the associated Component instance sees.
    fixed: { props: Props, state: State, subs: Subs }[] = [];

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

    // Keep track of whether we're in a componentWillReceiveProps lifecycle
    // method, so that we don't double connect/double publish.
    isReceivingProps: boolean = false

    // Keep track of whether the user is running "subscribe", so we can
    // prevent it from accessing `this.subs`.
    isRunningSubscribe: boolean = false

    // The last result of the `subscribe` function
    lastSubscribeElement?: GovernElement<any, any>

    // Keep track of previous props, state and subs, so we can pass them
    // through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, subs: Subs }

    lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>

    // Keep the previously published values around for shouldComponentPublish
    previousPublish: { props: Props, state: State, subs: Subs };

    // A pipe for events out of this object
    emitter: DispatcherEmitter<Value>

    willDispose: boolean = false

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>, props: Props) {
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
    pushFix(fix?: { props: Props, state: State, subs: Subs }) {
        this.fixed.unshift(fix ? fix : {
            props: this.props,
            state: this.state,
            subs: this.subs,
        })
    }
    popFix() {
        this.fixed.shift()
    }

    dispose = () => {
        // The children will be disposed before the parent, so that
        // children can always assume that they can call callbacks on
        // the parent during disposal.
        let children = Array.from(this.children.values())
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            if (child.subscription) {
                child.subscription.target.unsubscribe()
                if (child.element.type !== 'subscribe') {
                    child.subscription.governor.dispose()
                }
            }
        }

        if (this.lifecycle.componentWillBeDisposed) {
            this.pushFix()
            this.lifecycle.componentWillBeDisposed()
            this.popFix()
        }

        this.children.clear()
        delete this.state
        delete this.subs

        this.emitter.complete()
    }

    setProps = (props: Props): void => {
        if (!this.emitter.dispatcher.isDispatching) {
            throw new Error(`setProps cannot be called outside of a dispatch.`)
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
            this.state = Object.assign({}, this.state, this.lifecycle.constructor.getDerivedStateFromProps(props, this.state))
        }
        
        this.connect()
        this.publish()
    }

    setState(updater: (prevState: Readonly<State>, props: Props) => Partial<State>, callback?: Function) {
        // If we're not already dispatching, start a dispatch.
        if (!this.emitter.dispatcher.isDispatching) {
            this.emitter.dispatcher.enqueueAction(() => {
                this.setState(updater, callback)
            })
            return
        }

        if (callback) {
            this.callbacks.push(callback)
        }

        this.state = Object.assign({}, this.state, updater(this.state, this.props))
        
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
        }
    }

    addChild(key: string, index: string, element: GovernElement<any, any>) {
        let child: Child = {
            index,
            element,
            value: undefined
        }

        this.children.set(key, child)

        if (element.type === 'constant') {
            this.setSubs(key, element.props.of)
        }
        else {
            let target = new ComponentTarget(this, key)
            let governor: StoreGovernor<any, any> =
                element.type == 'subscribe'
                    ? element.props.to.governor
                    : createStoreGovernor(element, this.emitter.dispatcher)

            child.subscription = { governor, target }
            governor.emitter.subscribePublishTarget(target)
            this.setSubs(key, governor.emitter.getValue())
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

        if (!child.subscription) {
            this.setSubs(key, nextProps.of)
        }
        else if (child.element.type !== 'subscribe') {
            // Stores will immediately emit their new value
            // on `setProps`, ensuring that `subs` is updated.
            this.expectingChildChangeFor = key
            child.subscription.governor.setProps(nextProps)
            delete this.expectingChildChangeFor
        }
    }

    removeChild(key, knownIndexes: Set<string>) {
        let child = this.children.get(key)!

        if (child.subscription) {
            child.subscription.target.unsubscribe()

            if (child.element.type !== 'subscribe') {
                child.subscription.governor.dispose()
            }
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
            if (!this.emitter.dispatcher.isDispatching) {
                throw new Error(`A Govern component cannot receive new values from children outside of a dispatch.`)
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
        let shouldComponentPublish = true
        let shouldForcePublish =
            !this.previousPublish ||
            !this.lifecycle.shouldComponentUpdate
        if (!shouldForcePublish) {
            this.pushFix(this.previousPublish)
            shouldComponentPublish = this.lifecycle.shouldComponentUpdate!(this.props, this.state, this.subs)
            this.popFix()
        }
        
        // Publish a new value based on the current props, state and subs.
        if (shouldComponentPublish) {
            this.pushFix()
            this.emitter.publish(this.lifecycle.publish())
            this.popFix()
        }

        this.previousPublish = {
            props: this.props,
            state: this.state,
            subs: (this.subs !== undefined && typeof this.subs === 'object') ? Object.assign({}, this.subs) : this.subs,
        }
    }

    createStoreGovernor(initialDispatcher: Dispatcher): this {
        // Make sure to use `this.emitter.dispatcher` instead of the `_dispatcher`
        // argument, in case a new dispatcher was assigned during `connect`.
        this.emitter = initialDispatcher.createEmitter(this)

        // Props and any state were set in the constructor, so we can jump
        // directly to `connect`.
        this.connect()
        this.publish()

        return this
    }

    performReaction(): boolean {
        let children = Array.from(this.children.values())
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            if (child.subscription) {
                if (this.emitter.dispatcher.moveReactionToFront(child.subscription.target.subscription.emitter)) {
                    return false
                }
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
        else if (this.lifecycle.componentDidUpdate) {
            this.pushFix()
            this.lifecycle.componentDidUpdate!(
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

        return true
    }

    performPost(): boolean {
        let children = Array.from(this.children.values())
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            if (child.subscription) {
                if (this.emitter.dispatcher.movePostToFront(child.subscription.target.subscription.emitter)) {
                    return false
                }
            }
        }

        if (this.lifecycle.componentDidFlush) {
            this.pushFix()
            this.lifecycle.componentDidFlush()
            this.popFix()
        }

        let callback
        while (callback = this.callbacks.shift()) {
            callback()
        }

        return true
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
