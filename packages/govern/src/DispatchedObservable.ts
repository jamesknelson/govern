import { Observable } from './Observable'
import { Subscription } from './Subscription'
import { DispatchedObserver } from './DispatchedObserver'

/*
 * Dispatched Observables have two extra events over standard observables:
 * 
 * - `onStartDispatch`, which must be sent before any `onNext`
 * - `onEndDispatch`, which must be sent once a group of `onNext` calls
 *   has completed. The values from the `onNext` calls won't be processed
 *   until this is sent.
 * 
 * Dispatched Observables allow React components that subscribe to observables
 * to delay updates to child components until a dispatch is complete, reducing
 * the total number of renders required.
 */
export interface DispatchedObservable<T> extends Observable<T> {
    // Subscribes to the sequence with an observer
    subscribe(observer: DispatchedObserver<T>): Subscription;

    // Subscribes to the sequence with callbacks
    subscribe(
        onNext: (value: T, dispatch?: (runner: () => void) => void) => void,
        onError?: (error: any) => void,
        onComplete?: () => void,
        onStartDispatch?: () => void,
        onEndDispatch?: () => void
    ): Subscription;
}
