import { Store } from './Store'
import { Component } from './Component'
import { GovernElement, isValidElement } from './Element'
import { FlatMap } from './builtins/FlatMap'
import { Map } from './builtins/Map'
import { Combine } from './builtins/Combine'
import { CombineArray } from './builtins/CombineArray'
import { getUniqueId } from './utils/getUniqueId'


export interface Instantiable<Props, Value> {
    instantiate(initialTransactionId: string): Store<Value, Props>;
}

export interface InstantiableClass<Props, Value> {
    new (props: Props): Instantiable<Props, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}


const BuiltInComponents = {
    combine: Combine,
    combineArray: CombineArray,
    flatMap: FlatMap,
    map: Map,
}


/**
 * This allows the initial transaction to be started manually. It is used
 * internally, but not exposed via the public API, as forgetting to start
 * an initial transaction is a superb way to waste a couple hours chasing
 * funny bugs.
 */
export function instantiateWithManualFlush<Props, Value>(element: GovernElement<Props, Value>, initialTransactionId: string): Store<Value, Props> {
    let instance: Instantiable<Props, Value>

    // Create a component instance for the element, with the specified
    // initial props.
    if (typeof element.type === "string") {
        let constructor = BuiltInComponents[element.type]
        if (!constructor) {
            throw new Error(`Unknown builtin type "${element.type}".`)
        }
        instance = new constructor(element.props)
    }
    else if (element.type.prototype.instantiate) {
        let constructor = element.type as any
        instance = new constructor(element.props)
    }
    else if (typeof element.type === "function") {
        // Stateless functional components are currently just implemented as
        // an anonymous Component class.
        let sfc = element.type as any
        let constructor = class extends Component<any, any> {
            subscribe() {
                return sfc(this.props)
            }

            publish() {
                return this.subs
            }
        }
        instance = new constructor(element.props)
    }
    else {
        throw new Error(`Cannot create governor of type "${String(element.type)}".`)
    }

    // Return the component instance's governor.
    return instance.instantiate(initialTransactionId)
}


export function instantiate<Props, Value>(element: GovernElement<Props, Value>): Store<Value, Props> {
    let initialTransactionId = getUniqueId()
    let store = instantiateWithManualFlush(element, initialTransactionId)
    store.transactionEnd(initialTransactionId)
    return store
}