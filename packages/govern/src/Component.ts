import { Instantiable, InstantiableClass } from './Instantiable'
import { ComponentState } from './Core'
import { ComponentImplementation, ComponentImplementationLifecycle } from './ComponentImplementation'
import { GovernElement } from './Element'
import { getUniqueId } from './utils/getUniqueId'

export interface ComponentClass<Props, Value=any> extends InstantiableClass<Props, Value> {
    new (props: Props): Component<Props, ComponentState, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}

export interface ComponentLifecycle<Props={}, State={}, Value=any, Subs=any> extends ComponentImplementationLifecycle<Props, State, Value, Subs> {
    // While `ComponentImplementation` allows us to "subscribe" to any value,
    // it only makes sense for components to subscribe to elements (as other
    // values are treated as constants.)
    subscribe?(): GovernElement<any, Subs> | null;
}

export interface Component<Props={}, State={}, Value=any, Subs=any> extends ComponentLifecycle<Props, State, Value, Subs> { }

export abstract class Component<Props, State={}, Value=any, Subs=any> implements Instantiable<Props, Value>, ComponentLifecycle<Props, State, Value, Subs> {
    protected impl: ComponentImplementation<Props, State, Value, Subs>;

    constructor(props: Props) {
        this.impl = new ComponentImplementation(this, props)
    }

    get props() {
        return this.impl.getFix().props || {}
    }

    get subs() {
        if (this.impl.isRunningSubscribe) {
            throw new Error(`You cannot access a component's "subs" property within its "subscribe" method. See component "${getDisplayName(this.constructor)}".`)
        }
        return this.getTypedSubs(this as this)
    }

    get state() {
        return this.impl.getFix().state
    }

    set state(state: State) {
        if (this.impl.store) {
            throw new Error(`You cannot set a component's state directly outside of the constructor. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.state = state
    }

    setState<K extends keyof State>(
        state: ((prevState: Readonly<State>, props: Props) => (Pick<State, K> | State)) | (Pick<State, K> | State),
        callback?: () => void
    ): void {
        if (!this.impl.store) {
            throw new Error(`You cannot call "setState" within a component's constructor. Instead, set the "state" property directly. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.disallowChangesReason[0]) {
            throw new Error(`You cannot call "setState" while ${this.impl.disallowChangesReason[0]}. See component "${getDisplayName(this.constructor)}".`)
        }

        let updater = state as ((prevState: Readonly<State>, props: Props) => any)
        if (typeof state !== 'function') {
            updater = () => state
        }
        this.impl.setState(updater, callback)
    }

    dispatch(run: Function): void {
        this.impl.dispatch(run)
    }

    instantiate(initialTransactionId: string) {
        this.impl.transactionStart(initialTransactionId, false)
        return this.impl.createStore()
    }

    abstract publish(): Value;

    // TypeScript isn't able to infer the output of the subclass's
    // `subscribe` function by just accessing `this`, so we need to pass
    // in the subclass if we want access to a correctly typed output :-(
    getTypedSubs<Subs>(component: { subscribe?: () => GovernElement<any, Subs> | null }): Subs {
        return this.impl.getFix().subs as any
    }

    getTypedValue<Value>(component: { publish: () => Value }): Value {
        return this.impl.subject.getValue() as any
    }
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
