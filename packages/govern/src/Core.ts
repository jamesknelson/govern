import { GovernElement } from './Element'
import { GovernableClass } from './Governable'
import { TransactionalObservable } from './Observable'

export type BuiltInType = 'map' | 'subscribe' | 'outlet' | 'combine'
export type ComponentType<Props, T> = GovernableClass<Props, T> | StatelessComponent<Props, T>;
export type GovernType<Props = any, T = any> = BuiltInType | ComponentType<Props, T>;

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

// tslint:disable-next-line:interface-over-type-literal
export type ComponentState = {};

export type MapProps<FromT, ToT> = {
    from: GovernElementLike<any, FromT>,
    to: SFC<FromT, ToT>,
}

export type CombineChildren<Keys extends keyof T, T> = {
    [K in Keys]: GovernElement<any, T[K]> | CombineChildren<keyof T[K], T[K]> | T[K]
}
export type CombineProps<T> = {
    children: CombineChildren<keyof T, T>
}

export type SubscribeProps<T> = {
    to: TransactionalObservable<T>,
}
export type OutletSourceProps<T> = {
	children: GovernElementLike<any, T>,
}

export type GovernElementLike<Props, T> =
    GovernElement<Props, T> |
    CombineChildren<keyof T, T>

export type GovernNode<Props = any, T = any> = GovernElementLike<Props, T> | T

export type SFC<Props, T> = StatelessComponent<Props, T>;
export interface StatelessComponent<Props, T> {
    (props: Props): GovernNode<any, T>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}
