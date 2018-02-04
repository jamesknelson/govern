import { Outlet } from 'outlets'
import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { GovernElementLike, GovernNode, OutletSourceProps } from '../Core'
import { doNodesReconcile } from '../doNodesReconcile'
import { createElement, GovernElement, isValidElement } from '../Element'
import { isPlainObject } from '../isPlainObject'
import { Governable } from '../Governable'
import { createGovernor, Governor } from '../Governor'

export class OutletSource<T> implements Governable<OutletSourceProps<T>, Outlet<T>>, ComponentImplementationLifecycle<OutletSourceProps<T>, {}, Outlet<T>, void> {
	childGovernor: Governor<any, any>
	childElement: GovernElement<any, any>
	impl: ComponentImplementation<OutletSourceProps<T>, any, Outlet<T>, void>
	outputGovernor: Governor<any, T>
	outputObservable: Outlet<T>
	outputImpl: ComponentImplementation<OutletSourceProps<T>, any, T, void>
    
    constructor(props: OutletSourceProps<T>) {
		this.impl = new ComponentImplementation(this, props)
		this.outputImpl = new ComponentImplementation({
			getValue: () => {
				return this.outputImpl.state.output
			}
		}, props)
    }

    componentWillReceiveProps(nextProps: OutletSourceProps<T>) {
        this.receiveProps(nextProps)
    }

    componentWillBeDisposeed() {
		this.outputGovernor.dispose()
		this.childGovernor.dispose()
		delete this.outputGovernor
		delete this.childGovernor
    }

    receiveProps(props: OutletSourceProps<T>) {
		if (!props.children || Object.keys(props).length !== 1) {
			throw new Error(`A Govern <outlet> element must receive a single child as its only prop.`)
		}
	
		let element = convertToElementIfPossible(props.children)
		if (!isValidElement(element)) {
			throw new Error(`A Govern <outlet> element's children must be an element, array, or object.`)
        }

        if (!doNodesReconcile(this.childElement, element)) {
            if (this.childGovernor) {
                this.childGovernor.dispose()
            }
            this.childElement = element
            this.childGovernor = createGovernor(element)
            this.childGovernor.subscribe(
                this.handleChange,
                this.outputImpl.handleChildError,
                this.outputImpl.handleChildComplete,
                this.outputImpl.increaseTransactionLevel,
                this.outputImpl.decreaseTransactionLevel
            )
        }
        else {
            this.childGovernor.setProps(element.props)
        }
    }

    handleChange = (output: T) => {
		if (this.outputImpl.governor) {
            this.outputImpl.enqueueSetState(() => ({ output }))
        }
        else {
            this.outputImpl.state = { output }
        }
    }

    getValue() {
        return this.outputObservable
	}

    createGovernor(): Governor<OutletSourceProps<T>, Outlet<T>> {
		this.receiveProps(this.impl.props)
		this.outputGovernor = this.outputImpl.createGovernor()
		this.outputObservable = this.outputGovernor.getOutlet()
		return this.impl.createGovernor()
    }
}

function convertToElementIfPossible(node: GovernNode): GovernNode {
    // Plain objects and arrays are treated as elements with type `combine`,
    // with the object or array being the element's children.
    if (isPlainObject(node) || Array.isArray(node)) {
        return createElement('combine', { children: node })
    }
    else {
        return node
    }
}