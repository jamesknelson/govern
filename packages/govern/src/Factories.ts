import { Attributes, BuiltInType, Key, GovernElementLike, GovernNode, MapProps, SFC, CombineChildren, CombineProps, SubscribeProps, OutletSourceProps } from './Core'
import { GovernElement, SFCElement, ComponentElement, createElement } from './Element'
import { GovernableClass } from './Governable'
import { Outlet, TransactionalObservable } from './Observable'

type Factory<Props, T> = (props?: Attributes & Props, ...children: GovernNode[]) => GovernElement<Props, T>;

type SFCFactory<Props, T> = (props?: Attributes & Props, ...children: GovernNode[]) => SFCElement<Props, T>;

type ComponentFactory<Props, T> = (props?: Attributes & Props, ...children: GovernNode[]) => ComponentElement<Props, T>;

// Custom components
function createFactory<Props, T>(type: SFC<Props, T>): SFCFactory<Props, T>;
function createFactory<Props, T>(type: GovernableClass<Props, T>): Factory<Props, T>
function createFactory<Props, T>(type: GovernableClass<Props, T> | SFC<Props, T>): Factory<Props, T> {
    return (props: Props, ...children: GovernNode[]) => createElement(type as any, props, ...children)   
}

export function subscribe<T>(
    to: TransactionalObservable<T>,
    key?: Key
): GovernElement<SubscribeProps<T>, T> {
    return createElement('subscribe', { to, key })
}

export function map<FromT, ToT>(
    from: GovernElementLike<any, FromT>,
    to: SFC<FromT, ToT>,
    key?: Key
): GovernElement<MapProps<FromT, ToT>, ToT> {
    return createElement('map', { from, to, key })
}

export function outlet<T = any>(
    element: GovernElementLike<any, T>,
    key?: Key
): GovernElement<OutletSourceProps<T>, Outlet<T>> {
    return createElement('outlet', { children: element, key })
}

export function combine<T>(
    children: CombineChildren<keyof T, T>,
    key?: Key
): GovernElement<CombineProps<T>, T> {
    return createElement('combine', { children, key })
}
