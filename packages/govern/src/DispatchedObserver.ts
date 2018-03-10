import { Observer } from './Observable'
import { Subscription } from './Subscription'

export interface DispatchedObserver<T> extends Observer<T> {
    // Any actions which can affect the state of the observable must be
    // wrapped in a transaction -- and to do so, you'll need to wrap the
    // actions in the dispatch function.
    next: (value: T, dispatch?: (runner: () => void) => void) => void;

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
    startDispatch?(): void;
    endDispatch?(): void;
}
