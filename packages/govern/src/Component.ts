import { Governable, GovernableClass } from './Governable'
import { ComponentState, GovernNode } from './Core'
import { ComponentImplementation } from './ComponentImplementation'
import { ComponentLifecycle } from './ComponentLifecycle'

export interface ComponentClass<Props, Value=any> extends GovernableClass<Props, Value> {
    new (props: Props): Component<Props, ComponentState, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}

export interface Component<Props={}, State={}, Value=any, Subs=any> extends ComponentLifecycle<Props, State, Value, Subs> { }

export abstract class Component<Props, State={}, Value=any, Subs=any> implements Governable<Props, Value>, ComponentLifecycle<Props, State, Value, Subs> {
    protected impl: ComponentImplementation<Props, State, Value, Subs>;

    constructor(props: Props, { strict }: { strict?: boolean } = {}) {
        this.impl = new ComponentImplementation(this, props, !!strict)
    }

    get props() {
        return this.impl.props
    }

    get subs() {
        if (this.impl.isPerformingSubscribe) {
            throw new Error(`You cannot access a component's "subs" property within its "subscribe" method. See component "${getDisplayName(this.constructor)}".`)
        }
        return this.getTypedSubs(this as this)
    }

    getSubs() {
        return this.getTypedSubs(this)
    }

    get state() {
        return this.impl.state
    }

    set state(state: State) {
        if (this.impl.governor) {
            throw new Error(`You cannot set a component's state directly outside of the constructor. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.state = state
    }

    setState<K extends keyof State>(
        state: ((prevState: Readonly<State>, props: Props) => (Pick<State, K> | State)) | (Pick<State, K> | State),
        callback?: () => void
    ): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "setState" within a component's constructor. Instead, set the "state" property directly. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDisposed) {
            throw new Error(`You cannot call "setState" on a component instance that has been disposeed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isPerformingSubscribe) {
            throw new Error(`You cannot call "setState" within a component's "getValue" method. See component "${getDisplayName(this.constructor)}".`)
        }

        let updater = state as ((prevState: Readonly<State>, props: Props) => any)
        if (typeof state !== 'function') {
            updater = () => state
        }
        this.impl.enqueueSetState(updater, callback)
    }

    transaction(run: Function): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "transaction" within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDisposed) {
            throw new Error(`You cannot call "transaction" on a component instance that has been disposeed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isPerformingSubscribe) {
            throw new Error(`You cannot call "transaction" within a component's "getValue" method. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.increaseTransactionLevel()
        run()
        this.impl.decreaseTransactionLevel()
    }

    createGovernor() {
        return this.impl.createGovernor()
    }

    abstract getValue(): Value;

    // TypeScript isn't able to infer the output of the subclass's `getValue`
    // function by just accessing `this`, so we need to pass in the subclass
    // if we want access to a correctly typed output :-(
    getTypedSubs<Subs>(component: { subscribe?: () => GovernNode<any, Subs> | null }): Subs {
        return this.impl.subs as any
    }

    getTypedValue<Value>(component: { getValue: () => Value }): Value {
        return this.impl.value as any
    }
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
