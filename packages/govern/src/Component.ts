import { Governable, GovernableClass } from './Governable'
import { ComponentState, GovernNode } from './Core'
import { ComponentImplementation } from './ComponentImplementation'
import { ComponentLifecycle } from './ComponentLifecycle'

export interface ComponentClass<P, O=any> extends GovernableClass<P, O> {
    new (props: P): Component<P, ComponentState, O>;
    defaultProps?: Partial<P>;
    displayName?: string;
}

export interface Component<P={}, S={}, C=any, O=any> extends ComponentLifecycle<P, S, C, O> { }

export abstract class Component<P, S={}, C=any, O=any> implements Governable<P, O>, ComponentLifecycle<P, S, C, O> {
    protected impl: ComponentImplementation<P, S, C, O>;

    constructor(props: P, { strict }: { strict?: boolean } = {}) {
        this.impl = new ComponentImplementation(this, props, !!strict)
    }

    get props() { return this.impl.props }
    get comp() {
        if (this.impl.isComposing) {
            throw new Error(`You cannot access a component's "output" property within its "render" method. See component "${getDisplayName(this.constructor)}".`)
        }
        return this.impl.comp
    }
    get state() { return this.impl.state }

    set state(state: S) {
        if (this.impl.governor) {
            throw new Error(`You cannot set a component's state directly outside of the constructor. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.state = state
    }

    setState<K extends keyof S>(
        state: ((prevState: Readonly<S>, props: P) => (Pick<S, K> | S)) | (Pick<S, K> | S),
        callback?: () => void
    ): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "setState" within a component's constructor. Instead, set the "state" property directly. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDisposed) {
            throw new Error(`You cannot call "setState" on a component instance that has been disposeed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isComposing) {
            throw new Error(`You cannot call "setState" within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
        }

        let updater = state as ((prevState: Readonly<S>, props: P) => any)
        if (typeof state !== 'function') {
            updater = () => state
        }
        this.impl.enqueueSetState(updater, callback)
    }

    transaction(run: Function): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "action" within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDisposed) {
            throw new Error(`You cannot call "action" on a component instance that has been disposeed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isComposing) {
            throw new Error(`You cannot call "action" within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.increaseTransactionLevel()
        run()
        this.impl.decreaseTransactionLevel()
    }

    createGovernor() {
        return this.impl.createGovernor()
    }

    abstract render(): O;

    // TypeScript isn't able to infer the output of the subclass's `render`
    // function by just accessing `this`, so we need to pass in the subclass
    // if we want access to a correctly typed output :-(
    getTypedComp<C>(component: { compose: () => GovernNode<any, C> | null }): C {
        return this.impl.comp as any
    }
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
