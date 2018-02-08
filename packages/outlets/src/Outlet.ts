import { MapOperator } from './operators/Map'
import { OutletSource } from './OutletSource'
import { TransactionalObserver, TransactionalObservable } from './TransactionalObservable'
import { Operator } from './Operator'
import { Subscription } from './Subscription'
import { isValidTarget, Target } from './Target'
import { TransactionalObserverTarget } from './TransactionalObserverTarget'

/**
 * An Outlet is similar to an Observable, but also has a current value that
 * can be retrieved through the `getValue` method.
 * 
 * - It has a "current value", which you can access through its `value`
 *   property
 * - You can subscribe to it to receive notification of new values.
 * 
 * In addition, outlets must be transactional; that is, they must surround
 * value events with transaction events.
 */
export class Outlet<T> implements TransactionalObservable<T>, OutletSource<T> {
    source: OutletSource<T>
    operator?: Operator<any, T>

    constructor(source: OutletSource<T>, operator?: Operator<any, T>) {
        this.operator = operator
        this.source = source
    }

    lift<U>(operator?: Operator<T, U>): Outlet<U> {
        return new Outlet<U>(this as any, operator)
    }

    get closed() {
        return this.source.closed
    }
    
    subscribe(
        targetOrNextOrObserver: Target<T> | TransactionalObserver<T> | ((value: T) => void),
        error?: (error: any) => void,
        complete?: () => void,
        transactionStart?: () => void,
        transactionEnd?: () => void
    ): Subscription {
        let target = 
            isValidTarget(targetOrNextOrObserver)
                ? targetOrNextOrObserver
                : new TransactionalObserverTarget(targetOrNextOrObserver, error, complete, transactionStart, transactionEnd)
        
        if (this.operator) {
            return this.operator.subscribe(target, this.source)
        }
        else {
            return this.source.subscribe(target as any)
        }
    }

    getValue(): T {
        if (this.operator) {
            return this.operator.getValue(this.source)
        }
        else {
            return this.source.getValue() as any
        }
    }

    map<U>(transform: (value: T) => U): Outlet<U> {
        return this.lift(new MapOperator(transform))
    }
}
