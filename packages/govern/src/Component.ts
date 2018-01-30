import { Governable, GovernableClass } from './Governable'
import { ComponentState, GovernNode } from './Core'
import { ComponentImplementation, ComponentLifecycle } from './ComponentImplementation'

export interface ComponentClass<P, O=any> extends GovernableClass<P, O> {
    new (props: P): Component<P, ComponentState, O>;
    defaultProps?: Partial<P>;
    displayName?: string;
}

export interface Component<P={}, S={}, O=any> extends ComponentLifecycle<P, S, O> { }

export abstract class Component<P, S={}, O=any> implements Governable<P, O>, ComponentLifecycle<P, S, O> {
    protected impl: ComponentImplementation<P, S, O>;

    constructor(props: P, { strict }: { strict?: boolean } = {}) {
        this.impl = new ComponentImplementation(this, props, !!strict)
    }

    get props() { return this.impl.props }
    get output() {
        if (this.impl.isRendering) {
            throw new Error(`You cannot access a component's "output" property within its "render" method. See component "${getDisplayName(this.constructor)}".`)
        }
        return this.impl.output
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
        if (this.impl.isDestroyed) {
            throw new Error(`You cannot call "setState" on a component instance that has been destroyed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isRendering) {
            throw new Error(`You cannot call "setState" within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
        }

        let updater = state as ((prevState: Readonly<S>, props: P) => any)
        if (typeof state !== 'function') {
            updater = () => state
        }
        this.impl.enqueueSetState(updater, callback)
    }

    bindAction<F extends Function>(fn: F): F {
        return ((...args) => {
            if (!this.impl.governor) {
                throw new Error(`You cannot call bound actions within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
            }
            if (this.impl.isDestroyed) {
                throw new Error(`You cannot call bound actions on a component instance that has been destroyed. See component "${getDisplayName(this.constructor)}".`)
            }
            if (this.impl.isRendering) {
                throw new Error(`You cannot call bound actions within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
            }

            this.impl.increaseTransactionLevel()
            fn.apply(this, args)
            this.impl.decreaseTransactionLevel()
        }) as any
    }

    transaction(run: Function): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "action" within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDestroyed) {
            throw new Error(`You cannot call "action" on a component instance that has been destroyed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isRendering) {
            throw new Error(`You cannot call "action" within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.increaseTransactionLevel()
        run()
        this.impl.decreaseTransactionLevel()
    }

    createGovernor() {
        return this.impl.createGovernor()
    }

    abstract render(): GovernNode<any, O> | null;

    // TypeScript isn't able to infer the output of the subclass's `render`
    // function by just accessing `this`, so we need to pass in the subclass
    // if we want access to a correctly typed output :-(
    getTypedOutput<O>(component: { render: () => GovernNode<any, O> | null }): O {
        return this.impl.output as any
    }
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
