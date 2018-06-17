import { Governable, GovernableClass } from './GovernObservableGovernor'
import { GovernObservable } from './GovernObservable'
import { ComponentState } from './Core'
import { ComponentImplementation, ComponentImplementationLifecycle } from './ComponentImplementation'
import { GovernElement } from './GovernElement'
import { Dispatcher } from './Dispatcher'

export type ElementType<T extends Component<any, any, any>> = {
    new (props: T['props']): T
    defaultProps?: Partial<T['props']>;
}

export interface ComponentClass<Value, Props> extends GovernableClass<Value, Props> {
    new (props: Props): Component<Props, ComponentState, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}

export interface ComponentLifecycle<Props={}, State={}, Value=any> extends ComponentImplementationLifecycle<Props, State, Value> {
    render(): GovernObservable<Value> | GovernElement<Value, any> | Value | null;
}

export interface Component<Props={}, State={}, Value=any> extends ComponentLifecycle<Props, State, Value> { }

type RenderType<T> =
    T extends () => GovernElement<infer ElementSnapshot, any> ? ElementSnapshot :
    T extends () => infer ConstantSnapshot ? ConstantSnapshot :
    any;

export abstract class Component<Props, State={}, Value=any> implements Governable<any, Props>, ComponentLifecycle<Props, State, Value> {
    protected impl: ComponentImplementation<Props, State, Value>;

    constructor(props: Props) {
        this.impl = new ComponentImplementation(this, props)
    }

    get props() {
        return (this.impl.getFix().props || {}) as Props
    }

    get subs(): RenderType<this["render"]> {
        if (this.impl.isRunningSubscribe) {
            throw new Error(`You cannot access a component's "value" property within its "render" method. See component "${getDisplayName(this.constructor)}".`)
        }
        return this.impl.getFix().subs as any
    }

    get state() {
        return this.impl.getFix().state
    }

    set state(state: State) {
        if (this.impl.emitter) {
            throw new Error(`You cannot set a component's state directly outside of the constructor. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.state = state
    }

    setState<K extends keyof State>(
        state: ((prevState: Readonly<State>, props: Props) => (Pick<State, K> | State)) | (Pick<State, K> | State),
        callback?: () => void
    ): void {
        if (!this.impl.emitter) {
            throw new Error(`You cannot call "setState" within a component's constructor. Instead, set the "state" property directly. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDisposed) {
            console.error(`You cannot call "setState" on a component that has already been disposed. Treating as a noop.`)
            return
        }

        let updater = state as ((prevState: Readonly<State>, props: Props) => any)
        if (typeof state !== 'function') {
            updater = () => state
        }
        this.impl.setState(updater, callback)
    }

    dispatch(action: () => void): void {
        this.impl.emitter.dispatcher.enqueueAction(action)
    }

    createObservableGovernor(dispatcher: Dispatcher) {
        return this.impl.createObservableGovernor(dispatcher)
    }

    shouldComponentPublish(prevProps, prevState, prevValue) {
        return this.subs === undefined || this.subs !== prevValue
    }

    abstract render(): GovernElement<Value> | Value | null;
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
