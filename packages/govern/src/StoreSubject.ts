/**
 * This is based on RxJS's BehaviorSubject, and its underlying classes.
 * https://github.com/ReactiveX/rxjs/blob/master/src/internal/BehaviorSubject.ts
 */

import { Target, TargetClosedError } from './Target'
import { closedSubscription, Subscription } from './Subscription'

export class StoreSubject<T> {
    dispatch: (runner: () => void) => void
    hasError: boolean
    isStopped: boolean;
    subscriptionsToSources: Subscription[]
    subscribedTargets: Target<T>[]
    thrownError: any
    transactionHasBroadcast: boolean
    transactionId?: string
    transactionSourceTarget?: Target<any>
    value: T
    
    constructor(dispatch: (runner: () => void) => void) {
        this.dispatch = dispatch
        this.hasError = false
        this.isStopped = false
        this.subscriptionsToSources = []
        this.subscribedTargets = []
        this.transactionHasBroadcast = false
    }

    // A relay is a source, so it is possible to subscribe new targets to the
    // relay. These targets can indicate that they'd like to close their
    // subscription.
    subscribe(target: Target<T>): Subscription {
        if (this.hasError) {
            target.error(this.thrownError)
            return closedSubscription
        }
        if (this.isStopped) {
            target.complete()
            return closedSubscription
        }
        
        this.subscribedTargets.push(target)
        
        let subscription = new StoreSubjectSubscription(this, target)

        target.start(subscription)

        if (this.transactionId && this.transactionSourceTarget !== target && this.transactionHasBroadcast) {
            target.transactionStart(this.transactionId)
        }

        target.next(this.value, this.dispatch)

        return subscription
    }

    getValue(): T {
        if (this.hasError) {
            throw this.thrownError
        } else {
            return this.value;
        }
    }

    next(value: T) {
        if (!this.isStopped) {
            this.value = value

            let targets = this.subscribedTargets
            let len = targets.length
            let copy = targets.slice()

            if (!this.transactionHasBroadcast && this.transactionId) {
                this.transactionHasBroadcast = true

                for (let i = 0; i < len; i++) {
                    let target = copy[i]
                    if (target !== this.transactionSourceTarget) {
                        copy[i].transactionStart(this.transactionId)
                    }
                }
            }

            for (let i = 0; i < len; i++) {
                copy[i].next(value, this.dispatch)
            }
        }
    }

    error(err?: any) {
        if (!this.isStopped) {
            this.hasError = true
            this.thrownError = err
            this.isStopped = true
            let targets = this.subscribedTargets
            const len = targets.length
            const copy = targets.slice()
            for (let i = 0; i < len; i++) {
                copy[i].error(err)
            }
            this.subscribedTargets.length = 0
        }
    }

    complete() {
        if (this.transactionId) {
            this.error(new InTransactionError())
            return 
        }

        if (!this.isStopped) {
            this.isStopped = true
            let targets = this.subscribedTargets
            const len = targets.length
            const copy = targets.slice()
            for (let i = 0; i < len; i++) {
                copy[i].complete()
            }
            this.subscribedTargets.length = 0
        }
    }

    transactionStart(transactionId: string, sourceTarget: Target<any> | undefined) {
        if (this.transactionId) {
            this.error(new InTransactionError())
            return 
        }

        this.transactionHasBroadcast = false
        this.transactionId = transactionId
        this.transactionSourceTarget = sourceTarget
    }

    transactionEnd(transactionId: string) {
        if (!this.transactionId) {
            this.error(new OutOfTransactionError())
            return 
        }

        let sourceTarget = this.transactionSourceTarget

        delete this.transactionId
        delete this.transactionSourceTarget

        if (!this.isStopped && this.transactionHasBroadcast) {
            let targets = this.subscribedTargets
            const len = targets.length
            const copy = targets.slice()
            for (let i = 0; i < len; i++) {
                let target = copy[i]
                if (target !== sourceTarget) {
                    copy[i].transactionEnd(transactionId)
                }
            }
        }

        this.transactionHasBroadcast = false
    }
}


export class InTransactionError extends Error {
    constructor() {
        super('in transaction');
        this.name = 'InTransactionError';
        (Object as any).setPrototypeOf(this, InTransactionError.prototype);
    }
}

export class OutOfTransactionError extends Error {
    constructor() {
        super('out of transaction');
        this.name = 'OutOfTransactionError';
        (Object as any).setPrototypeOf(this, OutOfTransactionError.prototype);
    }
}


export class StoreSubjectSubscription implements Subscription {
    // A boolean value indicating whether the subscription is closed
    closed: boolean;

    protected subject: StoreSubject<any>
    protected target: Target<any>

    constructor(subject: StoreSubject<any>, target: Target<any>) {
        this.closed = false
        this.subject = subject
        this.target = target
    }

    // Cancels the subscription
    unsubscribe(): void {
        if (this.closed) {
            console.warn(`"unsubscribe" was called on a "Subscription" that is already closed.`)
            return
        }

        let i = this.subject.subscribedTargets.indexOf(this.target)
        if (i !== -1) {
            this.subject.subscribedTargets.splice(i, 1)
        }
        
        this.closed = true
    }
}
