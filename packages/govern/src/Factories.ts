import { Attributes, BuiltInType, Key, GovernElementLike, GovernNode, MapProps, SFC, CombineChildren, CombineProps, SubscribeProps, OutletSourceProps } from './Core'
import { GovernElement, SFCElement, ComponentElement, createElement } from './Element'
import { GovernableClass } from './Governable'
import { Outlet, TransactionalObservable } from './Observable'

type Factory<P, O> = (props?: Attributes & P, ...children: GovernNode[]) => GovernElement<P, O>;

type SFCFactory<P, O> = (props?: Attributes & P, ...children: GovernNode[]) => SFCElement<P, O>;

type ComponentFactory<P, O> = (props?: Attributes & P, ...children: GovernNode[]) => ComponentElement<P, O>;

// Custom components
function createFactory<P, O>(type: SFC<P, O>): SFCFactory<P, O>;
function createFactory<P, O>(type: GovernableClass<P, O>): Factory<P, O>
function createFactory<P, O>(type: GovernableClass<P, O> | SFC<P, O>): Factory<P, O> {
    return (props: P, ...children: GovernNode[]) => createElement(type as any, props, ...children)   
}

export function subscribe<T>(
    to: TransactionalObservable<T>,
    key?: Key
): GovernElement<SubscribeProps<T>, T> {
    return createElement('subscribe', { to, key })
}

export function map<FromOut, ToOut>(
    from: GovernElementLike<any, FromOut>,
    to: SFC<FromOut, ToOut>,
    key?: Key
): GovernElement<MapProps<FromOut, ToOut>, ToOut> {
    return createElement('map', { from, to, key })
}

export function outlet<O = any>(
    element: GovernElementLike<any, O>,
    key?: Key
): GovernElement<OutletSourceProps<O>, Outlet<O>> {
    return createElement('outlet', { children: element, key })
}

export function combine<O>(
    children: CombineChildren<keyof O, O>,
    key?: Key
): GovernElement<CombineProps<O>, O> {
    return createElement('combine', { children, key })
}
