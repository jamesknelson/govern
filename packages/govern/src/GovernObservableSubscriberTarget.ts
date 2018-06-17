import { DispatchedObserver } from './DispatchedObserver'
import { FlushTarget, TargetClosedError } from './Target'
import { Subscription } from './Subscription'


export class GovernObservableSubscriberTarget<T> implements FlushTarget<T> {
    priority: string;

    /**
     * If an error or complete event has occured, we'll stop propagating
     * further events. This is slightly different to `subscription.closed`,
     * which indicates whether the subscription was closed by the owner.
     */
    protected isStopped: boolean = false;

    protected observer: DispatchedObserver<T>;
    protected subscription?: Subscription;

    constructor(
        priority: string,
        nextOrObserver: DispatchedObserver<T> | ((value: T, dispatch?: (runner: () => void) => void) => void),
        error?: (error: any) => void,
        complete?: () => void,
        startDispatch?: () => void,
        endDispatch?: () => void
    ) {
        this.priority = priority

        if (typeof nextOrObserver !== 'function') {
            this.observer = nextOrObserver
        }
        else {
            this.observer = {
                next: nextOrObserver,
                error,
                complete,
                startDispatch,
                endDispatch,
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

        if (!this.isStopped && this.observer.next) {
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

    startDispatch(): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped && this.observer.startDispatch) {
            this.observer.startDispatch()
        }
    }

    endDispatch(): void {
        if (this.closed) {
            throw new TargetClosedError()
        }

        if (!this.isStopped) {
            if (this.observer.endDispatch) {
                this.observer.endDispatch()
            }
        }
    }
}
