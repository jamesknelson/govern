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
import { Outlet } from './Outlet'

const RESERVED_PROPS = {
    key: true,

    // This isn't used yet, but treating it as reserved in case we add ref
    // support in the future.
    ref: true,
}

function hasValidKey(config) {
    return config.key !== undefined
}

const BUILT_IN_TYPES = [
    'combine',
    'map',
    'outlet',
    'subscribe',
]

/**
 * Checks if an object is a GovernElement. I'm using duck typing here instead
 * of checking checking the value of `$$typeof`, as I want to be able to work
 * with elements created with `React.createElement` as well.
 * TODO: In dev mode, for functions, check that a `publish` method exists on
 * the prototype (if a prototype exists), ensuring that `type` refers to a
 * govern component instead of a React component.
 */
export function isValidElement(object) {
    return (
        typeof object === 'object' &&
        object !== null &&
        object.type &&
        ((typeof object.type === 'function') ||
         (typeof object.type === 'string' && BUILT_IN_TYPES.indexOf(object.type) !== -1)) &&
        ('props' in object) &&
        ('key' in object)
    )
}


export interface GovernElement<Props, Value> {
    type: string | GovernableClass<Props, Value> | SFC<Props, Value>;
    props: Props;
    key: Key | null;

    // This isn't ever actually set, as it doesn't make sense for an element
    // to have an output. However, it can be used to access the type of the
    // element's output in TypeScript types.
    value: Value;
}
export interface SFCElement<Props, Value> extends GovernElement<Props, Value> {
    type: SFC<Props, Value>;
}
export interface ComponentElement<Props, Value> extends GovernElement<Props, Value> {
    type: GovernableClass<Props, Value>;
}

export function createElement<FromValue, ToValue>(
    type: 'map',
    props?: Attributes & MapProps<FromValue, ToValue>
): GovernElement<MapProps<FromValue, ToValue>, ToValue>
export function createElement<Value>(
    type: 'subscribe',
    props?: Attributes & SubscribeProps<Value>
): GovernElement<SubscribeProps<Value>, Value>

export function createElement<Value>(
    type: 'outlet',
    props?: Attributes & OutletSourceProps<Value> | null,
    children?: GovernElementLike<any, Value>
): GovernElement<OutletSourceProps<Value>, Outlet<Value>>

export function createElement<CombinedValue>(
    type: 'combine',
    props?: Attributes & CombineProps<CombinedValue> | null,
    children?: CombineChildren<keyof CombinedValue, CombinedValue>
): GovernElement<CombineProps<CombinedValue>, CombinedValue>

// Custom components
export function createElement<Props, Value>(
    type: SFC<Props, Value>,
    props?: Attributes & Props | null,
    ...children: GovernNode[]): SFCElement<Props, Value>;
export function createElement<Props, Value>(
    type:
        (new (props: Props) => { props: Props }) &
        (new (props: Props) => {
            publish(): Value;
        }),
    props?: Attributes & Props | null,
    ...children: GovernNode[]): ComponentElement<Props, Value>;
export function createElement<Props, Value>(
    type: any,
    config?: Attributes & Props | null,
    ...children: GovernNode[]
): GovernElement<Props, Value> {
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
        value: <any>undefined,
    }
}
