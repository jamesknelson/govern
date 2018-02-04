/**
 * This is based on RxJS's BehaviorSubject, and its underlying classes.
 * https://github.com/ReactiveX/rxjs/blob/master/src/internal/BehaviorSubject.ts
 */

import { Target, TargetClosedError } from './Target'
import { OutletSource } from './OutletSource'
import { closedSubscription, ClosableSubscription, Subscription } from './Subscription'

export class OutletSubject<T> extends Target<T> implements OutletSource<T> {
    closed: boolean
    
    protected hasError: boolean
    protected isStopped: boolean;
    protected subscriptionsToSources: Subscription[]
    protected subscribedTargets: Target<T>[]
    protected thrownError: any
    protected transactionLevel: number
    protected value: T
    
    constructor(initialValue: T) {
        super()

        this.hasError = false
        this.isStopped = false
        this.subscriptionsToSources = []
        this.subscribedTargets = []
        this.transactionLevel = 0
        this.value = initialValue
    }

    // A relay is a source, so it is possible to subscribe new targets to the
    // relay. These targets can indicate that they'd like to close their
    // subscription.
    subscribe(target: Target<T>): Subscription {
        if (this.closed) {
            return closedSubscription
        }
        if (this.hasError) {
            target.error(this.thrownError)
            return closedSubscription
        }
        if (this.isStopped) {
            target.complete()
            return closedSubscription
        }
        
        this.subscribedTargets.push(target)
        
        let subscription = new ClosableSubscription(() => {
            let i = this.subscribedTargets.indexOf(target)
            if (i !== -1) {
                this.subscribedTargets.splice(i, 1)
            }
        })

        target.start(subscription)

        if (this.transactionLevel) {
            target.transactionStart()
        }

        this.next(this.value)

        return subscription
    }

    getValue(): T {
        if (this.hasError) {
            throw this.thrownError
        } else if (this.closed) {
            throw new TargetClosedError()
        } else {
            return this.value;
        }
    }

    // When this relay is subscribed to a source as a target, this will be
    // called with the new subscription object, allowing this target to
    // unsubscribe from the source.
    start(subscription: Subscription) {
        if (this.closed) {
            throw new TargetClosedError()
        }

        this.subscriptionsToSources.push(subscription)
    }

    next(value: T) {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped) {
            this.value = value

            let targets = this.subscribedTargets
            let len = targets.length
            let copy = targets.slice()
            for (let i = 0; i < len; i++) {
                copy[i].next(value)
            }
        }
    }

    error(err?: any) {
        if (this.closed) {
            throw new TargetClosedError()
        }

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
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (this.transactionLevel !== 0) {
            this.error(new OutOfTransactionError())
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

    transactionStart() {
        if (this.closed) {
            throw new TargetClosedError()
        }

        ++this.transactionLevel

        if (!this.isStopped && this.transactionLevel === 1) {
            let targets = this.subscribedTargets
            const len = targets.length
            const copy = targets.slice()
            for (let i = 0; i < len; i++) {
                copy[i].transactionStart()
            }
        }
    }

    transactionEnd() {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (this.transactionLevel === 0) {
            this.error(new OutOfTransactionError())
            return 
        }

        --this.transactionLevel

        if (!this.isStopped && this.transactionLevel === 0) {
            let targets = this.subscribedTargets
            const len = targets.length
            const copy = targets.slice()
            for (let i = 0; i < len; i++) {
                copy[i].transactionEnd()
            }
        }
    }
}

export class OutOfTransactionError extends Error {
    constructor() {
        super('out of transaction');
        this.name = 'OutOfTransactionError';
        (Object as any).setPrototypeOf(this, OutOfTransactionError.prototype);
    }
}