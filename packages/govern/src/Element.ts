/*
MIT License

Copyright (c) 2013-present, Facebook, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { GovernableClass } from './Governable'
import { Attributes, BuiltInType, Key, GovernElementLike, GovernNode, MapProps, SFC, ShapeChildren, ShapeProps, SubscribeProps, OutletSourceProps } from './Core'
import { Outlet, Observable } from './Observable'

const RESERVED_PROPS = {
    key: true,

    // This isn't used yet, but treating it as reserved in case we add ref
    // support in the future.
    ref: true,
}

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
const hasSymbol = typeof Symbol === 'function' && Symbol.for;

const GOVERN_ELEMENT_TYPE = hasSymbol ? Symbol.for('govern.element') : '_GOVERN_ELEMENT'

function hasValidKey(config) {
    return config.key !== undefined
}


/**
 * Verifies the object is a ReactElement.
 */
export function isValidElement(object) {
    return (
        typeof object === 'object' &&
        object !== null &&
        object.$$typeof === GOVERN_ELEMENT_TYPE
    )
}


export interface GovernElement<P, O> {
    type: string | GovernableClass<P, O> | SFC<P, O>;
    props: P;
    key: Key | null;

    $$typeof: any;

    // This isn't ever actually set, as it doesn't make sense for an element
    // to have an output. However, it can be used to access the type of the
    // element's output in TypeScript types.
    output: O;
}
export interface SFCElement<P, O> extends GovernElement<P, O> {
    type: SFC<P, O>;
}
export interface ComponentElement<P, O> extends GovernElement<P, O> {
    type: GovernableClass<P, O>;
}

export function createElement<FromOut, ToOut>(
    type: 'map',
    props?: Attributes & MapProps<FromOut, ToOut>
): GovernElement<MapProps<FromOut, ToOut>, ToOut>
export function createElement<T>(
    type: 'subscribe',
    props?: Attributes & SubscribeProps<T>
): GovernElement<SubscribeProps<T>, T>

export function createElement<O>(
    type: 'outlet',
    props?: Attributes & OutletSourceProps<O> | null,
    children?: GovernElementLike<any, O>
): GovernElement<OutletSourceProps<O>, Outlet<O>>

export function createElement<O>(
    type: 'shape',
    props?: Attributes & ShapeProps<O> | null,
    children?: ShapeChildren<keyof O, O>
): GovernElement<ShapeProps<O>, O>

// Custom components
export function createElement<P, O>(
    type: SFC<P, O>,
    props?: Attributes & P | null,
    ...children: GovernNode[]): SFCElement<P, O>;
export function createElement<P, O>(
    type:
        (new (props: P) => { props: P }) &
        (new (props: P) => {
            render(): O;
        }),
    props?: Attributes & P | null,
    ...children: GovernNode[]): ComponentElement<P, O>;
export function createElement<P, O>(
    type: any,
    config?: Attributes & P | null,
    ...children: GovernNode[]
): GovernElement<P, O> {
    let propName
    
    // Reserved names are extracted
    let props = {} as { children?: any }
    
    let key = null as any
    let ref = null
    
    if (!!config) {
        if (hasValidKey(config)) {
            key = '' + config.key;
        }
    
        // Remaining properties are added to a new props object
        for (propName in config) {
            if (
                config.hasOwnProperty(propName) &&
                !RESERVED_PROPS.hasOwnProperty(propName)
            ) {
                props[propName] = config[propName];
            }
        }
    }
    
    // Children can be more than one argument, and those are transferred onto
    // the newly allocated props object.
    if (children.length === 1) {
        props.children = children[0];
    }
    else if (children.length > 1) {
        props.children = children;
    }
    
    // Resolve default props
    if (type && typeof type !== 'string' && type.defaultProps) {
        const defaultProps = type.defaultProps;
        for (propName in defaultProps) {
            if (props[propName] === undefined) {
                props[propName] = defaultProps[propName];
            }
        }
    }

    return {
        type,
        props: props as P,
        key,
        $$typeof: GOVERN_ELEMENT_TYPE,
        output: <any>undefined,
    }
}
