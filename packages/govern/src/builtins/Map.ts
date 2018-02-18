import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { Governable } from '../Governable'
import { instantiateWithManualFlush } from '../Governor'
import { Outlet } from '../Outlet'
import { GovernElement, convertToElement, doElementsReconcile } from '../Element'
import { getUniqueId } from '../utils/getUniqueId'

export class Map<FromValue, ToValue> implements Governable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, any, ToValue, ToValue> {
    element: GovernElement<any, any>
    fromOutlet: Outlet<any, any>
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, any, ToValue, ToValue>;
    symbol: any;
    transactionIds: string[] = []
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)

        // A symbol used as the key of the `from` element when adding it as
        // a child of impl. We don't use a standard string, as the output is
        // never handled directly.
        this.symbol = Symbol('Map') as any
    }

    componentWillReceiveProps(nextProps: MapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps)
    }

    receiveProps(props: MapProps<FromValue, ToValue>) {
        let fromElement = convertToElement(props.from)

        if (!doElementsReconcile(this.element, fromElement)) {
            if (this.element) {
                this.impl.removeChild(this.symbol)
            }
            this.impl.addChild(this.symbol, fromElement, this.handleChange)
            this.element = fromElement
        }
        else {
            this.impl.updateChild(this.symbol, fromElement.props)
        }
    }

    handleChange = (fromOut: FromValue) => {
        if (this.impl.outlet) {
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
        this.impl.transactionStart(initialTransactionId, false)
        this.receiveProps(this.impl.props)
        return this.impl.createOutlet()
    }
}
