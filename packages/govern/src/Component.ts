import { Governable, GovernableClass } from './Governable'
import { ComponentState } from './Core'
import { ComponentImplementation, ComponentImplementationLifecycle } from './ComponentImplementation'
import { GovernElement } from './Element'
import { getUniqueId } from './utils/getUniqueId';

export interface ComponentClass<Props, Value=any> extends GovernableClass<Props, Value> {
    new (props: Props): Component<Props, ComponentState, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}

export interface ComponentLifecycle<Props={}, State={}, Value=any, Child=any> extends ComponentImplementationLifecycle<Props, State, Value, Child> {
    // While `ComponentImplementation` allows us to "subscribe" to any value,
    // it only makes sense for components to subscribe to elements (as other
    // values are treated as constants.)
    connectChild?(): GovernElement<any, Child> | null;
}

export interface Component<Props={}, State={}, Value=any, Child=any> extends ComponentLifecycle<Props, State, Value, Child> { }

export abstract class Component<Props, State={}, Value=any, Child=any> implements Governable<Props, Value>, ComponentLifecycle<Props, State, Value, Child> {
    protected impl: ComponentImplementation<Props, State, Value, Child>;

    constructor(props: Props, { strict }: { strict?: boolean } = {}) {
        this.impl = new ComponentImplementation(this, props, !!strict)
    }

    get props() {
        return this.impl.getFix().props
    }

    get child() {
        if (this.impl.isRunningConnectChild) {
            throw new Error(`You cannot access a component's "child" property within its "connectChild" method. See component "${getDisplayName(this.constructor)}".`)
        }
        return this.getTypedChild(this as this)
    }

    get state() {
        return this.impl.getFix().state
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
        if (this.impl.disallowSideEffectsReason[0]) {
            throw new Error(`You cannot call "setState" while ${this.impl.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.constructor)}".`)
        }

        let updater = state as ((prevState: Readonly<State>, props: Props) => any)
        if (typeof state !== 'function') {
            updater = () => state
        }
        this.impl.setState(updater, callback)
    }

    transaction(run: Function): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "transaction" within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.disallowSideEffectsReason[0]) {
            throw new Error(`You cannot call "transaction" while ${this.impl.disallowSideEffectsReason[0]}. See component "${getDisplayName(this.constructor)}".`)
        }

        let transactionId = getUniqueId()
        this.impl.transactionStart(transactionId)
        run()
        this.impl.transactionEnd(transactionId)
    }

    createOutlet(initialTransactionId: string) {
        return this.impl.createOutlet(initialTransactionId)
    }

    abstract publish(): Value;

    // TypeScript isn't able to infer the output of the subclass's
    // `connectChild` function by just accessing `this`, so we need to pass
    // in the subclass if we want access to a correctly typed output :-(
    getTypedChild<Child>(component: { connectChild?: () => GovernElement<any, Child> | null }): Child {
        return this.impl.getFix().child as any
    }

    getTypedValue<Value>(component: { publish: () => Value }): Value {
        return this.impl.subject.getValue() as any
    }
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
