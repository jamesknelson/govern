import { Dispatcher } from './Dispatcher'
import { GovernElement } from './GovernElement'
import { DispatchedObservable } from './DispatchedObservable'
import { DispatchedObserver } from './DispatchedObserver'
import { Subscription } from './Subscription'
import { createObservableGovernor, GovernObservableGovernor } from './GovernObservableGovernor'
import { GovernObservableSubscriberTarget } from './GovernObservableSubscriberTarget'


/**
 * An Observable of an element's output, where the latest value
 * can be retrieved through the `getValue` method.
 * 
 * - It has a "current value", which you can access through its `value`
 *   property
 * - You can subscribe to it to receive notification of new values.
 * 
 * In addition, stores surround `next` events with transaction events,
 * facilitating composition of multiple observables that are computed from
 * a single observable.
 */
export class GovernObservable<Value, Props=any> implements DispatchedObservable<Value> {
    governor: GovernObservableGovernor<Value, Props>

    constructor(governor: GovernObservableGovernor<Value, Props>) {
        this.governor = governor
    }

    subscribe(
        nextOrObserver: DispatchedObserver<Value> | ((value: Value, dispatch?: (runner: () => void) => void) => void),
        error?: (error: any) => void,
        complete?: () => void,
        startDispatch?: () => void,
        endDispatch?: () => void,
        priority = "0",
    ): Subscription {
        let target = new GovernObservableSubscriberTarget(priority, nextOrObserver, error, complete, startDispatch, endDispatch)
        return this.governor.emitter.subscribeFlushTarget(target)
    }

    getValue(): Value {
        return this.governor.emitter.getValue()
    }

    dispose(): void {
        this.governor.emitter.enqueueAction(this.governor.dispose)
    }

    /**
     * This waits until all currently queued actions and flushes have completed
     * before running the argument function.
     * 
     * As you can't run actions during a flush, and most React components are
     * updated during a flush, this can be useful for calling app code from
     * within your UI components' lifecycle methods.
     */
    waitUntilNotFlushing = (fn: () => void) => {
        this.governor.emitter.enqueueAction(fn)
    }
}

export function createObservable<Value, Props>(element: GovernElement<Value, Props>): GovernObservable<Value, Props> {
    let observableGovernor
    let dispatcher = new Dispatcher()
    dispatcher.enqueueAction(() => {
        observableGovernor = createObservableGovernor(element, dispatcher)
    })
    return new GovernObservable(observableGovernor)
}

export function isValidObservable(x): x is GovernObservable<any, any> {
    return x instanceof GovernObservable
}
