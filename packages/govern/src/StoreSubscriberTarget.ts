import { TransactionalObserver } from './TransactionalObservable'
import { Target, TargetClosedError } from './Target'
import { Subscription, ClosableSubscription } from './Subscription'


export class StoreSubscriberTarget<T> extends Target<T> {
    /**
     * If an error or complete event has occured, we'll stop propagating
     * further events. This is slightly different to `subscription.closed`,
     * which indicates whether the subscription was closed by the owner.
     */
    protected isStopped: boolean = false;

    /**
     * Store the latest value, so we can send it before transactionEnd if
     * the user doesn't provide a transactionEnd handler.
     */
    protected latestDispatch: any;
    protected latestValue: any;
    protected hasChangedSinceTransactionStart: boolean = false;

    /**
     * Store the transactionLevel, so we can always push out events that
     * are published outside of actions (like initial events).
     */
    protected transactionLevel: number = 0;

    protected observer: TransactionalObserver<T>;
    protected subscription?: Subscription;

    constructor(
        nextOrObserver: TransactionalObserver<T> | ((value: T, dispatch?: (runner: () => void) => void) => void),
        error?: (error: any) => void,
        complete?: () => void,
        transactionStart?: (transactionId: string) => void,
        transactionEnd?: (transactionId: string) => void
    ) {
        super()

        if (typeof nextOrObserver !== 'function') {
            this.observer = nextOrObserver
        }
        else {
            this.observer = {
                next: nextOrObserver,
                error,
                complete,
                transactionStart,
                transactionEnd,
            }
        }
    }

    get closed() {
        return !!(this.subscription && this.subscription.closed)
    }

    // When this target is subscribed to the source, the source will return a
    // `subscription` object. Once this target is closed, we should call the
    // subscription's `unsubscribe` method, so that the source can clean up if
    // required.
    start(subscription: Subscription): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (this.subscription) {
            throw new Error("A subscription cannot be started more than once.")
        }

        this.subscription = subscription
    }

    next(value: T, dispatch: (runner: () => void) => void): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        this.latestDispatch = dispatch
        this.latestValue = value
        this.hasChangedSinceTransactionStart = true
        if (!this.isStopped && this.observer.next && (this.observer.transactionEnd || this.transactionLevel === 0)) {
            this.observer.next(value, dispatch)
        }
    }

    error(err?: any): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped) {
            if (this.observer.error) {
                this.isStopped = true
                this.observer.error(err)
            }
            else {
                console.error(`An error went handled by an store's observer:`, err)
            }
        }
    }

    complete(): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped && this.observer.complete) {
            this.isStopped = true
            this.observer.complete()
        }
    }

    transactionStart(transactionId: string): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (this.transactionLevel === 0) {
            this.hasChangedSinceTransactionStart = false
        }

        this.transactionLevel++

        if (!this.isStopped && this.observer.transactionStart) {
            this.observer.transactionStart(transactionId)
        }
    }

    transactionEnd(transactionId: string): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        this.transactionLevel--

        if (!this.isStopped) {
            if (this.observer.transactionEnd) {
                this.observer.transactionEnd(transactionId)
            }
            else if (this.transactionLevel === 0 && this.hasChangedSinceTransactionStart) {
                this.observer.next(this.latestValue, this.latestDispatch)
            }
        }
    }
}
