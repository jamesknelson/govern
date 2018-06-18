import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { FlatMapProps } from '../Core'
import { Dispatcher } from '../Dispatcher'
import { createObservableGovernor, Governable, GovernObservableGovernor } from '../GovernObservableGovernor'
import { GovernElement, convertToElement, doElementsReconcile } from '../GovernElement'
import { Subscription } from '../Subscription'
import { PublishTarget } from '../Target'
import { DispatcherEmitter } from '../DispatcherEmitter';

interface Child<FromValue> {
    element: GovernElement<FromValue>,
    governor?: GovernObservableGovernor<FromValue>,
    subscription?: Subscription,
    target?: PublishTarget<any>,
    value: FromValue,
}

const noop = () => {}

export class FlatMap<FromValue, ToValue> implements Governable<ToValue, FlatMapProps<FromValue, ToValue>>, ComponentImplementationLifecycle<FlatMapProps<FromValue, ToValue>, any, ToValue> {
    initialDispatcher: Dispatcher
    from: Child<FromValue>
    impl: ComponentImplementation<FlatMapProps<FromValue, ToValue>, any, ToValue>;
    
    constructor(props: FlatMapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    componentWillReceiveProps(nextProps: FlatMapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps)
    }

    componentWillUnmount() {
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

    render() {
        return this.impl.props.to(this.from.value)
    }

    shouldComponentPublish(prevProps, prevState, prevValue) {
        return this.impl.value === undefined || this.impl.value !== prevValue
    }

    // Reimplement impl's `createObservableGovernor`, so that we can get a value
    // from our `from` store/element before running the initial `connect` and
    // `publish`.
    createObservableGovernor(initialDispatcher: Dispatcher) {
        this.impl.emitter = initialDispatcher.createEmitter(this.impl)

        this.receiveProps(this.impl.props)
        
        this.impl.connect()
        this.impl.publish()

        return this.impl
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
            let governor: GovernObservableGovernor<any> | undefined
            let target: PublishTarget<any> | undefined

            if (fromElement.type === 'subscribe') {
                target = new FlatMapTarget(this)
                governor = fromElement.props.to.governor
            }
            else if (fromElement.type !== 'constant') {
                target = new FlatMapTarget(this)
                governor = createObservableGovernor(fromElement, this.impl.emitter.dispatcher)
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

        if (this.impl.previousPublish && !this.impl.isReceivingProps && !this.impl.isDisposing) {
            this.impl.connect()
            this.impl.publish()
        }
    }
}

export class FlatMapTarget<T> implements PublishTarget<T> {
    emitter: DispatcherEmitter<T>
    flatMap: FlatMap<any, any>

    isPublishTarget = true as true

    constructor(flatMap: FlatMap<any, any>) {
        this.emitter = flatMap.impl.emitter
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