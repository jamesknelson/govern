import { GovernElement } from './Element'
import { GovernableClass } from './Governable'
import { TransactionalObservable } from './Observable'

export type BuiltInType = 'map' | 'subscribe' | 'outlet' | 'shape'
export type ComponentType<P, O> = GovernableClass<P, O> | StatelessComponent<P, O>;
export type GovernType<P = any, O = any> = BuiltInType | ComponentType<P, O>;

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

// tslint:disable-next-line:interface-over-type-literal
export type ComponentState = {};

export type MapProps<FromOut, ToOut> = {
    from: GovernElementLike<any, FromOut>,
    to: SFC<FromOut, ToOut>,
}

export type ShapeChildren<Keys extends keyof O, O> = {
    [K in Keys]: GovernElement<any, O[K]> | ShapeChildren<keyof O[K], O[K]> | O[K]
}
export type ShapeProps<O> = {
    children: ShapeChildren<keyof O, O>
}

export type SubscribeProps<T> = {
    to: TransactionalObservable<T>,
}
export type OutletSourceProps<O> = {
	children: GovernElementLike<any, O>,
}

export type GovernElementLike<P, O> =
    GovernElement<P, O> |
    ShapeChildren<keyof O, O>

export type GovernNode<P = any, O = any> = GovernElementLike<P, O> | O

export type SFC<P, O> = StatelessComponent<P, O>;
export interface StatelessComponent<P, O> {
    (props: P): GovernNode<any, O>;
    defaultProps?: Partial<P>;
    displayName?: string;
}
