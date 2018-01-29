import { Attributes, BuiltInType, Key, GovernElementLike, GovernNode, MapProps, SFC, ShapeChildren, ShapeProps, SinkProps, SourceProps } from './Core'
import { GovernElement, SFCElement, ComponentElement, createElement } from './Element'
import { GovernableClass } from './Governable'
import { Observable } from './Observable'

type Factory<P, O> = (props?: Attributes & P, ...children: GovernNode[]) => GovernElement<P, O>;

type SFCFactory<P, O> = (props?: Attributes & P, ...children: GovernNode[]) => SFCElement<P, O>;

type ComponentFactory<P, O> = (props?: Attributes & P, ...children: GovernNode[]) => ComponentElement<P, O>;

// Custom components
function createFactory<P, O>(type: SFC<P, O>): SFCFactory<P, O>;
function createFactory<P, O>(type: GovernableClass<P, O>): Factory<P, O>
function createFactory<P, O>(type: GovernableClass<P, O> | SFC<P, O>): Factory<P, O> {
    return (props: P, ...children: GovernNode[]) => createElement(type as any, props, ...children)   
}

export function sink<T>(
    observable: Observable<T>,
    key?: Key
): GovernElement<SinkProps<T>, T> {
    return createElement("sink", { observable, key })
}

export function map<FromOut, ToOut>(
    from: GovernElementLike<any, FromOut>,
    to: SFC<FromOut, ToOut>,
    key?: Key
): GovernElement<MapProps<FromOut, ToOut>, ToOut> {
    return createElement("map", { from, to, key })
}

export function source<O = any>(
    element: GovernElementLike<any, O>,
    key?: Key
): GovernElement<SourceProps<O>, Observable<O>> {
    return createElement("source", { children: element, key })
}

export function shape<O>(
    children: ShapeChildren<keyof O, O>,
    key?: Key
): GovernElement<ShapeProps<O>, O> {
    return createElement("shape", { children, key })
}
