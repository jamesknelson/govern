import { Subscribable } from './Core'
import { Dispatcher } from './Dispatcher'
import { GovernElement } from './Element'
import { constant, flatMap, map } from './Factories'
import { Component, getDisplayName } from './Component'
import { DispatchedObservable } from './DispatchedObservable'
import { DispatchedObserver } from './DispatchedObserver'
import { ComponentImplementation } from './ComponentImplementation'
import { Subscription } from './Subscription'
import { Target, PublishTarget, isValidPublishTarget } from './Target'
import { createStoreGovernor, StoreGovernor } from './StoreGovernor'
import { StoreSubscriberTarget } from './StoreSubscriberTarget'


/**
 * A Store is a type of Observable, and also has a current value that
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
export class Store<Value, Props=any> implements DispatchedObservable<Value> {
    governor: StoreGovernor<Value, Props>

    constructor(governor: StoreGovernor<Value, Props>) {
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
        let target = new StoreSubscriberTarget(priority, nextOrObserver, error, complete, startDispatch, endDispatch)
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
    enqueueAction = (fn: () => void) => {
        this.governor.emitter.enqueueAction(fn)
    }
}

export function instantiate<Value, Props>(element: GovernElement<Value, Props>): Store<Value, Props> {
    let storeGovernor
    let dispatcher = new Dispatcher()
    dispatcher.enqueueAction(() => {
        storeGovernor = createStoreGovernor(element, dispatcher)
    })
    return new Store(storeGovernor)
}

export function isValidStore(x): x is Store<any, any> {
    return x instanceof Store
}
