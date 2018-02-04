import { Outlet, TransactionalObservable } from 'outlets'
import { Attributes, BuiltInType, Key, GovernElementLike, GovernNode, MapProps, SFC, CombineChildren, CombineProps, SubscribeProps, OutletSourceProps } from './Core'
import { GovernElement, SFCElement, ComponentElement, createElement } from './Element'
import { GovernableClass } from './Governable'

type Factory<Props, Value> = (props?: Attributes & Props, ...children: GovernNode[]) => GovernElement<Props, Value>;

type SFCFactory<Props, Value> = (props?: Attributes & Props, ...children: GovernNode[]) => SFCElement<Props, Value>;

type ComponentFactory<Props, Value> = (props?: Attributes & Props, ...children: GovernNode[]) => ComponentElement<Props, Value>;

// Custom components
function createFactory<Props, Value>(type: SFC<Props, Value>): SFCFactory<Props, Value>;
function createFactory<Props, Value>(type: GovernableClass<Props, Value>): Factory<Props, Value>
function createFactory<Props, Value>(type: GovernableClass<Props, Value> | SFC<Props, Value>): Factory<Props, Value> {
    return (props: Props, ...children: GovernNode[]) => createElement(type as any, props, ...children)   
}

export function subscribe<Value>(
    to: TransactionalObservable<Value>,
    key?: Key
): GovernElement<SubscribeProps<Value>, Value> {
    return createElement('subscribe', { to, key })
}

export function map<FromValue, ToValue>(
    from: GovernElement<any, FromValue>,
    to: SFC<FromValue, ToValue>,
    key?: Key
): GovernElement<MapProps<FromValue, ToValue>, ToValue> {
    return createElement('map', { from, to, key })
}

export function outlet<Value = any>(
    element: GovernElementLike<any, Value>,
    key?: Key
): GovernElement<OutletSourceProps<Value>, Outlet<Value>> {
    return createElement('outlet', { children: element, key })
}

export function combine<Value>(
    children: CombineChildren<keyof Value, Value>,
    key?: Key
): GovernElement<CombineProps<Value>, Value> {
    return createElement('combine', { children, key })
}
