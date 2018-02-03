import { GovernElement } from './Element'
import { GovernableClass } from './Governable'
import { TransactionalObservable } from './Observable'

export type BuiltInType = 'map' | 'subscribe' | 'outlet' | 'combine'
export type ComponentType<Props, Value> = GovernableClass<Props, Value> | StatelessComponent<Props, Value>;
export type GovernType<Props = any, Value = any> = BuiltInType | ComponentType<Props, Value>;

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

// tslint:disable-next-line:interface-over-type-literal
export type ComponentState = {};

export type MapProps<FromValue, ToValue> = {
    from: GovernElementLike<any, FromValue>,
    to: SFC<FromValue, ToValue>,
}

export type CombineChildren<Keys extends keyof Value, Value> = {
    [K in Keys]: GovernElement<any, Value[K]> | CombineChildren<keyof Value[K], Value[K]> | Value[K]
}
export type CombineProps<Value> = {
    children: CombineChildren<keyof Value, Value>
}

export type SubscribeProps<Value> = {
    to: TransactionalObservable<Value>,
}
export type OutletSourceProps<Value> = {
	children: GovernElementLike<any, Value>,
}

export type GovernElementLike<Props, Value> =
    GovernElement<Props, Value> |
    CombineChildren<keyof Value, Value>

export type GovernNode<Props = any, Value = any> = GovernElementLike<Props, Value> | Value

export type SFC<Props, Value> = StatelessComponent<Props, Value>;
export interface StatelessComponent<Props, Value> {
    (props: Props): GovernNode<any, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}
