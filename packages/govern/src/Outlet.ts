import { GovernElement } from './Element'
import { constant, flatMap, map } from './Factories'
import { OutletSubject } from './OutletSubject'
import { TransactionalObserver, TransactionalObservable } from './TransactionalObservable'
import { ComponentImplementation } from './ComponentImplementation'
import { Subscription } from './Subscription'
import { isValidTarget, Target } from './Target'
import { OutletSubscriberTarget } from './OutletSubscriberTarget'

/**
 * An Outlet is similar to an Observable, but also has a current value that
 * can be retrieved through the `getValue` method.
 * 
 * - It has a "current value", which you can access through its `value`
 *   property
 * - You can subscribe to it to receive notification of new values.
 * 
 * In addition, outlets surround `next` events with transaction events,
 * facilitating composition of multiple observables that are computed from
 * a single observable.
 */
export class Outlet<T, Props=any> implements TransactionalObservable<T> {
    // The internal interface for publishing events is hidden within the
    // `subject` instance.
    private impl: ComponentImplementation<Props, any, T, any>

    constructor(impl: ComponentImplementation<Props, any, T, any>) {
        this.impl = impl
    }
    
    subscribe(
        targetOrNextOrObserver: TransactionalObserver<T> | ((value: T, dispatch?: (runner: () => void) => void) => void),
        error?: (error: any) => void,
        complete?: () => void,
        transactionStart?: (transactionId: string) => void,
        transactionEnd?: (transactionId: string) => void
    ): Subscription {
        // TODO: move this stuff into OutletSubject
        let target = 
            isValidTarget(targetOrNextOrObserver)
                ? targetOrNextOrObserver
                : new OutletSubscriberTarget(targetOrNextOrObserver, error, complete, transactionStart, transactionEnd)
        
        return this.impl.subject.subscribe(target)
    }

    getValue(): T {
        return this.impl.subject.getValue()
    }

    setProps(props: Props): void {
        this.impl.setProps(props)
    }

    dispose() {
        this.impl.dispose()
    }

    // If a component ist starting a transaction on a connected element, it
    // knows that the instantiated element has no other subscribers, so it
    // doesn't need to propagate that specific transaction to subscribers.
    transactionStart(transactionId: string, propagateToSubscribers: boolean = true) {
        this.impl.transactionStart(transactionId, propagateToSubscribers)
    }

    transactionEnd(transactionId: string) {
        this.impl.transactionEnd(transactionId)
    }

    map<U>(transform: (value: T) => U): GovernElement<any, U> {
        return map(this, transform)
    }

    flatMap<U>(transform: (value: T) => GovernElement<any, U>): GovernElement<any, U> {
        return flatMap(this, transform)
    }
}

export function isValidOutlet(x): x is Outlet<any, any> {
    return x instanceof Outlet
}