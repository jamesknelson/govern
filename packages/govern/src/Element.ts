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

import { GovernableClass } from './StoreGovernor'
import { Attributes, BuiltInType, Key, GovernNode, FlatMapProps, MapProps, SFC, CombineChildren, CombineArrayChildren, CombineProps, CombineArrayProps, ConstantProps, DistinctProps } from './Core'
import { Store, isValidStore } from './Store'
import { isPlainObject } from './utils/isPlainObject'

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
    'combineArray',
    'constant',
    'distinct',
    'flatMap',
    'map'
]

/**
 * Checks if an object is a GovernElement. I'm using duck typing here instead
 * of checking checking the value of `$$typeof`, as I want to be able to work
 * with elements created with `React.createElement` as well.
 * TODO: In dev mode, for functions, check that a `publish` method exists on
 * the prototype (if a prototype exists), ensuring that `type` refers to a
 * govern component instead of a React component.
 */
export function isValidElement(obj): obj is GovernElement<any, any> {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        obj.type &&
        ((typeof obj.type === 'function') ||
         (typeof obj.type === 'string' && BUILT_IN_TYPES.indexOf(obj.type) !== -1)) &&
        ('props' in obj) &&
        ('key' in obj)
    )
}


export interface GovernElement<Value, Props=any> {
    type: string | GovernableClass<Value, Props> | SFC<Value, Props>;
    props: Props;
    key: Key | null;

    // This isn't ever actually set, as it doesn't make sense for an element
    // to have an output. However, it can be used to access the type of the
    // element's output in TypeScript types.
    value: Value;
}
export interface SFCElement<Value, Props> extends GovernElement<Value, Props> {
    type: SFC<Value, Props>;
}
export interface ComponentElement<Value, Props> extends GovernElement<Value, Props> {
    type: GovernableClass<Value, Props>;
}

export function createElement<FromValue, ToValue>(
    type: 'flatMap',
    props?: Attributes & FlatMapProps<FromValue, ToValue>
): GovernElement<ToValue, FlatMapProps<FromValue, ToValue>>

export function createElement<FromValue, ToValue>(
    type: 'map',
    props?: Attributes & MapProps<FromValue, ToValue>
): GovernElement<ToValue, MapProps<FromValue, ToValue>>

export function createElement<CombinedValue>(
    type: 'combine',
    props?: Attributes & CombineProps<CombinedValue> | null,
    children?: CombineChildren<keyof CombinedValue, CombinedValue>
): GovernElement<CombinedValue, CombineProps<CombinedValue>>

export function createElement<ItemValue>(
    type: 'combineArray',
    props?: Attributes & CombineArrayProps<ItemValue> | null,
    children?: CombineArrayChildren<ItemValue>
): GovernElement<ItemValue[], CombineArrayProps<ItemValue>>

export function createElement<Value>(
    type: 'constant',
    props?: Attributes & ConstantProps<Value> | null,
): GovernElement<Value, ConstantProps<Value>>

export function createElement<Value>(
    type: 'distinct',
    props?: Attributes & DistinctProps<Value> | null,
): GovernElement<Value, DistinctProps<Value>>



// Custom components
export function createElement<Value, Props>(
    type: SFC<Value, Props>,
    props?: Attributes & Props | null,
    ...children: GovernNode[]): SFCElement<Value, Props>;
export function createElement<Value, Props>(
    type:
        (new (props: Props) => { props: Props }) &
        (new (props: Props) => {
            render(): GovernElement<Value> | Value;
        }),
    props?: Attributes & Props | null,
    ...children: GovernNode[]): ComponentElement<Value, Props>;

// When using generics, TypeScript can fail because no props match Attributes.
// This overload helps avoid this.
export function createElement<Value, Props>(
    type:
        (new (props: Props) => { props: Props }) &
        (new (props: Props) => {
            render(): GovernElement<Value> | Value;
        }),
    props?: Props | null,
    ...children: GovernNode[]): ComponentElement<Value, Props>;

export function createElement<Value, Props>(
    type: any,
    config?: Attributes & Props | null,
    ...children: GovernNode[]
): GovernElement<Value, Props> {
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

    if (typeof type === 'string' && BUILT_IN_TYPES.indexOf(type) === -1) {
        throw new Error(`"${type}" is not a valid type for a Govern Element.`)
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


export function cloneElement<Value, Props>(
    element: SFCElement<Value, Props>,
    props: Attributes & Props | null,
    ...children: GovernNode[]): SFCElement<Value, Props>;
export function cloneElement<Value, Props>(
    element: ComponentElement<Value, Props>,
    props: Attributes & Props | null,
    ...children: GovernNode[]): ComponentElement<Value, Props>;
export function cloneElement<Value, Props>(
    element: GovernElement<Value, Props>,
    props: Attributes & Props | null,
    ...children: GovernNode[]
): GovernElement<Value, Props>;

export function cloneElement<Value, Props>(
    element: any,
    config: Attributes & Props | null,
    ...children: GovernNode[]
): GovernElement<Value, Props> {
    let propName;

	// Original props are copied
	const props = Object.assign({}, element.props)

	// Reserved names are extracted
	let key = element.key;
	
	if (config != null) {
		if (hasValidKey(config)) {
			key = '' + config.key;
		}

		// Remaining properties override existing props
		let defaultProps;
		if (element.type && element.type.defaultProps) {
			defaultProps = element.type.defaultProps;
		}
		for (propName in config) {
			if (
				Object.prototype.hasOwnProperty.call(config, propName) &&
				!RESERVED_PROPS.hasOwnProperty(propName)
			) {
				if (config[propName] === undefined && defaultProps !== undefined) {
					// Resolve default props
					props[propName] = defaultProps[propName];
				} else {
					props[propName] = config[propName];
				}
			}
		}
	}

	// Children can be more than one argument, and those are transferred onto
	// the newly allocated props object.
	const childrenLength = arguments.length - 2;
	if (childrenLength === 1) {
		props.children = children;
	} else if (childrenLength > 1) {
		const childArray = Array(childrenLength);
		for (let i = 0; i < childrenLength; i++) {
			childArray[i] = arguments[i + 2];
		}
		props.children = childArray;
	}

	return {
        type: element.type,
        props: props as Props,
        key,
        value: <any>undefined,
    }
}

export function convertToElement(value): GovernElement<any, any> {
    if (isValidElement(value)) {
        return value
    }
    else if (isValidStore(value)) {
        return {
            type: 'subscribe',
            props: { to: value },
            key: null,
            value: <any>undefined,
        }
    }
    else if (Array.isArray(value)) {
        // Create a clone, in case the array is mutatively modified,
        // as adding children by mutation will break things.
        return createElement('combineArray', { children: value.slice(0) })
    }
    else if (isPlainObject(value)) {
        // Create a clone, in case the object is mutatively modified,
        // as adding children by mutation will break things.
        return createElement('combine', { children: { ...value } })
    }
    else {
        return createElement('constant', { of: value })
    }
}


export function doElementsReconcile(x?: GovernElement<any, any>, y?: GovernElement<any, any>) {
    if (x === y) return true
    if (!x && !y) return true
    if (!x || !y) return false
    
    return (
        x.type === 'subscribe'
            ? (y.type === 'subscribe' && x.props.to === y.props.to)
            : (x.type === y.type && x.key === y.key)
    )
}