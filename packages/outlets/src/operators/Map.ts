import { Operator, OperatorTarget } from '../Operator'
import { OutletSource } from '../OutletSource'
import { Subscription } from '../Subscription'
import { Target } from '../Target'

export class MapOperator<T, U> implements Operator<T, U> {
    transform: (value: T) => U

    constructor(transform: (value: T) => U) {
        this.transform = transform
    }

    subscribe(target: Target<U>, source: OutletSource<T>): Subscription {
        let mappedTarget = new MapTarget(this.transform, target)
        return source.subscribe(mappedTarget)
    }

    getValue(source: OutletSource<T>): U {
        return this.transform(source.getValue())
    }
}

class MapTarget<T, U> extends OperatorTarget<T, U> {
    transform: (value: T) => U

    constructor(transform: (value: T) => U, target: Target<U>) {
        super(target)
        this.transform = transform
    }

    next(value: T) {
        let result: any
        try {
            result = this.transform(value)
        } catch (err) {
            this.target.error(err)
            return
        }
        this.target.next(result)
    }
}