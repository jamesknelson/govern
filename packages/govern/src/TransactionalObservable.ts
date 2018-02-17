import { Observable, Observer } from './Observable'
import { Subscription } from './Subscription'

/*
 * Transactional Observables have two extra possible events compared to
 * standard observables:
 * 
 * - `onTransactionStart`, which must be sent before any `onNext`
 * - `onTransactionEnd`, which must be sent once a group of `onNext` calls
 *   has completed. The values from the `onNext` calls won't be processed
 *   until this is sent.
 * 
 * Transactions allow individual events on an outlet to be split into
 * multiple events during processing, while still only resulting in a single
 * update to the UI.
 */
export interface TransactionalObservable<T> extends Observable<T> {
    // Subscribes to the sequence with an observer
    subscribe(observer: TransactionalObserver<T>): Subscription;

    // Subscribes to the sequence with callbacks
    subscribe(
        onNext: (value: T) => void,
        onError?: (error: any) => void,
        onComplete?: () => void,
        onTransactionStart?: (transactionId: string) => void,
        onTransactionEnd?: (transactionId: string) => void
    ): Subscription;
}

export interface TransactionalObserver<T> extends Observer<T> {
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
    transactionStart?(transactionId: string): void;
    transactionEnd?(transactionId: string): void;
}
