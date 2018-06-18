import { CombinedValue, Key, FlatMapProps, MapProps, SFC, ConstantProps, DistinctProps, Subscribable } from './Core'
import { GovernElement, createElement } from './GovernElement'

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
): GovernElement<CombinedValue<Children>, { children: Children }> {
    return createElement('combine', { children })
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