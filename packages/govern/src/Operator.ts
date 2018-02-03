import { OutletSource } from './OutletSource'
import { Subscription } from './Subscription'
import { Target } from './Target'

export interface Operator<T, U> {
    subscribe(target: Target<U>, source: OutletSource<T>): Subscription
    getValue(source: OutletSource<T>): U
}

export abstract class OperatorTarget<T, U> implements Target<T> {
    readonly target: Target<U>

    constructor(target: Target<U>) {
        this.target = target
    }

    get closed() {
        return this.target.closed
    }

    start(subscription: Subscription): void {
        this.target.start(subscription)
    }

    abstract next(value: T): void;

    error(err?: any): void {
        this.target.error(err)
    }

    complete(): void {
        this.target.complete()
    }

    transactionStart(): void {
        this.target.transactionStart()   
    }

    transactionEnd(): void {
        this.target.transactionEnd()
    }
}
