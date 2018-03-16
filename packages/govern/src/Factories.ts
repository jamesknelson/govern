import { Store } from './Store'
import { Attributes, BuiltInType, Key, GovernNode, FlatMapProps, MapProps, SFC, CombineArrayChildren, CombineArrayProps, CombineChildren, CombineProps, ConstantProps, DistinctProps } from './Core'
import { GovernElement, SFCElement, ComponentElement, createElement } from './Element'
import { GovernableClass } from './StoreGovernor'

type Factory<Props, Value> = (props?: Attributes & Props, ...children: GovernNode[]) => GovernElement<Props, Value>;

type SFCFactory<Props, Value> = (props?: Attributes & Props, ...children: GovernNode[]) => SFCElement<Props, Value>;

type ComponentFactory<Props, Value> = (props?: Attributes & Props, ...children: GovernNode[]) => ComponentElement<Props, Value>;

// Custom components
function createFactory<Props, Value>(type: SFC<Props, Value>): SFCFactory<Props, Value>;
function createFactory<Props, Value>(type: GovernableClass<Props, Value>): Factory<Props, Value>
function createFactory<Props, Value>(type: GovernableClass<Props, Value> | SFC<Props, Value>): Factory<Props, Value> {
    return (props: Props, ...children: GovernNode[]) => createElement(type as any, props, ...children)   
}

export function flatMap<FromValue, ToValue>(
    from: GovernElement<any, FromValue> | Store<FromValue>,
    to: (props: FromValue) => Store<ToValue> | GovernElement<any, ToValue>,
    key?: Key
): GovernElement<FlatMapProps<FromValue, ToValue>, ToValue> {
    return createElement('flatMap', { from, to, key })
}

export function map<FromValue, ToValue>(
    from: GovernElement<any, FromValue> | Store<FromValue>,
    to: (props: FromValue) => ToValue,
    key?: Key
): GovernElement<MapProps<FromValue, ToValue>, ToValue> {
    return createElement('map', { from, to, key })
}

export function combine<CombinedValue>(
    children: CombineChildren<keyof CombinedValue, CombinedValue>,
    key?: Key
): GovernElement<CombineProps<CombinedValue>, CombinedValue> {
    return createElement('combine', { children, key })
}

export function combineArray<ItemValue>(
    children: CombineArrayChildren<ItemValue>,
    key?: Key
): GovernElement<CombineArrayProps<ItemValue>, ItemValue[]> {
    return createElement('combineArray', { children, key })
}

export function constant<Value>(
    of: Value,
    key?: Key
): GovernElement<ConstantProps<Value>, Value> {
    return createElement('constant', { of, key })
}

export function distinct<Value>(
    children: Store<Value> | GovernElement<any, Value> | Value,
    by?: (x: Value, y: Value) => boolean
): GovernElement<DistinctProps<Value>, Value> {
    return createElement('distinct', { children, by })
}