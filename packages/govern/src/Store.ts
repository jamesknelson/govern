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
import globalDispatcher from './globalDispatcher';


interface Subscribable<T> {
    governor: StoreGovernor<T>;
}


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
export class Store<T, Props=any> implements Subscribable<T>, DispatchedObservable<T> {
    governor: StoreGovernor<T, Props>

    constructor(governor: StoreGovernor<T, Props>) {
        this.governor = governor
    }

    subscribe(
        nextOrObserver: DispatchedObserver<T> | ((value: T, dispatch?: (runner: () => void) => void) => void),
        error?: (error: any) => void,
        complete?: () => void,
        startDispatch?: () => void,
        endDispatch?: () => void,
        priority = "0",
    ): Subscription {
        let target = new StoreSubscriberTarget(priority, nextOrObserver, error, complete, startDispatch, endDispatch)
        return this.governor.emitter.subscribeFlushTarget(target)
    }

    getValue(): T {
        return this.governor.emitter.getValue()
    }

    setProps(props: Props): void {
        this.governor.dispatcher.enqueueAction(() => {
            this.governor.setProps(props)
        })
    }
    dispose(): void {
        this.governor.dispatcher.enqueueAction(this.governor.dispose)
    }

    map<U>(transform: (value: T) => U): GovernElement<any, U> {
        return map(this, transform)
    }
    flatMap<U>(transform: (value: T) => Store<U, Props> | GovernElement<any, U>): GovernElement<any, U> {
        return flatMap(this, transform)
    }
}

export function instantiate<Props, Value>(element: GovernElement<Props, Value>): Store<Value, Props> {
    // TODO: create a dispatcher.
    let storeGovernor
    globalDispatcher.enqueueAction(() => {
        storeGovernor = createStoreGovernor(element, globalDispatcher)
    })
    globalDispatcher.dispatch()
    return new Store(storeGovernor)
}

export function isValidStore(x): x is Store<any, any> {
    return x instanceof Store
}
