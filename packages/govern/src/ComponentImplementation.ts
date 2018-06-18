import { Component, getDisplayName } from './Component'
import { convertToElement, doElementsReconcile, isValidElement, GovernElement } from './GovernElement'
import { GovernObservable } from './GovernObservable'
import { ComponentTarget } from './ComponentTarget'
import { DispatcherEmitter } from './DispatcherEmitter'
import { Dispatcher } from './Dispatcher';
import { createObservableGovernor, GovernObservableGovernor } from './GovernObservableGovernor'

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any> {
    constructor: Function & {
        getDerivedStateFromProps?(nextProps: Props, prevState: State): State extends object ? (Partial<State> | null) : any;
    }

    componentWillReceiveProps?(nextProps: Props): void;

    render(): GovernObservable<Value> | GovernElement<Value> | Value | null;

    shouldComponentUpdate?(nextProps?: Props, nextState?: State): boolean;
    shouldComponentPublish?(prevProps?: Props, prevState?: State, prevValue?: Value): boolean;

    getPublishedValue?(): any

    // These lifecycle methods will be called after other Govern components have
    // received a published value, but before the update is flushed to the UI.
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevValue?: Value): void;
    componentDidMount?(): void;

    // This will be called after a component's published value has been flushed
    // to any subscribers. It will not be called on instantiation.
    componentDidFlush?(): void;
    
    componentWillUnmount?(): void;
}

interface Child {
    element: GovernElement<any, any>,
    index: string,
    value: any,
    subscription?: ChildSubscription,
}

export interface ChildSubscription {
    target: ComponentTarget<any>,
    governor: GovernObservableGovernor<any, any>,
}

export class ComponentImplementation<Props, State, Value> implements GovernObservableGovernor<Value, Props> {
    props: Props;
    state: State;
    value: Value;

    // What the associated Component instance sees.
    fixed: { props: Props, state: State, value: Value }[] = [];

    // Arbitrary functions to be run after componentDidUpdate
    callbacks: Function[] = []

    // Use a map so we have access to a list of keys, even if it contains
    // symbols.
    children: Map<string, Child> = new Map()

    // If we're running `connect`, we can defer handling of new value values
    // to the end of the connect.
    expectingChildChangeFor?: string

    // Keep track of whether we need to call componentDidMount on the
    // next flush.
    hasCalledComponentDidInstantiate: boolean = false

    isDisposed: boolean = false
    isDisposing: boolean = false

    // Keep track of whether we're in a componentWillReceiveProps lifecycle
    // method, so that we don't double connect/double publish.
    isReceivingProps: boolean = false

    // Keep track of whether the user is running "render", so we can
    // prevent it from accessing `this.value`.
    isRunningRender: boolean = false

    // The last result of the `render` function
    lastRenderedElement?: GovernElement<any, any>

    // Keep track of previous props, state and value, so we can pass them
    // through to componentDidUpdate.
    lastUpdate: { props: Props, state: State, value: Value }

    lifecycle: ComponentImplementationLifecycle<Props, State, Value>

    // Holds any state that has been "set", but not yet set on this.state
    nextState: State

    // Keep the previously published values around for shouldComponentPublish
    previousPublish: { props: Props, state: State, value: Value };

    // A pipe for events out of this object
    emitter: DispatcherEmitter<Value>

    willDispose: boolean = false

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value>, props: Props) {
        this.lifecycle = lifecycle
        this.props = props
    }

    /**
     * Create a fixed set of props/state/value that can be used
     * within one method of a component instance.
     */
    getFix() {
        return this.fixed[0] || { props: this.props, state: this.state, value: this.value }
    }
    pushFix(fix?: { props: Props, state: State, value: Value }) {
        this.fixed.unshift(fix ? fix : {
            props: this.props,
            state: this.state,
            value: this.value,
        })
    }
    popFix() {
        this.fixed.shift()
    }

    dispose = () => {
        this.isDisposing = true

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

        // Set this before `componentWillUnmount` to ensure `setState`
        // can't be called within `componentWillUnmount`.
        this.isDisposed = true

        if (this.lifecycle.componentWillUnmount) {
            this.pushFix()
            this.lifecycle.componentWillUnmount()
            this.popFix()
        }
        
        this.children.clear()
        delete this.nextState
        delete this.state
        delete this.value
        this.emitter.complete()
    }

    setProps = (props: Props): void => {
        if (this.isDisposing) {
            throw new Error(`setProps cannot be called on a component that has already been disposed.`)
        }

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

        if (this.lifecycle.constructor.getDerivedStateFromProps) {
            this.nextState = Object.assign({}, this.nextState || this.state, this.lifecycle.constructor.getDerivedStateFromProps(props, this.nextState || this.state))
        }

        let shouldComponentUpdate = true
        let shouldForceUpdate = !this.lifecycle.shouldComponentUpdate
        if (!shouldForceUpdate) {
            this.pushFix()
            shouldComponentUpdate = this.lifecycle.shouldComponentUpdate!(props, this.nextState || this.state)
            this.popFix()
        }

        if (this.nextState) {
            this.state = this.nextState
            delete this.nextState
        }
        this.props = props

        if (shouldComponentUpdate) {
            this.connect()
            this.publish()
        }
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

        this.nextState = Object.assign({}, this.nextState || this.state, updater(this.nextState || this.state, this.props))
        
        // If `setState` is called within `componentWillReceiveProps`, then
        // a `connect` and `publish` is already scheduled immediately
        // afterward, so we don't need to run them.
        //
        // It's also possible for `setState` to be called while disposing
        // children, but before our own `componentWillUnmount` has been
        // called. In this case, we don't want to connect/publish, as some
        // children may have already been removed.
        if (!this.isReceivingProps && !this.isDisposing) {
            let shouldComponentUpdate = true
            let shouldForceUpdate = !this.lifecycle.shouldComponentUpdate
            if (!shouldForceUpdate) {
                this.pushFix()
                shouldComponentUpdate = this.lifecycle.shouldComponentUpdate!(this.props, this.nextState)
                this.popFix()
            }

            this.state = this.nextState
            delete this.nextState

            if (shouldComponentUpdate) {
                this.connect()
                this.publish()
            }
        }
    }

    connect() {
        this.pushFix()
        this.isRunningRender = true
        let result = this.lifecycle.render!()
        this.isRunningRender = false
        this.popFix()

        if (result === undefined) {
            console.warn(`The "${getDisplayName(this.lifecycle.constructor)}" component returned "undefined" from its render method. If you really want to return an empty value, return "null" instead.`)
        }

        let lastRootElement = this.lastRenderedElement
        let nextRootElement = convertToElement(result)
        this.lastRenderedElement = nextRootElement

        let { keys: lastKeys, elements: lastElements } = getChildrenFromRenderedElement(lastRootElement)
        let { keys: nextKeys, indexes: nextIndexes, elements: nextElements } = getChildrenFromRenderedElement(nextRootElement)

        // Indicates whether all existing children should be destroyed and
        // recreated, even if they reconcile. We'll want to do this if the
        // children move from a `combine` to something else, etc.
        let typeHasChanged = !lastRootElement || nextRootElement.type !== lastRootElement.type
        
        // Create a new `value` object, keeping around appropriate previous
        // values, so we don't have to rerequest them from subscribed
        // stores.
        if (nextRootElement.type === 'combine' && typeHasChanged) {
            this.value = {} as any
        }

        // A list of keys on the existing `this.children` that need to be
        // disposed. We'll start with all of the previous keys, and remove
        // holdovers as we find them.
        let childKeysToDispose = new Set(lastKeys)

        // A list of keys which have new child information, and must be
        // added to this.children after any previous keys are cleaned up.
        let childKeysToAdd = [] as string[]

        // A list of known indexes, which we'll use to decide whether to
        // remove old values from `value`
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

    addChild(key: string, index: string, element: GovernElement<any, any>) {
        let child: Child = {
            index,
            element,
            value: undefined
        }

        this.children.set(key, child)

        if (element.type === 'constant') {
            this.setValue(key, element.props.of)
        }
        else {
            let target = new ComponentTarget(this, key)
            let governor: GovernObservableGovernor<any, any> =
                element.type == 'subscribe'
                    ? element.props.to.governor
                    : createObservableGovernor(element, this.emitter.dispatcher)

            child.subscription = { governor, target }
            governor.emitter.subscribePublishTarget(target)
            this.setValue(key, governor.emitter.getValue())
        }
    }

    updateChild(key: string, index: string, nextProps: any, knownIndexes: Set<string>) {
        let child = this.children.get(key)!
        let oldIndex = child.index
        if (index !== oldIndex) {
            child.index = index
            this.value[index] = child.value
            if (!knownIndexes.has(oldIndex)) {
                delete this.value[oldIndex]
            }
        }

        if (!child.subscription) {
            this.setValue(key, nextProps.of)
        }
        else if (child.element.type !== 'subscribe') {
            // Observables will immediately emit their new value
            // on `setProps`, ensuring that `value` is updated.
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
            delete this.value[child.index]
        }
     
        this.children.delete(key)
    }

    setValue(key: string, value: any) {
        let child = this.children.get(key)!

        child.value = value

        if (child.index === Root) {
            this.value = value
        }
        else {
            this.value = Object.assign({}, this.value, { [child.index]: value })
        }
    }

    // Handle each published value from our children.
    receiveChangeFromChild(key: string, value) {
        // Was this called as part of a `subscribe` or `setProps` call
        // within `connect`?
        let isExpectingChange = this.expectingChildChangeFor === key

        if (!isExpectingChange && !this.emitter.dispatcher.isDispatching) {
            throw new Error(`A Govern component cannot receive new values from children outside of a dispatch.`)
        }

        // Mutatively update `value`
        this.setValue(key, value)

        // We don't need to `publish` if there is already one scheduled.
        if (!isExpectingChange && !this.isReceivingProps && !this.isDisposing) {
            this.publish()
        }
    }

    publish() {
        let shouldComponentPublish = true
        let shouldForcePublish =
            !this.previousPublish ||
            !this.lifecycle.shouldComponentPublish

        if (!shouldForcePublish) {
            let { props, state, value } = this.previousPublish
            this.pushFix()
            shouldComponentPublish = this.lifecycle.shouldComponentPublish!(props, state, value)
            this.popFix()
        }
        
        // Publish a new value based on the current props, state and value.
        if (shouldComponentPublish) {
            let publishedValue = this.value as any
            if (this.lifecycle.getPublishedValue) {
                this.pushFix()
                publishedValue = this.lifecycle.getPublishedValue() as any
                this.popFix()
            }
            this.emitter.publishAndReact(publishedValue)
            this.previousPublish = {
                props: this.props,
                state: this.state,
                value: this.value,
            }
        }
        else {
            // We still want to call lifecylce methods, even if nothing is
            // published.
            this.emitter.react()
        }
    }

    createObservableGovernor(initialDispatcher: Dispatcher): this {
        // Make sure to use `this.emitter.dispatcher` instead of the `_dispatcher`
        // argument, in case a new dispatcher was assigned during `connect`.
        this.emitter = initialDispatcher.createEmitter(this)

        if (this.lifecycle.constructor.getDerivedStateFromProps) {
            this.state = Object.assign({}, this.state, this.lifecycle.constructor.getDerivedStateFromProps(this.props, this.state))
        }

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
            if (this.lifecycle.componentDidMount) {
                this.pushFix()
                this.lifecycle.componentDidMount()
                this.popFix()
            }
        }
        else if (this.lifecycle.componentDidUpdate) {
            this.pushFix()
            this.lifecycle.componentDidUpdate!(
                this.lastUpdate.props,
                this.lastUpdate.state,
                this.lastUpdate.value
            )
            this.popFix()
        }

        this.lastUpdate = {
            props: this.props,
            state: this.state,
            value: this.value,
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


function getChildrenFromRenderedElement(element?: GovernElement<any, any>): { keys: string[], indexes: { [key: string]: string }, elements: { [key: string]: GovernElement<any, any> } } {
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
    else {
        return {
            keys: [Root],
            indexes: { [Root]: Root },
            elements: { [Root]: element }
        }
    }
}
