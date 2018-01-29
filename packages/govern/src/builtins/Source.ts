import { ComponentImplementation, ComponentLifecycle } from '../ComponentImplementation'
import { GovernElementLike, SourceProps } from '../Core'
import { doNodesReconcile } from '../doNodesReconcile'
import { convertToElementIfPossible } from '../convertToElementIfPossible'
import { Governable } from '../Governable'
import { createGovernor, Governor } from '../Governor'
import { Observable, Observer, Subscription } from '../Observable'
import { GovernElement } from '../Element'

export class Source<T> implements Governable<SourceProps<T>, Observable<T>> {
	childGovernor: Governor<any, any>
	childElement: GovernElement<any, any>
	impl: ComponentImplementation<SourceProps<T>, Observable<T>, any>
	outputGovernor: Governor<any, T>
	outputObservable: Observable<T>
	outputImpl: ComponentImplementation<SourceProps<T>, T, any>
    
    constructor(props: SourceProps<T>) {
		this.impl = new ComponentImplementation(this, props)
		this.outputImpl = new ComponentImplementation({
			render: () => {
				return this.outputImpl.state.output
			}
		}, props)
    }

    componentWillReceiveProps(nextProps: SourceProps<T>) {
        this.receiveProps(nextProps)
    }

    componentWillBeDestroyed() {
		this.outputGovernor.destroy()
		this.childGovernor.destroy()
		delete this.outputGovernor
		delete this.childGovernor
    }

    receiveProps(props: SourceProps<T>) {
		if (!props.children || Object.keys(props).length !== 1) {
			throw new Error(`A Govern <source> element must receive a single child as its only prop.`)
		}
	
		let element = convertToElementIfPossible(props.children)
		if (!(element instanceof GovernElement)) {
			throw new Error(`A Govern <source> element's children must be an element, array, or object.`)
		}

        if (!doNodesReconcile(this.childElement, element)) {
            if (this.childGovernor) {
                this.childGovernor.destroy()
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

    render() {
        return this.outputObservable
	}

    createGovernor(): Governor<SourceProps<T>, Observable<T>> {
		this.receiveProps(this.impl.props)
		this.outputGovernor = this.outputImpl.createGovernor()
		this.outputObservable = this.outputGovernor.getObservable()
		return this.impl.createGovernor()
    }
}
