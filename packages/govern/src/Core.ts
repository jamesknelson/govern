import { GovernElement } from './Element'
import { GovernableClass } from './StoreGovernor'
import { Store } from './Store'

export type BuiltInType = 'combine' | 'combineArray' | 'constant' | 'distinct' | 'flatMap' | 'map' | 'subscribe'
export type ComponentType<Props, Value> = GovernableClass<Props, Value> | StatelessComponent<Props, Value>;
export type GovernType<Props = any, Value = any> = BuiltInType | ComponentType<Props, Value>;

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

// tslint:disable-next-line:interface-over-type-literal
export type ComponentState = {};

export type MapProps<FromValue, ToValue> = {
    from: Store<FromValue> | GovernElement<any, FromValue>,
    to: (props: FromValue) => ToValue
}

export type FlatMapProps<FromValue, ToValue> = {
    from: Store<FromValue> | GovernElement<any, FromValue>,
    to: (props: FromValue) => Store<ToValue> | GovernElement<any, ToValue>
}

export type CombineChildren<Keys extends keyof CombinedValue, CombinedValue> = {
    [K in Keys]: Store<CombinedValue[K]> | GovernElement<any, CombinedValue[K]> | CombinedValue[K]
}
export type CombineProps<CombinedValue> = {
    children: CombineChildren<keyof CombinedValue, CombinedValue>
}

export type CombineArrayChildren<ItemValue> = {
    [index: number]: Store<ItemValue> | GovernElement<any, ItemValue> | ItemValue
}
export type CombineArrayProps<ItemValue> = {
    children: CombineArrayChildren<ItemValue>
}

export type ConstantProps<Value> = {
    of: Value,
}

export type DistinctProps<Value> = {
    // Defaults to reference equality
    by?: (x: Value, y: Value) => boolean,

    children: Store<Value, any> | GovernElement<any, Value> | Value
}

export type SubscribeProps<Value> = {
    to: Store<Value>,
}

export type GovernNode<Props = any, Value = any> =
    Store<Value> | 
    GovernElement<Props, Value> |
    CombineChildren<keyof Value, Value> |
    Value

export type SFC<Props, Value> = StatelessComponent<Props, Value>;
export interface StatelessComponent<Props, Value> {
    (props: Props): GovernNode<any, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}
