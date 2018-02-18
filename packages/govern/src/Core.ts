import { TransactionalObservable } from './TransactionalObservable'
import { GovernElement } from './Element'
import { GovernableClass } from './Governable'
import { Outlet } from './Outlet'

export type BuiltInType = 'map' | 'subscribe' | 'combine' | 'combineArray' | 'constant'
export type ComponentType<Props, Value> = GovernableClass<Props, Value> | StatelessComponent<Props, Value>;
export type GovernType<Props = any, Value = any> = BuiltInType | ComponentType<Props, Value>;

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

// tslint:disable-next-line:interface-over-type-literal
export type ComponentState = {};

export type MapProps<FromValue, ToValue> = {
    from: Outlet<FromValue> | GovernElement<any, FromValue>,
    to: SFC<FromValue, ToValue>,
}

export type CombineChildren<Keys extends keyof CombinedValue, CombinedValue> = {
    [K in Keys]: Outlet<CombinedValue[K]> | GovernElement<any, CombinedValue[K]> | CombinedValue[K]
}
export type CombineProps<CombinedValue> = {
    children: CombineChildren<keyof CombinedValue, CombinedValue>
}

export type CombineArrayChildren<ItemValue> = {
    [index: number]: Outlet<ItemValue> | GovernElement<any, ItemValue> | ItemValue
}
export type CombineArrayProps<ItemValue> = {
    children: CombineArrayChildren<ItemValue>
}

export type ConstantProps<Value> = {
    of: Value,
}

export type SubscribeProps<Value> = {
    to: TransactionalObservable<Value>,
}

export type GovernNode<Props = any, Value = any> =
    Outlet<Value> | 
    GovernElement<Props, Value> |
    CombineChildren<keyof Value, Value> |
    Value

export type SFC<Props, Value> = StatelessComponent<Props, Value>;
export interface StatelessComponent<Props, Value> {
    (props: Props): GovernNode<any, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}
