import { ComponentImplementation } from './ComponentImplementation'
import { EmitterStoreSubscription } from './DispatcherEmitter'
import { PublishTarget } from './Target'


// Use a custom Target class for parent components without the sanity checks.
// This cleans up a number of transactionStart/transactionEnd/next calls from
// stack traces, and also prevents significant unnecessary work.
export class ComponentTarget<T> implements PublishTarget<T> {
    impl: ComponentImplementation<any, any, any, any>
    key: string
    subscription: EmitterStoreSubscription;

    isPublishTarget = true as true

    constructor(impl: ComponentImplementation<any, any, any, any>, key: string) {
        this.impl = impl
        this.key = key
    }

    start(subscription: EmitterStoreSubscription): void {
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