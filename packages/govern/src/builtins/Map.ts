import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { doNodesReconcile } from '../doNodesReconcile'
import { Governable } from '../Governable'
import { createGovernor, Governor } from '../Governor'
import { GovernElement, isValidElement } from '../Element'

export class Map<FromValue, ToValue> implements Governable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, any, ToValue, ToValue> {
    element: GovernElement<any, any>
    governor: Governor<any, any>
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, any, ToValue, ToValue>;
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
        this.receiveProps(props)
    }

    componentWillReceiveProps(nextProps: MapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps)
    }

    componentWillBeDisposeed() {
		this.governor.dispose()
		delete this.governor
    }

    componentDidInstantiate() {
        this.governor.flush()
    }

    componentDidUpdate() {
        this.governor.flush()
    }

    receiveProps(props: MapProps<FromValue, ToValue>) {
        let fromElement = props.from
        if (!isValidElement(fromElement)) {
            throw new Error(`The "from" prop of a Map element must be an element, object, or array.`)
        }

        if (!doNodesReconcile(this.element, fromElement)) {
            if (this.governor) {
                this.governor.dispose()
            }
            this.element = fromElement
            this.governor = createGovernor(fromElement, false)
            this.governor.subscribe(
                this.handleChange,
                this.impl.handleChildError,
                this.impl.handleChildComplete,
                this.impl.increaseTransactionLevel,
                this.impl.decreaseTransactionLevel
            )
        }
        else {
            this.governor.setProps(fromElement.props)
        }
    }

    handleChange = (fromOut: FromValue) => {
        if (this.impl.governor) {
            this.impl.setState(() => ({ fromOut }))
        }
        else {
            this.impl.state = { fromOut }
        }
    }

    subscribe() {
        return this.impl.props.to(this.impl.state.fromOut)
    }

    getValue() {
        return this.impl.subs
    }

    createGovernor(): Governor<MapProps<FromValue, ToValue>, ToValue> {
        return this.impl.createGovernor()
    }
}
