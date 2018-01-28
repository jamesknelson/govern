import { Governable, GovernableClass } from './Governable'
import { GovernNode } from './Core'
import { ComponentImplementation, ComponentLifecycle } from './ComponentImplementation'

export abstract class Component<P, O, S={}> implements Governable<P, O>, ComponentLifecycle<P, O, S> {
    protected impl: ComponentImplementation<P, O, S>;

    constructor(props: P, { strict }: { strict?: boolean } = {}) {
        this.impl = new ComponentImplementation(this, props, !!strict)
    }

    get props() { return this.impl.props }
    get output() {
        if (this.impl.canDirectlySetOutput) {
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
        if (this.impl.canDirectlySetOutput) {
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
            if (this.impl.canDirectlySetOutput) {
                throw new Error(`You cannot call bound actions within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
            }

            this.impl.increaseBatchLevel()
            fn.apply(this, args)
            this.impl.decreaseBatchLevel()
        }) as any
    }

    action(run: Function): void {
        if (!this.impl.governor) {
            throw new Error(`You cannot call "action" within a component's constructor. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.isDestroyed) {
            throw new Error(`You cannot call "action" on a component instance that has been destroyed. See component "${getDisplayName(this.constructor)}".`)
        }
        if (this.impl.canDirectlySetOutput) {
            throw new Error(`You cannot call "action" within a component's "render" method. See component "${getDisplayName(this.constructor)}".`)
        }

        this.impl.increaseBatchLevel()
        run()
        this.impl.decreaseBatchLevel()
    }

    createGovernor() {
        return this.impl.createGovernor()
    }

    abstract render(): GovernNode | null;
}

export function getDisplayName(componentClass) {
    return componentClass.displayName || componentClass.name
}
