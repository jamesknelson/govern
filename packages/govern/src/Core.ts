import { GovernElement } from './Element'
import { GovernableClass } from './GovernObservableGovernor'
import { GovernObservable } from './GovernObservable'

export type BuiltInType = 'combine' | 'combineArray' | 'constant' | 'distinct' | 'flatMap' | 'map' | 'subscribe'
export type ComponentType<Value, Props> = GovernableClass<Value, Props> | StatelessComponent<Value, Props>;
export type GovernType<Value = any, Props = any> = BuiltInType | ComponentType<Value, Props>;
export type Subscribable<Value> = GovernElement<Value> | GovernObservable<Value>

type ReturnOf<T> = T extends (...args: any[]) => infer R ? R : never;
export type StoreValue<S extends GovernObservable<any>> = ReturnOf<S["getValue"]>
export type ElementValue<E extends GovernElement<any>> = E["value"]

export type Value<X extends Subscribable<any>> =
    X extends GovernObservable<infer T> ? T :
    X extends GovernElement<infer T> ? T :
    never

export type ValueOf<X extends ComponentType<any, any>> =
    X extends ComponentType<infer T, any> ? T : never


type ComponentClass<Value> =
    (new (props: any) => {
        publish(): Value;
    })

export type StoreOf<X extends ComponentClass<any> | StatelessComponent<any, any> | GovernElement<any, any>> =
    GovernObservable<
        X extends ComponentClass<infer T> ? T :
        X extends StatelessComponent<infer T, any> ? T :
        X extends GovernElement<infer T, any> ? T :
        never
    >

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

export type ComponentState = {};

export type MapProps<FromValue, ToValue> = {
    from: Subscribable<FromValue>,
    to: (props: FromValue) => ToValue
}

export type FlatMapProps<FromValue, ToValue> = {
    from: Subscribable<FromValue>,
    to: (props: FromValue) => Subscribable<ToValue>
}

export type CombineChildren<Keys extends keyof CombinedValue, CombinedValue> = {
    [K in Keys]: Subscribable<CombinedValue[K]> | CombinedValue[K]
}
export type CombineProps<CombinedValue> = {
    children: CombineChildren<keyof CombinedValue, CombinedValue>
}

export type CombineArrayChildren<ItemValue> = {
    [index: number]: Subscribable<ItemValue> | ItemValue
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

    children: Subscribable<Value> | Value
}

export type SubscribeProps<Value> = {
    to: GovernObservable<Value>,
}

export type GovernNode<Value = any, Props = any> =
    GovernObservable<Value> | 
    GovernElement<Value, Props> |
    CombineChildren<keyof Value, Value> |
    Value

export type SFC<Value, Props> = StatelessComponent<Value, Props>;
export interface StatelessComponent<Value, Props> {
    (props: Props): GovernNode<Value, any>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}
