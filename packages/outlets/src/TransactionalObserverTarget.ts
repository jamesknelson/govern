import { TransactionalObserver } from './TransactionalObservable'
import { Target, TargetClosedError } from './Target'
import { Subscription, ClosableSubscription } from './Subscription'


export class TransactionalObserverTarget<T> extends Target<T> {
    /**
     * A subscription object that can be closed by whovever created the
     * observer.
     */
    readonly subscription: ClosableSubscription;

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
    protected latestValue: any;

    /**
     * Store the transactionLevel, so we can always push out events that
     * are published outside of actions (like initial events).
     */
    protected transactionLevel: number = 0;

    protected observer: TransactionalObserver<T>;
    protected subscriptions: Subscription[] = [];

    constructor(
        nextOrObserver: TransactionalObserver<T> | ((value: T) => void),
        error?: (error: any) => void,
        complete?: () => void,
        transactionStart?: () => void,
        transactionEnd?: () => void
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

        this.subscription = new ClosableSubscription(() => {
            for (let i = 0; i < this.subscriptions.length; i++) {
                this.subscriptions[i].unsubscribe()
            }
        })
    }

    get closed() {
        return this.subscription.closed
    }

    // When this target is subscribed to a source, the source will return a
    // `subscription` object. Once this target is closed, we should call the
    // subscription's `unsubscribe` method, so that the source can clean up if
    // required.
    start(subscription: Subscription): void {
        if (this.subscription.closed) {
            throw new TargetClosedError()
        }

        this.subscriptions.push(subscription)
    }

    next(value: T): void {
        if (this.subscription.closed) {
            throw new TargetClosedError()
        }

        this.latestValue = value
        if (!this.isStopped && this.observer.next && (this.observer.transactionEnd || this.transactionLevel === 0)) {
            this.observer.next(value)
        }
    }

    error(err?: any): void {
        if (this.subscription.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped) {
            if (this.observer.error) {
                this.isStopped = true
                this.observer.error(err)
            }
            else {
                console.error(`An error went handled by an outlet's observer:`, err)
            }
        }
    }

    complete(): void {
        if (this.subscription.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped && this.observer.complete) {
            this.isStopped = true
            this.observer.complete()
        }
    }

    transactionStart(): void {
        if (this.subscription.closed) {
            throw new TargetClosedError()
        }

        this.transactionLevel++

        if (!this.isStopped && this.observer.transactionStart) {
            this.observer.transactionStart()
        }
    }

    transactionEnd(): void {
        if (this.subscription.closed) {
            throw new TargetClosedError()
        }

        this.transactionLevel--

        if (!this.isStopped) {
            if (this.observer.transactionEnd) {
                this.observer.transactionEnd()
            }
            else if (this.transactionLevel === 0) {
                this.observer.next(this.latestValue)
            }
        }
    }
}
