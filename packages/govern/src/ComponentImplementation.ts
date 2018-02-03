import { isPlainObject } from './isPlainObject'
import { getDisplayName } from './Component'
import { ComponentLifecycle } from './ComponentLifecycle'
import { convertToElementIfPossible } from './convertToElementIfPossible'
import { doNodesReconcile } from './doNodesReconcile'
import { Governable, GovernableClass } from './Governable'
import { createGovernor, Governor } from './Governor'
import { TransactionalObservable, TransactionalObserver, Outlet, Subscription } from './Observable'
import { GovernNode } from './Core'
import { isValidElement } from './Element'

type Batch<P, S> = {
    setProps?: P,
    updaters?: ((prevState: Readonly<S>, props: P) => any)[],
    changes?: [string, any][],
}

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export class ComponentImplementation<P, S, C, O> {
    props: Readonly<P>;
    comp: Readonly<C>;
    state: Readonly<S>;

    callbacks: Function[];
    canDirectlySetComp: boolean
    children: {
        [name: string]: {
            node: any,
            subscription: Subscription,

            // A governor will not exist in the case of a `subscribe` element.
            governor?: Governor<any, any>
        }
    }

    // These are stored separately to children, as they may contain a symbol,
    // which doesn't appear in the result of Object.keys()
    childrenKeys: any[]
    currentBatch?: Batch<P, S>;
    governor?: Governor<P, O>
    isDisposed: boolean
    isComposing: boolean
    isStrict: boolean
    lifecycle: ComponentLifecycle<P, S, C, O>
    nextComp: any
    observers: TransactionalObserver<O>[]
    output: O;
    queue: Batch<P, S>[]
    subscriptions: WeakMap<TransactionalObserver<any>, Subscription>
    transactionLevel: number;

    constructor(lifecycle: ComponentLifecycle<P, S, C, O>, props: P, isStrict = false) {
        this.transactionLevel = 0
        this.callbacks = []
        this.canDirectlySetComp = false
        this.children = {}
        this.childrenKeys = []
        this.governor = undefined
        this.isDisposed = false
        this.isComposing = false
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
        let batch = (this.currentBatch && this.currentBatch.setProps) ? this.currentBatch : this.queue[0]
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

    dispose = () => {
        if (this.isDisposed) {
            throw new Error(`You cannot call "dispose" on a governor that has been already disposeed. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        this.isDisposed = true
        if (!this.transactionLevel) {
            this.increaseTransactionLevel()
            this.decreaseTransactionLevel()
        }
    }

    setProps = (props: P): void => {
        if (this.isDisposed) {
            throw new Error(`You cannot call "setProps" on a governor that has been already disposeed. See component "${getDisplayName(this.lifecycle.constructor)}".`)
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

        // Need to cache the comp in case `get` is called before any
        // other changes occur.
        this.performCompose()
        this.comp = this.nextComp
        this.output = this.lifecycle.render()

        if (this.lifecycle.componentDidInstantiate) {
            this.lifecycle.componentDidInstantiate()
        }

        let self = this
        this.governor = {
            getValue: this.getValue,
            getOutlet: () => ({
                subscribe: this.subscribe,
                getValue: this.getValue,
            }),

            setProps: this.setProps,
            dispose: this.dispose,
            subscribe: this.subscribe,
        }

        return this.governor
    }

    getValue = () => {
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

    performCompose() {
        if (this.lifecycle.compose) {
            this.canDirectlySetComp = true
            this.isComposing = true
            let composed = this.lifecycle.compose()
            if (composed === undefined) {
                console.warn(`The "${getDisplayName(this.lifecycle.constructor)}" component returned "undefined" from its compose method. If you really want to return an empty value, return "null" instead.`)
            }

            let nextChildrenKeys: string[]
            let nextChildNodes
            if (Array.isArray(composed)) {
                this.nextComp = []
                nextChildNodes = composed
                nextChildrenKeys = Object.keys(composed)
            }
            else if (isPlainObject(composed)) {
                this.nextComp = {}
                nextChildNodes = composed
                nextChildrenKeys = Object.keys(composed!)
            }
            else {
                nextChildNodes = { [Root]: composed }
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
                if (isValidElement(nextChildNode)) {
                    if (!doNodesReconcile(prevChild && prevChild.node, nextChildNode)) {
                        if (prevChild) {
                            // The old element is out of date, so we'll need to clean
                            // up the old child.
                            keysToRemove.add(key)
                        }

                        let governor: Governor<any, any> | undefined
                        let observable: TransactionalObservable<any>
                        if (nextChildNode.type === 'subscribe') {
                            observable = nextChildNode.props.to
                        }
                        else {
                            governor = createGovernor(nextChildNode)
                            observable = governor
                        }

                        // Govern components will immediately emit their current value
                        // on subscription, ensuring that comp is updated.
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
                    else if (nextChildNode.type !== 'subscribe') {
                        // If `setProps` causes a change in comp, it will
                        // immediately be emitted to the observer.
                        prevChild.governor!.setProps(nextChildNode.props)
                    }
                    else {
                        // Subscribes won't emit a new value, so we need to manually 
                        // carry over the previous value to the next.
                        if (key === Root) {
                            this.nextComp = this.comp
                        }
                        else {
                            this.nextComp[key] = this.comp[key]
                        }
                    }
                }
                else {
                    keysToRemove.add(key)
                    delete nextChildren[key]
                    this.setComp(key, nextChildNode)
                }
            }

            // Clean up after any previous children that are no longer being
            // composed.
            let keysToRemoveArray = Array.from(keysToRemove)
            for (let i = 0; i < keysToRemoveArray.length; i++) {
                let key = keysToRemoveArray[i]
                let prevChild = this.children[key]
                if (prevChild) {
                    prevChild.subscription.unsubscribe()
                    if (prevChild.governor) {
                        prevChild.governor.dispose()
                    }
                }
                delete this.children[key]
            }

            this.children = nextChildren
            this.childrenKeys = nextChildrenKeys
            this.canDirectlySetComp = false
            this.isComposing = false
        }
    }

    setComp(key: string | Symbol, value: any) {
        if (key === Root) {
            this.nextComp = value
        }
        else {
            this.nextComp[key as any] = value
        }
    }

    subscribe = (
        onNextOrObserver: TransactionalObserver<O> | ((value: O) => void),
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

        let observer: TransactionalObserver<O> =
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
            
            if (this.isDisposed) {
                for (let i = 0; i < this.childrenKeys.length; i++) {
                    let key = this.childrenKeys[i]
                    let child = this.children[key]

                    if (child) {
                        child.subscription.unsubscribe()
                        if (child.governor) {
                            child.governor.dispose()
                        }
                        delete this.children[key]
                    }
                }

                if (this.lifecycle.componentWillBeDisposed) {
                    this.lifecycle.componentWillBeDisposed()
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
        let batch: Batch<P, S> | undefined = this.queue.shift()
        while (batch) {
            let prevProps = this.props
            let prevState = this.state
            let prevComp = this.comp

            this.currentBatch = batch
            
            if (batch.updaters || batch.setProps) {
                if (batch.setProps && this.lifecycle.componentWillReceiveProps) {
                    this.canDirectlySetComp = true
                    this.lifecycle.componentWillReceiveProps(batch.setProps)
                    this.canDirectlySetComp = false
                }

                if (batch.setProps) {
                    this.props = batch.setProps

                    // enqueueSetState checks for existence of `setProps` to
                    // see whether it is allowed to add state updates to the
                    // current batch.
                    delete batch.setProps
                }

                let updaters = batch.updaters || []
                for (let i = 0; i < updaters.length; i++) {
                    let updater = updaters[i]
                    Object.assign(this.state, updater(this.state, this.props))
                }

                this.performCompose()
            }
            else if (batch.changes) {
                // The batch was triggered by an update from a child, so
                // we don't need to re-compose the whole thing.
                for (let i = 0; i < batch.changes.length; i++) {
                    let [key, comp] = batch.changes[i]
                    this.setComp(key, comp)
                }
            }
            this.comp = this.nextComp

            if (!this.lifecycle.shouldComponentUpdate ||
                this.lifecycle.shouldComponentUpdate(prevProps, prevState, prevComp)) {
               this.output = this.lifecycle.render()
               for (let i = 0; i < this.observers.length; i++) {
                   this.observers[i].next(this.output)
               }
            }

            if (this.lifecycle.componentDidUpdate) {
                this.lifecycle.componentDidUpdate(prevProps, prevState, prevComp)
            }

            batch = this.queue.shift()
        }
        delete this.currentBatch

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
    
    handleChildChange(key: string, value) {
        if (this.canDirectlySetComp) {
            // If we're currently composing, or within
            // componentWillReceiveProps, then we know that the comp will
            // be updated immediately after the compose is complete, so we don't
            // need to use the queue.
            this.setComp(key, value)
        }
        else {
            // If we're dealing with subscribed observables from other libraries,
            // changes may not be batched.
            let isIndividualChange = this.transactionLevel === 0
            if (isIndividualChange) {
                this.increaseTransactionLevel()
            }

            if (this.queue.length === 0) {
                this.queue.push({
                    changes: [[key, value]]
                })
            }
            else {
                let changes = this.queue[0].changes
                if (!changes) {
                    this.queue[0].changes = changes = []
                }
                changes.push([key, value])
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
