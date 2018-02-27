import { ComponentImplementation } from './ComponentImplementation'
import { Subscription } from './Subscription'
import { Target } from './Target'

const noop = () => {}

// Use a custom Target class for parent components without the sanity checks.
// This cleans up a number of transactionStart/transactionEnd/next calls from
// stack traces, and also prevents significant unnecessary work.
export class ComponentTarget<T> extends Target<T> {
    impl: ComponentImplementation<any, any, any, any>
    key: string
    ignoreTransactionId?: string
    ignoreLevel: number = 0

    constructor(impl: ComponentImplementation<any, any, any, any>, key: string) {
        super()
        
        this.impl = impl
        this.key = key
        this.transactionEnd = impl.transactionEnd
    }

    start(subscription: Subscription): void {}

    next(value: T, dispatch: (runner: () => void) => void): void {
        this.impl.receiveChangeFromChild(this.key, value)
    }

    error(err?: any): void {
        this.impl.subject.error(err)
    }

    complete(): void {
        /** noop */
    }

    transactionStart(transactionId: string): void {
        if (this.ignoreLevel) {
            this.ignoreLevel++
        }
        else {
            this.impl.transactionStart(transactionId, undefined, this.key)
        }
    }

    transactionEnd(transactionId: string): void {
        if (--this.ignoreLevel === 0) {
            delete this.ignoreTransactionId
            this.transactionEnd = this.impl.transactionEnd
        }
    }

    /**
     * When a component receives a `transactionStart` event from a child while
     * already in a transaction, nothing happens, so we'll want to ignore it,
     * and also ignore the corresponding `transactionEnd`.
     * @param transactionId 
     */
    ignoreOneTransactionEnd(transactionId: string): void {
        if (++this.ignoreLevel === 1) {
            this.transactionEnd = this.constructor.prototype.transactionEnd
        }
    }

    /**
     * Disables any further change events, while allowing transaction events
     * to continue through. This is useful for subscriptions which have been
     * removed, but are mid-transaction; it allows us to wait for the
     * transaction to close while ignoring changes.
     */
    preventFurtherChangeEvents() {
        this.next = noop
    }
}