import { GovernElement } from './Element'
import { GovernableClass } from './Governable'
import { TransactionalObservable } from './Observable'

export type BuiltInType = 'map' | 'sink' | 'source' | 'shape'
export type ComponentType<P, O> = GovernableClass<P, O> | StatelessComponent<P, O>;
export type GovernType<P = any, O = any> = BuiltInType | ComponentType<P, O>;

export type Key = string | number;

export interface Attributes {
    key?: Key;
}

// tslint:disable-next-line:interface-over-type-literal
export type ComponentState = {};

export type MapProps<FromOut, ToOut> = {
    from: GovernElementLike<any, FromOut>,
    to: SFC<FromOut, ToOut>,
}

export type ShapeChildren<Keys extends keyof O, O> = {
    // TODO: Is it possible to infer O[K] from nested objects's elements, as
    //       opposed to inferring the element itself?
    // e.g. infer type of output.c.d as string instead of element
    // let element = createElement('source', {
    //     children: {
    //       a: 1,
    //       b: createElement('sink', { observable: o1 }),
    //       c: {
    //         d: createElement('sink', { observable: o1 })
    //       },
    //     }
    //   })
    [K in Keys]: GovernElement<any, O[K]> | ShapeChildren<keyof O[K], O[K]> | O[K]
}
export type ShapeProps<O> = {
    children: ShapeChildren<keyof O, O>
}

export type SinkProps<T> = {
    from: TransactionalObservable<T>,
}
export type SourceProps<O> = {
	children: GovernElementLike<any, O>,
}

export type GovernElementLike<P, O> =
    GovernElement<P, O> |
    ShapeChildren<keyof O, O>

export type GovernNode<P = any, O = any> = GovernElementLike<P, O> | O

export type SFC<P, O> = StatelessComponent<P, O>;
export interface StatelessComponent<P, O> {
    (props: P): GovernNode<any, O>;
    defaultProps?: Partial<P>;
    displayName?: string;
}
