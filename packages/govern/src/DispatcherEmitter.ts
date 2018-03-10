import { Dispatcher } from './Dispatcher'
import { Subscription, closedSubscription } from './Subscription'
import { FlushTarget, PublishTarget } from './Target'
import { StoreGovernor } from './StoreGovernor';


export class DispatcherEmitter<T=any> {
    dispatcher: Dispatcher
    governor: StoreGovernor<T>
    hasError: boolean
    isStopped: boolean;
    flushTargets: FlushTarget<T>[]
    publishTargets: PublishTarget<T>[]
    thrownError: any
    value: T
    
    constructor(dispatcher: Dispatcher, governor: StoreGovernor<T>, initialValue: T) {
        this.dispatcher = dispatcher
        this.governor = governor
        this.hasError = false
        this.isStopped = false
        this.value = initialValue

        this.flushTargets = []
        this.publishTargets = []
    }

    // todo:
    // - add 'dispatcher' as second param
    // - if dispatcher differs, then this dispatcher must be flushing, and a
    //   different dispatcher has found this one in the process. So merge in
    //   the argument dispatcher to this one, consuming its queue in the process.
    subscribePublishTarget(publishTarget: PublishTarget<T>): Subscription {
        if (this.hasError) {
            publishTarget.error(this.thrownError)
            return closedSubscription
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
                    copy[i].next(this.value, this.dispatcher.enqueueAction)
                }
            }
        }
    }

    publish(value: T) {
        if (!this.isStopped) {
            this.value = value
            this.dispatcher.registerPublish(this)
            let targets = this.publishTargets
            let len = targets.length
            let copy = targets.slice()
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
        if (this.dispatcher.isDispatching) {
            this.error(new InTransactionError())
            return 
        }

        if (!this.isStopped) {
            this.isStopped = true
            let targets = this.flushTargets.concat(this.publishTargets as any[])
            let len = targets.length
            let copy = targets.slice()
            for (let i = 0; i < len; i++) {
                let target = copy[i]
                if (target.complete) {
                    target.complete()
                }
            }
            this.flushTargets.length = 0
            this.publishTargets.length = 0
            this.dispatcher.disposeEmitter(this)
        }
    }

    transactionStart() {
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

    transactionEnd() {
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

export class InTransactionError extends Error {
    constructor() {
        super('in transaction');
        this.name = 'InTransactionError';
        (Object as any).setPrototypeOf(this, InTransactionError.prototype);
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