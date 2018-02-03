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
import { Attributes, BuiltInType, Key, GovernElementLike, GovernNode, MapProps, SFC, CombineChildren, CombineProps, SubscribeProps, OutletSourceProps } from './Core'
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


export interface GovernElement<Props, T> {
    type: string | GovernableClass<Props, T> | SFC<Props, T>;
    props: Props;
    key: Key | null;

    $$typeof: any;

    // This isn't ever actually set, as it doesn't make sense for an element
    // to have an output. However, it can be used to access the type of the
    // element's output in TypeScript types.
    value: T;
}
export interface SFCElement<Props, T> extends GovernElement<Props, T> {
    type: SFC<Props, T>;
}
export interface ComponentElement<Props, T> extends GovernElement<Props, T> {
    type: GovernableClass<Props, T>;
}

export function createElement<FromT, ToT>(
    type: 'map',
    props?: Attributes & MapProps<FromT, ToT>
): GovernElement<MapProps<FromT, ToT>, ToT>
export function createElement<T>(
    type: 'subscribe',
    props?: Attributes & SubscribeProps<T>
): GovernElement<SubscribeProps<T>, T>

export function createElement<T>(
    type: 'outlet',
    props?: Attributes & OutletSourceProps<T> | null,
    children?: GovernElementLike<any, T>
): GovernElement<OutletSourceProps<T>, Outlet<T>>

export function createElement<T>(
    type: 'combine',
    props?: Attributes & CombineProps<T> | null,
    children?: CombineChildren<keyof T, T>
): GovernElement<CombineProps<T>, T>

// Custom components
export function createElement<Props, T>(
    type: SFC<Props, T>,
    props?: Attributes & Props | null,
    ...children: GovernNode[]): SFCElement<Props, T>;
export function createElement<Props, T>(
    type:
        (new (props: Props) => { props: Props }) &
        (new (props: Props) => {
            render(): T;
        }),
    props?: Attributes & Props | null,
    ...children: GovernNode[]): ComponentElement<Props, T>;
export function createElement<Props, T>(
    type: any,
    config?: Attributes & Props | null,
    ...children: GovernNode[]
): GovernElement<Props, T> {
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
        props: props as Props,
        key,
        $$typeof: GOVERN_ELEMENT_TYPE,
        value: <any>undefined,
    }
}
