import { GovernObservable } from './GovernObservable'
import { Attributes, BuiltInType, Key, FlatMapProps, MapProps, SFC, CombineArrayChildren, CombineArrayProps, CombineChildren, CombineProps, ConstantProps, DistinctProps, Subscribable } from './Core'
import { GovernElement, SFCElement, ComponentElement, createElement } from './GovernElement'
import { GovernableClass } from './GovernObservableGovernor'

type Factory<Value, Props> = (props?: Attributes & Props, ...children: any[]) => GovernElement<Value, Props>;

type SFCFactory<Value, Props> = (props?: Attributes & Props, ...children: any[]) => SFCElement<Value, Props>;

type ComponentFactory<Value, Props> = (props?: Attributes & Props, ...children: any[]) => ComponentElement<Value, Props>;

// Custom components
function createFactory<Value, Props>(type: SFC<Value, Props>): SFCFactory<Value, Props>;
function createFactory<Value, Props>(type: GovernableClass<Value, Props>): Factory<Value, Props>
function createFactory<Value, Props>(type: GovernableClass<Value, Props> | SFC<Value, Props>): Factory<Value, Props> {
    return (props: Props, ...children: any[]) => createElement(type as any, props, ...children)   
}

export function flatMap<FromValue, ToValue>(
    from: Subscribable<FromValue>,
    to: (props: FromValue) => Subscribable<ToValue>,
    key?: Key
): GovernElement<ToValue, FlatMapProps<FromValue, ToValue>> {
    return createElement('flatMap', { from, to, key })
}

export function map<FromValue, ToValue>(
    from: Subscribable<FromValue>,
    to: (props: FromValue) => ToValue,
    key?: Key
): GovernElement<ToValue, MapProps<FromValue, ToValue>> {
    return createElement('map', { from, to, key })
}

export function combine<Children extends { [name: string]: any }>(
    children: Children,
    key?: Key
  ): GovernElement<{
    [K in keyof Children]:
      Children[K] extends Subscribable<infer SubscribableSnapshot> ? SubscribableSnapshot :
      Children[K] extends GovernObservable<infer ObservableSnapshot> ? ObservableSnapshot :
      Children[K] extends GovernElement<infer ElementSnapshot> ? ElementSnapshot :
      Children[K]
  }, any> {
    return createElement('combine', { children }) as any
  }

export function combineArray<ItemValue>(
    children: CombineArrayChildren<ItemValue>,
    key?: Key
): GovernElement<ItemValue[], CombineArrayProps<ItemValue>> {
    return createElement('combineArray', { children, key })
}

export function constant<Value>(
    of: Value,
    key?: Key
): GovernElement<Value, ConstantProps<Value>> {
    return createElement('constant', { of, key })
}

export function distinct<Value>(
    children: Subscribable<Value> | Value,
    by?: (x: Value, y: Value) => boolean
): GovernElement<Value, DistinctProps<Value>> {
    return createElement('distinct', { children, by })
}