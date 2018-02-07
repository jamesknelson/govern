import { Outlet, OutletSubject, Subscription, TransactionalObservable, TransactionalObserver } from 'outlets'
import { isPlainObject } from './isPlainObject'
import { Component, getDisplayName } from './Component'
import { doNodesReconcile } from './doNodesReconcile'
import { isValidElement } from './Element'
import { Governable, GovernableClass } from './Governable'
import { createGovernor, Governor } from './Governor'

type Batch<Props, State> = {
    setProps?: Props,
    updaters?: ((prevState: Readonly<State>, props: Props) => any)[],
    changes?: [string, any][],
}

// A symbol used to represent a child node that isn't within an object or
// array. It is typed as a string, as TypeScript doesn't yet support indexing
// on symbols.
const Root: string = Symbol('root') as any

export interface ComponentImplementationLifecycle<Props={}, State={}, Value=any, Subs=any> {
    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: Props);
    subscribe?(): any;
    shouldComponentUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    getValue(): Value;
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    componentWillBeDisposed?();
}

export class ComponentImplementation<Props, State, Value, Subs> {
    props: Readonly<Props>;
    state: Readonly<State>;
    subs: Subs;

    callbacks: Function[];
    canDirectlySetSubs: boolean
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
    currentBatch?: Batch<Props, State>;
    governor?: Governor<Props, Value>
    isDisposed: boolean
    isPerformingSubscribe: boolean
    isStrict: boolean
    lastCombinedType?: 'array' | 'object'
    lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>
    queue: Batch<Props, State>[]
    subject: OutletSubject<Value>;
    transactionLevel: number;

    constructor(lifecycle: ComponentImplementationLifecycle<Props, State, Value, Subs>, props: Props, isStrict = false) {
        this.transactionLevel = 0
        this.callbacks = []
        this.canDirectlySetSubs = false
        this.children = {}
        this.childrenKeys = []
        this.governor = undefined
        this.isDisposed = false
        this.isPerformingSubscribe = false
        this.isStrict = isStrict
        this.lifecycle = lifecycle
        this.props = props
        this.queue = []
    }

    enqueueSetState(updater: (prevState: Readonly<State>, props: Props) => any, callback?: Function) {
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

    setProps = (props: Props): void => {
        if (this.isDisposed) {
            throw new Error(`You cannot call "setProps" on a governor that has been already disposeed. See component "${getDisplayName(this.lifecycle.constructor)}".`)
        }
        this.increaseTransactionLevel()
        this.queue.push({
            setProps: props,
        })
        this.decreaseTransactionLevel()
    }

    createGovernor(): Governor<Props, Value> {
        if (this.governor) {
            throw new Error('You cannot create multiple governors for a single Component')
        }

        // Need to cache the value in case `get` is called before any
        // other changes occur.
        this.performSubscribe()
        this.subject = new OutletSubject(this.lifecycle.getValue())

        let outlet = new Outlet(this.subject)
        this.governor = Object.assign(outlet, {
            getOutlet: () => new Outlet(this.subject),
            setProps: this.setProps,
            dispose: this.dispose,
        })
        
        if (this.lifecycle.componentDidInstantiate) {
            this.lifecycle.componentDidInstantiate()
        }

        return this.governor
    }

    performSubscribe() {
        if (this.lifecycle.subscribe) {
            this.canDirectlySetSubs = true
            this.isPerformingSubscribe = true
            let element = this.lifecycle.subscribe()
            if (element === undefined) {
                console.warn(`The "${getDisplayName(this.lifecycle.constructor)}" component returned "undefined" from its subscribe method. If you really want to return an empty value, return "null" instead.`)
            }
            else if (this.lifecycle instanceof Component && element !== null && !isValidElement(element)) {
                throw new Error(`You must return an element from "subscribe", but instead received a "${typeof element}". See component "${getDisplayName(this.lifecycle.constructor)}".`)
            }

            // element has changed type
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
                        
                    nextChildNodes = element.props.children
                    nextChildrenKeys = Object.keys(element.props.children)
                }
                else if (isPlainObject(element.props.children)) {
                    if (this.lastCombinedType !== 'object') {
                        this.lastCombinedType = 'object'
                        this.subs = {} as any
                        forceFullUpdate = true
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
                            governor = createGovernor(nextChildNode)
                            observable = governor
                        }

                        // Outlets will immediately emit their current value
                        // on subscription, ensuring that `subs` is updated.
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
                    else {
                        // Keep around the previous child, and update it if
                        // necessary
                        childrenToDisposeKeys.delete(key)
                        if (nextChildNode.type !== 'subscribe') {
                            prevChild.governor!.setProps(nextChildNode.props)
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
                        prevChild.governor.dispose()
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
            this.canDirectlySetSubs = false
            this.isPerformingSubscribe = false
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
    
    increaseTransactionLevel = () => {
        if (++this.transactionLevel === 1) {
            this.subject.transactionStart()
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

                this.subject.complete()
                this.state = {} as any
            }
        }
        this.transactionLevel -= 1
    }

    processQueue() {
        let batch: Batch<Props, State> | undefined = this.queue.shift()
        while (batch) {
            let prevProps = this.props
            let prevState = Object.assign({}, this.state)
            let prevSubs = Object.assign({}, this.subs)

            this.currentBatch = batch

            if (batch.changes) {
                for (let i = 0; i < batch.changes.length; i++) {
                    let [key, subs] = batch.changes[i]
                    this.setSubs(key, subs)
                }
            }
            
            if (batch.updaters || batch.setProps) {
                if (batch.setProps && this.lifecycle.componentWillReceiveProps) {
                    this.canDirectlySetSubs = true
                    this.lifecycle.componentWillReceiveProps(batch.setProps)
                    this.canDirectlySetSubs = false
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
                    Object.assign(this.state || {}, updater(this.state, this.props))
                }

                this.performSubscribe()
            }

            if (!this.lifecycle.shouldComponentUpdate ||
                this.lifecycle.shouldComponentUpdate(prevProps, prevState, prevSubs)
            ) {
                this.subject.next(this.lifecycle.getValue())
                if (this.lifecycle.componentDidUpdate) {
                    this.lifecycle.componentDidUpdate(prevProps, prevState, prevSubs)
                }
            }

            batch = this.queue.shift()
        }
        delete this.currentBatch

        this.subject.transactionEnd()

        while (this.callbacks.length) {
            let callback = this.callbacks.shift() as Function
            callback()
        }

        if (this.queue.length) {
            this.processQueue()
        }
    }
    
    handleChildChange(key: string, value) {
        if (this.canDirectlySetSubs) {
            // If we're currently performing a `subscribe`, or within
            // componentWillReceiveProps, then we know that the subs will
            // be updated immediately after the subscribe is complete, so we don't
            // need to use the queue.
            this.setSubs(key, value)
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
        this.subject.error(error)
    }

    handleChildComplete() {
        // noop
    }
}
