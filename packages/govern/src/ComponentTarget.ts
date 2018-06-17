import { ComponentImplementation } from './ComponentImplementation'
import { DispatcherEmitter, EmitterObservableSubscription } from './DispatcherEmitter'
import { PublishTarget } from './Target'

export class ComponentTarget<T> implements PublishTarget<T> {
    impl: ComponentImplementation<any, any, any>
    emitter: DispatcherEmitter<T>;
    key: string
    subscription: EmitterObservableSubscription;

    isPublishTarget = true as true

    constructor(impl: ComponentImplementation<any, any, any>, key: string) {
        this.impl = impl
        this.emitter = this.impl.emitter
        this.key = key
    }

    start(subscription: EmitterObservableSubscription): void {
        this.subscription = subscription
    }

    next(value: T): void {
        this.impl.receiveChangeFromChild(this.key, value)
    }

    error(err?: any): void {
        this.impl.emitter.error(err)
    }

    unsubscribe() {
        this.subscription.unsubscribe()
    }
}