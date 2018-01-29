import { isPlainObject } from './isPlainObject'
import { getDisplayName } from './Component'
import { convertToElementIfPossible } from './convertToElementIfPossible'
import { doNodesReconcile } from './doNodesReconcile'
import { Governable, GovernableClass } from './Governable'
import { createGovernor, Governor } from './Governor'
import { Observable, Observer, Subscription } from './Observable'
import { GovernNode } from './Core'
import { GovernElement } from './Element'

type Batch<P, O, S> = {
    setProps?: P,
    updaters?: ((prevState: Readonly<S>, props: P) => any)[],
    changes?: [string, any][],
}

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentLifecycle<P, O, S> {
    componentWillReceiveProps?(nextProps: P);
    componentWillBeDestroyed?();
    componentDidInstantiate?();
    componentDidUpdate?(prevProps: P, prevState: S, prevOutput: O);

    shouldComponentEmit?(prevProps: P, prevState: S, prevOutput: O);

    render(): GovernNode<O> | null;
}

export class ComponentImplementation<P, O, S> {
    props: Readonly<P>;
    output: Readonly<O>;
    state: Readonly<S>;

    transactionInitialProps: P;
    transactionInitialOutput: O;
    transactionInitialState: S;
    transactionLevel: number;
    callbacks: Function[];
    children: {
        [name: string]: {
            node: any,
            subscription: Subscription,

            // A governor will not exist in the case of a `sink` element.
            governor?: Governor<any, any>
        }
    }

    // These are stored separately to children, as they may contain a symbol,
    // which doesn't appear in the result of Object.keys()
    childrenKeys: any[]

    governor?: Governor<P, O>
    isDestroyed: boolean
    canDirectlySetOutput: boolean
    isStrict: boolean
    lastRender: any
    lifecycle: ComponentLifecycle<P, O, S>
    nextOutput: any
    observers: Observer<O>[]
    queue: Batch<P, O, S>[]
    subscriptions: WeakMap<Observer<any>, Subscription>

    constructor(lifecycle: ComponentLifecycle<P, O, S>, props: P, isStrict = false) {
        this.transactionLevel = 0
        this.callbacks = []
        this.canDirectlySetOutput = false
        this.children = {}
        this.childrenKeys = []
        this.governor = undefined
        this.isDestroyed = false
        this.isStrict = isStrict
        this.lifecycle = lifecycle
        this.observers = []
        this.props = props
        this.queue = []
        this.subscriptions = new WeakMap()
    }

    enqueueSetState(updater: (prevState: Readonly<S>, props: P) => any, callback?: Function) {
        if (this.isStrict && this.transactionLevel === 0) {
            throw new Error(`You cannot call "setState" outside of an action within a StrictComponent. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }

        this.increaseTransactionLevel()
        let batch = this.queue[0]
        if (!batch) {
            batch = { updaters: [] }
            this.queue.push(batch)
        }
        if (!batch.updaters) {
            batch.updaters = []
        }
        batch.updaters.push(updater)
        if (callback) {
            this.callbacks.push(callback)
        }
        this.decreaseTransactionLevel()
    }

    destroy = () => {
        if (this.isDestroyed) {
            throw new Error(`You cannot call "destroy" on a governor that has been already destroyed. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        this.isDestroyed = true
        if (!this.transactionLevel) {
            this.increaseTransactionLevel()
            this.decreaseTransactionLevel()
        }
    }

    setProps = (props: P): void => {
        if (this.isDestroyed) {
            throw new Error(`You cannot call "setProps" on a governor that has been already destroyed. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        this.increaseTransactionLevel()
        this.queue.push({
            setProps: props,
        })
        this.decreaseTransactionLevel()
    }

    createGovernor(): Governor<P, O> {
        if (this.governor) {
            throw new Error('You cannot create multiple governors for a single Component')
        }

        // Need to cache the output in case `get` is called before any
        // other changes occur.
        this.performRender()
        this.output = this.nextOutput

        if (this.lifecycle.componentDidInstantiate) {
            this.lifecycle.componentDidInstantiate()
        }

        this.governor = {
            get: this.shallowCloneOutput,

            getObservable: () => ({
                subscribe: this.subscribe,
                get: this.shallowCloneOutput,
            }),

            setProps: this.setProps,
            destroy: this.destroy,
            subscribe: this.subscribe,
        }

        return this.governor
    }

    shallowCloneOutput = () => {
        // Return a shallow clone, to prevent accidental mutations
        // of internal state.
        if (Array.isArray(this.output)) {
            return this.output.slice(0) as any
        }
        else if (isPlainObject(this.output)) {
            return Object.assign({}, this.output)
        }
        else {
            return this.output
        }
    }

    performRender() {
        this.canDirectlySetOutput = true
        let rendered = this.lifecycle.render()
        if (rendered === undefined) {
            console.warn(`The "${getDisplayName(this.lifecycle.constructor)}" component returned "undefined" from its render method. If you really want to return an empty value, return "null" instead.`)
        }

        let nextChildrenKeys: string[]
        let nextChildNodes
        this.lastRender = rendered
        if (Array.isArray(rendered)) {
            this.nextOutput = []
            nextChildNodes = rendered
            nextChildrenKeys = Object.keys(rendered)
        }
        else if (isPlainObject(rendered)) {
            this.nextOutput = {}
            nextChildNodes = rendered
            nextChildrenKeys = Object.keys(rendered)
        }
        else {
            nextChildNodes = { [Root]: rendered }
            nextChildrenKeys = [Root]
        }

        let keysToRemove = new Set(this.childrenKeys)
        let nextChildren = {}
        for (let i = 0; i < nextChildrenKeys.length; i++) {
            let key = nextChildrenKeys[i]
            let prevChild = this.children[key]
            let nextChildNode = convertToElementIfPossible(nextChildNodes[key])
            keysToRemove.delete(key)
            nextChildren[key] = this.children[key]
            if (nextChildNode instanceof GovernElement) {
                if (!doNodesReconcile(prevChild && prevChild.node, nextChildNode)) {
                    if (prevChild) {
                        // The old element is out of date, so we'll need to clean
                        // up the old child.
                        keysToRemove.add(key)
                    }

                    let governor: Governor<any, any> | undefined
                    let observable: Observable<any>
                    if (nextChildNode.type === 'sink') {
                        observable = nextChildNode.props.observable
                    }
                    else {
                        governor = createGovernor(nextChildNode)
                        observable = governor
                    }

                    // Govern components will immediately emit their current value
                    // on subscription, ensuring that output is updated.
                    let subscription = observable.subscribe(
                        value => this.handleChildChange(key, value),
                        this.handleChildError,
                        this.handleChildComplete,
                        this.increaseTransactionLevel,
                        this.decreaseTransactionLevel,
                    )

                    nextChildren[key] = {
                        node: nextChildNode,
                        subscription: subscription,
                        governor: governor,
                    }
                }
                else if (nextChildNode.type !== 'sink') {
                    // If `setProps` causes a change in output, it will
                    // immediately be emitted to the observer.
                    let governor = (prevChild as any).governor as Governor<any, any>
                    governor.setProps(nextChildNode.props)
                }
                else {
                    // Sinks won't emit a new value, so we need to manually 
                    // carry over the previous value to the next.
                    if (key === Root) {
                        this.nextOutput = this.output
                    }
                    else {
                        this.nextOutput[key] = this.output[key]
                    }
                }
            }
            else {
                keysToRemove.add(key)
                delete nextChildren[key]
                this.setOutput(key, nextChildNode)
            }
        }

        // Clean up after any previous children that are no longer being
        // rendered.
        let keysToRemoveArray = Array.from(keysToRemove)
        for (let i = 0; i < keysToRemoveArray.length; i++) {
            let key = keysToRemoveArray[i]
            let prevChild = this.children[key]
            if (prevChild) {
                prevChild.subscription.unsubscribe()
                if (prevChild.governor) {
                    prevChild.governor.destroy()
                }
            }
            delete this.children[key]
        }

        this.children = nextChildren
        this.childrenKeys = nextChildrenKeys
        this.canDirectlySetOutput = false
    }

    setOutput(key: string | Symbol, value: any) {
        if (key === Root) {
            this.nextOutput = value
        }
        else {
            this.nextOutput[key as any] = value
        }
    }

    subscribe = (
        onNextOrObserver: Observer<O> | ((value: O) => void),
        onError?: (error: any) => void,
        onComplete?: () => void,
        onTransactionStart?: () => void,
        onTransactionEnd?: () => void
    ): Subscription => {
        let unsubscribe = () => {
            let index = this.observers.indexOf(observer)
            if (index !== -1) {
                this.observers.splice(index, 1)
            }
            subscription.closed = true
        }

        let subscription = {
            unsubscribe,
            closed: false
        }

        let observer: Observer<O> =
            typeof onNextOrObserver !== 'function'
                ? onNextOrObserver
                : { next: onNextOrObserver,
                    error: onError,
                    complete: onComplete,
                    transactionStart: onTransactionStart, 
                    transactionEnd: onTransactionEnd }
                    
        this.observers.push(observer)
        this.subscriptions.set(observer, subscription)
        
        // Emit the current value on subscription, without emitting a transaction
        observer.next(this.output)

        return subscription
    }
    
    increaseTransactionLevel = () => {
        if (++this.transactionLevel === 1) {
            this.transactionInitialProps = this.props
            this.transactionInitialOutput = this.output
            this.transactionInitialState = this.state

            for (let i = 0; i < this.observers.length; i++) {
                let observer = this.observers[i]
                if (observer.transactionStart) {
                    observer.transactionStart()
                }
            }
        }
    }
    
    decreaseTransactionLevel = () => {
        if (this.transactionLevel === 1) {
            this.processQueue()
            
            if (this.isDestroyed) {
                for (let i = 0; i < this.childrenKeys.length; i++) {
                    let key = this.childrenKeys[i]
                    let child = this.children[key]

                    if (child) {
                        child.subscription.unsubscribe()
                        if (child.governor) {
                            child.governor.destroy()
                        }
                        delete this.children[key]
                    }
                }

                if (this.lifecycle.componentWillBeDestroyed) {
                    this.lifecycle.componentWillBeDestroyed()
                }

                for (let i = 0; i < this.observers.length; i++) {
                    let observer = this.observers[i]
                    if (observer.complete) {
                        observer.complete()
                    }
                }

                this.observers.length = 0
                this.state = {} as any
            }
        }
        this.transactionLevel -= 1
    }

    processQueue() {
        let batch: Batch<P, O, S> | undefined = this.queue.shift()
        let queueIsEmpty = !batch
        while (batch) {
            let prevProps = this.props
            let prevState = this.state
            let prevOutput = this.output

            if (batch.updaters || batch.setProps) {
                if (batch.setProps && this.lifecycle.componentWillReceiveProps) {
                    this.canDirectlySetOutput = true
                    this.lifecycle.componentWillReceiveProps(batch.setProps)
                    this.canDirectlySetOutput = false
                }
                let updaters = batch.updaters || []
                for (let i = 0; i < updaters.length; i++) {
                    let updater = updaters[i]
                    Object.assign(this.state, updater(this.state, this.props))
                }

                if (batch.setProps) {
                    this.props = batch.setProps
                }

                this.performRender()
            }
            else if (batch.changes) {
                // The batch was triggered by an update from a child, so
                // we don't need to re-render the whole thing.
                for (let i = 0; i < batch.changes.length; i++) {
                    let [key, output] = batch.changes[i]
                    this.setOutput(key, output)
                }
            }
            this.output = this.nextOutput

            if (this.lifecycle.componentDidUpdate) {
                this.lifecycle.componentDidUpdate(prevProps, prevState, prevOutput)
            }

            batch = this.queue.shift()
        }

        if (!queueIsEmpty &&
            (!this.lifecycle.shouldComponentEmit ||
                this.lifecycle.shouldComponentEmit(this.transactionInitialProps, this.transactionInitialState, this.transactionInitialOutput))) {
            for (let i = 0; i < this.observers.length; i++) {
                this.observers[i].next(this.output)
            }
        }

        for (let i = 0; i < this.observers.length; i++) {
            let observer = this.observers[i]
            if (observer.transactionEnd) {
                observer.transactionEnd()
            }
        }

        while (this.callbacks.length) {
            let callback = this.callbacks.shift() as Function
            callback()
        }

        if (this.queue.length) {
            this.processQueue()
        }
    }
    
    handleChildChange(key: string, output) {
        if (this.canDirectlySetOutput) {
            // If we're currently rendering, or within
            // componentWillReceiveProps, then we know that the output will
            // be updated immediately after the render is complete, so we don't
            // need to use the queue.
            this.setOutput(key, output)
        }
        else {
            // If we're dealing with sinked observables from other libraries,
            // changes may not be batched.
            let isIndividualChange = this.transactionLevel === 0
            if (isIndividualChange) {
                this.increaseTransactionLevel()
            }

            if (this.queue.length === 0) {
                this.queue.push({
                    changes: [[key, output]]
                })
            }
            else {
                let changes = this.queue[0].changes
                if (!changes) {
                    this.queue[0].changes = changes = []
                }
                changes.push([key, output])
            }

            if (isIndividualChange) {
                this.decreaseTransactionLevel()
            }
        }
    }

    handleChildError = (error) => {
        // TODO: componentDidCatch
        let wasErrorHandled = false
        for (let i = 0; i < this.observers.length; i++) {
            let observer = this.observers[i]
            if (observer.error) {
                wasErrorHandled = true
                observer.error(error)
            }
        }
        if (!wasErrorHandled) {
            console.error(`An unhandled error was caught within component "${getDisplayName(this.lifecycle.constructor)}".`)
            throw error
        }
    }

    handleChildComplete() {
        // noop
    }
}
