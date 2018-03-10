import { FlatMap } from './builtins/FlatMap'
import { Map } from './builtins/Map'
import { Combine } from './builtins/Combine'
import { CombineArray } from './builtins/CombineArray'
import { Component } from './Component'
import { Dispatcher } from './Dispatcher'
import { GovernElement, isValidElement } from './Element'
import { Store } from './Store'
import { StoreGovernor } from './StoreGovernor'
import { Subscription } from './Subscription'
import { FlushTarget, PublishTarget, Target } from './Target'
import { DispatcherEmitter } from './DispatcherEmitter';


const BuiltInComponents = {
    combine: Combine,
    combineArray: CombineArray,
    flatMap: FlatMap,
    map: Map,
}


export interface Governable<Props, Value> {
    createStoreGovernor(dispatcher: Dispatcher): StoreGovernor<Value, Props>;
}

export interface GovernableClass<Props, Value> {
    new (props: Props): Governable<Props, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}

// An interface used iternally within Govern to control a store instance.
// The publicly consumable parts of this are exposed to the outside world
// through the `Store` class.
export interface StoreGovernor<T, Props=any> {
    emitter: DispatcherEmitter<T>;
    
    setProps(props: Props): void;
    dispose(): void;

    // Process a component's reaction to a publication. If a child component's
    // reaction needs to be processed first, scheduled it with
    // `movePublishReactionToFront` and return false. Otherwise, return true.
    performReaction(): boolean;

    // Process a component's reaction to a flush. If a child component's
    // flush needs to be processed first, scheduled it with
    // `moveFlushReactionToFront` and return false. Otherwise, return true.
    performPost(): boolean;
}

export function createStoreGovernor<Props, Value>(element: GovernElement<Props, Value>, dispatcher: Dispatcher): StoreGovernor<Value, Props> {
    let instance: Governable<Props, Value>

    // Create a component instance for the element, with the specified
    // initial props.
    if (typeof element.type === "string") {
        let constructor = BuiltInComponents[element.type]
        if (!constructor) {
            throw new Error(`Unknown builtin type "${element.type}".`)
        }
        instance = new constructor(element.props)
    }
    else if (element.type.prototype.createStoreGovernor) {
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
    return instance.createStoreGovernor(dispatcher)
}
