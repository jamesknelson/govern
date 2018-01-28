export interface Observable<T> {
    // Get the latest value.
    get(): T;

    // Subscribes to the sequence with an observer
    subscribe(observer: Observer<T>): Subscription;

    // Subscribes to the sequence with callbacks
    subscribe(onNext: (value: T) => void,
              onError?: (error: any) => void,
              onComplete?: () => void,
              onStartBatch?: () => void,
              onFlushBatch?: () => void): Subscription;
}

export interface Subscription {
    // Cancels the subscription
    unsubscribe(): void;

    // A boolean value indicating whether the subscription is closed
    readonly closed: Boolean;
}

export interface Observer<T> {
    // Receives the subscription object when `subscribe` is called
    start?(subscription: Subscription): void;

    // Receives the next value in the sequence
    next(value: T): void;

    // While not useful at the level of a single observable, these allow
    // observers to arbitrarily split observables, and then recombine
    // them, and still only emit a single batch (while there will now
    // be multiple transactions.)
    //
    // For example:
    // - Observable emits { users: ['Alice', 'Bob', 'Carol'] }
    // - This is split into two separate observables, { firstUser: 'Alice' }
    //   and { 'lastUser': 'Carol' }
    // - These are recombined into 'Alice to Carol'
    // - As two separate change events are emitted on the two intermediate
    //   observables, two changes will be emitted on the final observable.
    //   However, the change events will be wrapped in batch events, allowing
    //   us to only perform the computation once, and only emit a single
    //   change.
    startBatch?(): void;
    flushBatch?(): void;

    // Receives the sequence error
    error?(errorValue: any): void;

    // Receives a completion notification
    complete?(): void;
}