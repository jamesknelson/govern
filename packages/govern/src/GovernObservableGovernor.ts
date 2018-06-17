import { FlatMap } from './builtins/FlatMap'
import { Map } from './builtins/Map'
import { Combine } from './builtins/Combine'
import { CombineArray } from './builtins/CombineArray'
import { Distinct } from './builtins/Distinct'
import { Component } from './Component'
import { Dispatcher } from './Dispatcher'
import { GovernElement, isValidElement } from './GovernElement'
import { GovernObservable } from './GovernObservable'
import { GovernObservableGovernor } from './GovernObservableGovernor'
import { Subscription } from './Subscription'
import { FlushTarget, PublishTarget, Target } from './Target'
import { DispatcherEmitter } from './DispatcherEmitter';
import { shallowCompare } from './utils/shallowCompare';


const BuiltInComponents = {
    combine: Combine,
    combineArray: CombineArray,
    distinct: Distinct,
    flatMap: FlatMap,
    map: Map,
}


export interface Governable<Value, Props> {
    createObservableGovernor(dispatcher: Dispatcher): GovernObservableGovernor<Value, Props>;
}

export interface GovernableClass<Value, Props> {
    new (props: Props): Governable<Value, Props>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}

// An interface used iternally within Govern to control an observable instance.
// The publicly consumable parts of this are exposed to the outside world
// through the `Observable` class.
export interface GovernObservableGovernor<Value, Props=any> {
    emitter: DispatcherEmitter<Value>;
    
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

export function createObservableGovernor<Value, Props>(element: GovernElement<Value, Props>, dispatcher: Dispatcher): GovernObservableGovernor<Value, Props> {
    let instance: Governable<Value, Props>

    // Create a component instance for the element, with the specified
    // initial props.
    if (typeof element.type === "string") {
        let constructor = BuiltInComponents[element.type]
        if (!constructor) {
            throw new Error(`Unknown builtin type "${element.type}".`)
        }
        instance = new constructor(element.props)
    }
    else if (element.type.prototype.createObservableGovernor) {
        let constructor = element.type as any
        instance = new constructor(element.props)
    }
    else if (typeof element.type === "function") {
        // Stateless functional components are currently just implemented as
        // an anonymous Component class.
        let sfc = element.type as any
        let constructor = class extends Component<any, any> {
            render() {
                return sfc(this.props)
            }
        }
        instance = new constructor(element.props)
    }
    else {
        throw new Error(`Cannot create governor of type "${String(element.type)}".`)
    }

    // Return the component instance's governor.
    return instance.createObservableGovernor(dispatcher)
}
