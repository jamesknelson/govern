import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { FlatMapProps } from '../Core'
import { Governable } from '../Governable'
import { instantiateWithManualFlush } from '../instantiate'
import { Outlet } from '../Outlet'
import { GovernElement, createElement, convertToElement, doElementsReconcile } from '../Element'
import { getUniqueId } from '../utils/getUniqueId'

export class FlatMap<FromValue, ToValue> implements Governable<FlatMapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<FlatMapProps<FromValue, ToValue>, any, ToValue, ToValue> {
    element: GovernElement<any, any>
    fromOutlet: Outlet<any, any>
    hasUnpublishedChanges: boolean = true
    impl: ComponentImplementation<FlatMapProps<FromValue, ToValue>, any, ToValue, { from: any, to: ToValue }>;
    transactionIds: string[] = []
    
    constructor(props: FlatMapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)

        // This hack records *when* we receive new values from the underlying
        // `to` component, even if the values are the same. It allows us to
        // respect `shouldComponentUpdate` of `to` if it exists.
        // DO NOT TRY THIS AT HOME.
        let originalSetKey = this.impl.setKey
        this.impl.setKey = (key: string, value) => {
            originalSetKey.call(this.impl, key, value)
            if (key === 'to') {
                this.hasUnpublishedChanges = true
            }
        }

        // This hack is required to prevent ComponentImplementation from
        // removing the child we add in `receiveProps` on initialization.
        // DO NOT TRY THIS AT HOME EITHER.
        this.impl.subs = {} as any
        this.impl.lastSubscribeElement = createElement('combine', { children: {} })
    }

    componentWillReceiveProps(nextProps: FlatMapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps)
    }

    receiveProps(props: FlatMapProps<FromValue, ToValue>) {
        let fromElement = convertToElement(props.from)

        if (!doElementsReconcile(this.element, fromElement)) {
            if (this.element) {
                this.impl.removeChild('from')
            }
            this.impl.addChild('from', fromElement, this.handleChange)
            this.element = fromElement
        }
        else {
            this.impl.updateChild('from', fromElement.props)
        }
    }

    handleChange = (fromOut: FromValue) => {
        this.impl.expectingChildChangeFor = 'from'
        this.impl.handleChildChange('from', fromOut)
        delete this.impl.expectingChildChangeFor

        // Trigger a re-connect
        if (this.impl.outlet) {
            this.impl.setState(() => ({}))
        }
    }

    subscribe() {
        return createElement('combine', {
            children: {
                to: this.impl.props.to(this.impl.subs.from) as any
            }
        })
    }

    shouldComponentPublish(prevProps, prevState, prevSubs) {
        return this.hasUnpublishedChanges
    }

    publish() {
        this.hasUnpublishedChanges = false
        return this.impl.subs.to
    }

    createOutlet(initialTransactionId: string): Outlet<ToValue, FlatMapProps<FromValue, ToValue>> {
        this.impl.transactionStart(initialTransactionId, false)
        this.receiveProps(this.impl.props)
        return this.impl.createOutlet()
    }
}
