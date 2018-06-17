import { Dispatcher } from './Dispatcher'
import { EmitterObservableSubscription, DispatcherEmitter } from './DispatcherEmitter'
import { Subscription } from './Subscription'


export interface Target<T> {
    // Receives the subscription object when `subscribe` is called
    start?(subscription: Subscription): void
    next(value: T, dispatch: (action: () => void) => void): void
    error?(err?: any): void
}

/**
 * Each external subscriber (including React's <Subscribe> component) is
 * represented by an ObservableTarget object.
 */
export interface FlushTarget<T> extends Target<T> {
    /**
     * When two targets have differing priority, the lower priority target will
     * be notified first, and the store will be given a chance to execute any
     * resulting actions before continuing notifying the higher priority
     * target.
     */
    priority: string,

    /**
     * Receives the subscription object when `subscribe` is called
     */
    start?(subscription: Subscription): void

    next(value: T, dispatch: (action: () => void) => void): void

    error?(err?: any): void

    /**
     * Notify the target that no further values will be published.
     */
    complete?(): void

    /**
     * Notify the target that new values may be published.
     */
    startDispatch?(): void

    /**
     * Notify the target that no new values will be published until
     * `startDispatching` is called again.
     */
    endDispatch?(): void
}

export interface PublishTarget<T> extends Target<T> {
    isPublishTarget: true

    // Store the emitter of the target, so we can merge the target's
    // dispatcher into the source dispatcher if they don't match.
    emitter: DispatcherEmitter<T>;

    // Receives the subscription object when `subscribe` is called
    start(subscription: EmitterObservableSubscription): void

    /**
     * Notify the target of a new value.
     * 
     * Calling this can cause other stores to publish, but it cannot
     * cause subscriptions or stores to be created / disposed.
     */
    next(value: T): void

    error(err?: any): void
}

export function isValidPublishTarget(x): x is PublishTarget<any> {
    return x && x['isPublishTarget'] === true
}

export class TargetClosedError extends Error {
    constructor() {
        super('target closed');
        this.name = 'TargetClosedError';
        (Object as any).setPrototypeOf(this, TargetClosedError.prototype);
    }
}
