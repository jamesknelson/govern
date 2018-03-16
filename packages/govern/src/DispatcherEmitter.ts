import { Dispatcher } from './Dispatcher'
import { Subscription, closedSubscription } from './Subscription'
import { FlushTarget, PublishTarget } from './Target'
import { StoreGovernor } from './StoreGovernor';


export class DispatcherEmitter<T=any> {
    // This will be mutated by the dispactcher if it is ever merged into
    // another dispatcher, such that it will always refer to the correct
    // dispatcher.
    dispatcher: Dispatcher

    governor: StoreGovernor<T>
    hasError: boolean
    isStopped: boolean;
    flushTargets: FlushTarget<T>[]
    publishTargets: PublishTarget<T>[]
    thrownError: any
    value: T
    
    constructor(dispatcher: Dispatcher, governor: StoreGovernor<T>) {
        this.governor = governor
        this.dispatcher = dispatcher
        this.hasError = false
        this.isStopped = false

        this.flushTargets = []
        this.publishTargets = []
    }

    subscribePublishTarget(publishTarget: PublishTarget<T>): Subscription {
        if (this.hasError) {
            publishTarget.error(this.thrownError)
            return closedSubscription
        }

        // If dispatcher differs, then this dispatcher must be flushing, and a
        // different dispatcher has found this one in the process. So merge in
        // the argument dispatcher to this one, consuming its queue in the
        // process.
        if (publishTarget.emitter.dispatcher !== this.dispatcher) {
            this.dispatcher.mergeChild(publishTarget.emitter.dispatcher)
        }
        
        this.publishTargets.push(publishTarget)
        
        let subscription = new EmitterStoreSubscription(this, publishTarget)

        publishTarget.start(subscription)

        return subscription
    }

    subscribeFlushTarget(flushTarget: FlushTarget<T>): Subscription {
        if (this.hasError) {
            if (flushTarget.error) {
                flushTarget.error(this.thrownError)
            }
            return closedSubscription
        }
        if (this.isStopped) {
            if (flushTarget.complete) {
                flushTarget.complete()
            }
            return closedSubscription
        }

        this.flushTargets.push(flushTarget)
        
        let subscription = new EmitterFlushSubscription(this, flushTarget)

        this.dispatcher.registerPriority(this, flushTarget.priority)

        if (flushTarget.start) {
            flushTarget.start(subscription)
        }
        if (this.dispatcher.isDispatching && flushTarget.startDispatch) {
            flushTarget.startDispatch()
        }

        return subscription
    }

    dispose() {
        this.dispatcher.disposeEmitter(this)
    }

    getValue(): T {
        if (this.hasError) {
            throw this.thrownError
        } else {
            return this.value;
        }
    }

    flush(priority: string) {
        if (!this.isStopped) {
            let targets = this.flushTargets
            let len = targets.length
            let copy = targets.slice()
            for (let i = 0; i < len; i++) {
                let target = targets[i]
                if (target.priority === priority) {
                    copy[i].next(this.value, this.enqueueAction)
                }
            }
        }
    }

    enqueueAction = (fn: () => void) => {
        this.dispatcher.enqueueAction(fn)
    }

    publish(value: T) {
        if (!this.isStopped) {
            let targets = this.publishTargets
            let len = targets.length
            let copy = targets.slice()
            this.value = value
            this.dispatcher.registerPublish(this, len === 0)
            for (let i = 0; i < len; i++) {
                copy[i].next(value)
            }
        }
    }

    error(err?: any) {
        if (!this.isStopped) {
            this.hasError = true
            this.thrownError = err
            this.isStopped = true
            let targets = this.flushTargets.concat(this.publishTargets as any[])
            let len = targets.length
            let copy = targets.slice()
            for (let i = 0; i < len; i++) {
                let target = targets[i]
                if (target.error) {
                    target.error(err)
                }
            }
            this.flushTargets.length = 0
            this.publishTargets.length = 0
            this.dispatcher.disposeEmitter(this)
        }
    }

    complete() {
        if (!this.isStopped) {
            this.isStopped = true
            let targets = this.flushTargets.concat(this.publishTargets as any[])
            let len = targets.length
            let copy = targets.slice()
            for (let i = 0; i < len; i++) {
                let target = copy[i]
                // `complete` must be called within a dispatch. 
                if (target.endDispatch) {
                    target.endDispatch()
                }
                if (target.complete) {
                    target.complete()
                }
            }
            this.flushTargets.length = 0
            this.publishTargets.length = 0
            this.dispatcher.disposeEmitter(this)
            delete this.dispatcher
        }
    }

    startDispatch() {
        if (!this.isStopped) {
            let targets = this.flushTargets
            let len = targets.length
            let copy = targets.slice()

            for (let i = 0; i < len; i++) {
                let target = copy[i]
                if (target.startDispatch) {
                    target.startDispatch()
                }
            }
        }
    }

    endDispatch() {
        if (!this.isStopped) {
            let targets = this.flushTargets
            let len = targets.length
            let copy = targets.slice()
            for (let i = 0; i < len; i++) {
                let target = copy[i]
                if (target.endDispatch) {
                    target.endDispatch()
                }
            }
        }
    }
}


export class EmitterStoreSubscription implements Subscription {
    closed: boolean;
    emitter: DispatcherEmitter<any>
    
    protected target: PublishTarget<any>

    constructor(subject: DispatcherEmitter<any>, target: PublishTarget<any>) {
        this.closed = false
        this.emitter = subject
        this.target = target
    }

    // Cancels the subscription
    unsubscribe(): void {
        let i = this.emitter.publishTargets.indexOf(this.target)
        if (i !== -1) {
            this.emitter.publishTargets.splice(i, 1)
        }

        this.closed = true
    }
}

export class EmitterFlushSubscription implements Subscription {
    // A boolean value indicating whether the subscription is closed
    closed: boolean;

    protected emitter: DispatcherEmitter<any>
    protected target: FlushTarget<any>

    constructor(subject: DispatcherEmitter<any>, target: FlushTarget<any>) {
        this.closed = false
        this.emitter = subject
        this.target = target
    }

    // Cancels the subscription
    unsubscribe(): void {
        if (this.closed) {
            console.warn(`"unsubscribe" was called on a "Subscription" that is already closed.`)
            return
        }

        let i = this.emitter.flushTargets.indexOf(this.target)
        if (i !== -1) {
            this.emitter.flushTargets.splice(i, 1)
        }

        this.emitter.dispatcher.deregisterPriority(this.emitter, this.target.priority)
        
        this.closed = true
    }
}