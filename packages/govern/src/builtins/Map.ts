import { ComponentImplementation, ComponentLifecycle } from '../ComponentImplementation'
import { convertToElementIfPossible } from '../convertToElementIfPossible'
import { GovernElementLike, MapProps } from '../Core'
import { doNodesReconcile } from '../doNodesReconcile'
import { Governable } from '../Governable'
import { createGovernor, Governor } from '../Governor'
import { GovernElement } from '../Element'

export class Map<FromOut, ToOut> implements Governable<MapProps<FromOut, ToOut>, ToOut>, ComponentLifecycle<MapProps<FromOut, ToOut>, any, ToOut> {
    element: GovernElementLike<any, any>
    governor: Governor<any, any>
    impl: ComponentImplementation<MapProps<FromOut, ToOut>, any, ToOut>;
    
    constructor(props: MapProps<FromOut, ToOut>) {
        this.impl = new ComponentImplementation(this, props)
        this.receiveProps(props)
    }

    componentWillReceiveProps(nextProps: MapProps<FromOut, ToOut>) {
        this.receiveProps(nextProps)
    }

    componentWillBeDestroyed() {
		this.governor.destroy()
		delete this.governor
    }

    receiveProps(props: MapProps<FromOut, ToOut>) {
        let fromElement = convertToElementIfPossible(props.from)
        if (!(fromElement instanceof GovernElement)) {
            throw new Error(`The "from" prop of a Map element must be an element, object, or array.`)
        }

        if (!doNodesReconcile(this.element, fromElement)) {
            if (this.governor) {
                this.governor.destroy()
            }
            this.element = fromElement
            this.governor = createGovernor(fromElement)
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

    handleChange = (fromOut: FromOut) => {
        if (this.impl.governor) {
            this.impl.enqueueSetState(() => ({ fromOut }))
        }
        else {
            this.impl.state = { fromOut }
        }
    }

    render() {
        return this.impl.props.to(this.impl.state.fromOut)
    }

    createGovernor(): Governor<MapProps<FromOut, ToOut>, ToOut> {
        return this.impl.createGovernor()
    }
}
