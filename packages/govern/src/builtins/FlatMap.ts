import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { FlatMapProps } from '../Core'
import { Dispatcher } from '../Dispatcher'
import { createStoreGovernor, Governable, StoreGovernor } from '../StoreGovernor'
import { Store } from '../Store'
import { GovernElement, createElement, convertToElement, doElementsReconcile } from '../Element'
import { Subscription } from '../Subscription'
import { PublishTarget } from '../Target'

interface Child<FromValue> {
    element: GovernElement<any, FromValue>,
    governor?: StoreGovernor<FromValue>,
    subscription?: Subscription,
    target?: PublishTarget<any>,
    value: FromValue,
}

const noop = () => {}

export class FlatMap<FromValue, ToValue> implements Governable<FlatMapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<FlatMapProps<FromValue, ToValue>, any, ToValue, ToValue> {
    from: Child<FromValue>
    hasUnpublishedChanges: boolean = true
    impl: ComponentImplementation<FlatMapProps<FromValue, ToValue>, any, ToValue, ToValue>;
    
    constructor(props: FlatMapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)

        // This hack records *when* we receive new values from the underlying
        // `to` component, even if the values are the same. It allows us to
        // respect `shouldComponentUpdate` of `to` if it exists.
        // DON'T TRY THIS AT HOME, FOLKS.
        let originalSetKey = this.impl.setSubs
        this.impl.setSubs = (key: string, value) => {
            originalSetKey.call(this.impl, key, value)
            this.hasUnpublishedChanges = true
        }
    }

    componentWillReceiveProps(nextProps: FlatMapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps)
    }

    componentWillBeDisposed() {
        if (this.from) {
            if (this.from.target) {
                this.from.subscription!.unsubscribe()

                if (this.from.element.type !== 'subscribe') {
                    this.from.governor!.dispose()
                }
            }
            delete this.from
        }
    }

    subscribe() {
        return this.impl.props.to(this.from.value)
    }

    shouldComponentUpdate() {
        return this.hasUnpublishedChanges
    }

    publish() {
        this.hasUnpublishedChanges = false
        return this.impl.subs
    }

    createStoreGovernor(dispatcher: Dispatcher) {
        // Need to set this ahead of time, as receiveProps may use it.
        this.impl.dispatcher = dispatcher

        this.receiveProps(this.impl.props)

        return this.impl.createStoreGovernor(dispatcher)
    }

    receiveProps(props: FlatMapProps<FromValue, ToValue>) {
        let fromElement = convertToElement(props.from)
        let elementHasChanged = !this.from || !doElementsReconcile(this.from.element, fromElement)

        if (elementHasChanged && this.from && this.from.target) {
            let prevElement = this.from.element
            if (prevElement.type !== 'constant') {
                this.from.subscription!.unsubscribe()
            }
            if (prevElement.type !== 'subscribe' && prevElement.type !== 'constant') {
                this.from.governor!.dispose()
            }
        }

        if (elementHasChanged) {
            let governor: StoreGovernor<any> | undefined
            let target: PublishTarget<any> | undefined

            if (fromElement.type === 'subscribe') {
                target = new FlatMapTarget(this)
                governor = fromElement.props.to.governor
            }
            else if (fromElement.type !== 'constant') {
                target = new FlatMapTarget(this)
                governor = createStoreGovernor(fromElement, this.impl.dispatcher)
            }

            if (governor) {
                this.from = {
                    element: fromElement,
                    value: governor.emitter.getValue(),
                    governor,
                    target,
                }
                this.from.subscription = governor.emitter.subscribePublishTarget(target!)
            }
            else {
                this.from = {
                    element: fromElement,
                    value: fromElement.props.of
                }
            }
        }
        else {
            if (fromElement.type === 'constant') {
                this.from = {
                    element: fromElement,
                    value: fromElement.props.of
                }
            }
            else if (fromElement.type !== 'subscribe') {
                this.from.governor!.setProps(fromElement.props)
            }
        }
    }

    handleFromChange = (fromValue: FromValue) => {
        this.from.value = fromValue

        if (this.impl.emitter && !this.impl.isReceivingProps) {
            this.impl.connect()
            this.impl.publish()
        }
    }
}




// Use a custom Target class for parent components without the sanity checks.
// This cleans up a number of transactionStart/transactionEnd/next calls from
// stack traces, and also prevents significant unnecessary work.
export class FlatMapTarget<T> implements PublishTarget<T> {
    flatMap: FlatMap<any, any>

    isPublishTarget = true as true

    constructor(flatMap: FlatMap<any, any>) {
        this.flatMap = flatMap
        this.next = flatMap.handleFromChange
    }

    start(subscription: Subscription): void {}

    error(err?: any): void {
        this.flatMap.impl.emitter.error(err)
    }

    // This will be replaced in the constructor. Unfortuantely it still needs
    // to be provided to satisfy typescript's types.
    next(value: T): void {}
}