import { Subscription } from './Subscription'

/**
 * ESNext Observers Proposal.
 */
export interface Observable<T> {
    // Subscribes to the sequence with an observer
    subscribe(observer: Observer<T>): Subscription;

    // Subscribes to the sequence with callbacks
    subscribe(onNext: (value: T) => void,
              onError?: (error: any) => void,
              onComplete?: () => void): Subscription;
}

/**
 * ESNext Observers Proposal.
 */
export interface Observer<T> {
    // Receives the subscription object when `subscribe` is called
    start?(subscription: Subscription): void;

    // Receives the next value in the sequence
    next(value: T): void;

    // Receives the sequence error
    error?(errorValue: any): void;

    // Receives a completion notification
    complete?(): void;
}
