import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { doNodesReconcile } from '../doNodesReconcile'
import { Governable } from '../Governable'
import { instantiateWithManualFlush } from '../Governor'
import { Outlet } from '../Outlet'
import { GovernElement, isValidElement } from '../Element'
import { getUniqueId } from '../utils/getUniqueId';

export class Map<FromValue, ToValue> implements Governable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, any, ToValue, ToValue> {
    element: GovernElement<any, any>
    fromOutlet: Outlet<any, any>
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, any, ToValue, ToValue>;
    transactionIds: string[] = []
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    componentWillReceiveProps(nextProps: MapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps, this.impl.transactionIdPropagatedToChildren!)
    }

    componentWillBeDisposeed() {
        this.transactionIds.forEach(id => this.fromOutlet.transactionEnd(id))
        this.transactionIds.length = 0
        this.fromOutlet.dispose()
		delete this.fromOutlet
    }

    componentDidInstantiate() {
        this.transactionIds.forEach(id => this.fromOutlet.transactionEnd(id))
        this.transactionIds.length = 0
    }

    componentDidUpdate() {
        this.transactionIds.forEach(id => this.fromOutlet.transactionEnd(id))
        this.transactionIds.length = 0
    }

    receiveProps(props: MapProps<FromValue, ToValue>, transactionId: string) {
        let fromElement = props.from
        if (!isValidElement(fromElement)) {
            throw new Error(`The "from" prop of a Map element must be an element, object, or array.`)
        }

        if (!doNodesReconcile(this.element, fromElement)) {
            if (this.fromOutlet) {
                this.transactionIds.forEach(id => this.fromOutlet.transactionEnd(id))
                this.transactionIds.length = 0
                this.fromOutlet.dispose()
            }
            this.element = fromElement
            this.fromOutlet = instantiateWithManualFlush(fromElement, transactionId)
            this.transactionIds.push(transactionId)
            this.fromOutlet.subscribe(
                this.handleChange,
                this.impl.handleChildError,
                this.impl.handleChildComplete,
                this.impl.transactionStart,
                this.impl.transactionEnd
            )
        }
        else {
            this.transactionIds.push(transactionId)
            this.fromOutlet.transactionStart(transactionId, false)
            this.fromOutlet.setProps(fromElement.props)
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

    connectChild() {
        return this.impl.props.to(this.impl.state.fromOut)
    }

    publish() {
        return this.impl.child
    }

    createOutlet(initialTransactionId: string): Outlet<ToValue, MapProps<FromValue, ToValue>> {
        this.receiveProps(this.impl.props, initialTransactionId)
        return this.impl.createOutlet(initialTransactionId)
    }
}
