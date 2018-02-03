import { isPlainObject } from './isPlainObject'
import { GovernNode } from './Core'
import { isValidElement } from './Element'

export function doNodesReconcile(x?: GovernNode, y?: GovernNode) {
    if (x === y) return true
    if (!x && !y) return true
    if (!x || !y) return false
    
    let isXPlainObject = isPlainObject(x)
    let isYPlainObject = isPlainObject(y)

    if (isXPlainObject && isYPlainObject) return true
    if (isXPlainObject || isYPlainObject) return false

    let isXArray = Array.isArray(x)
    let isYArray = Array.isArray(y)

    if (isXArray && isYArray) return true
    if (isXArray || isYArray) return false

    let isXElement = isValidElement(x)
    let isYElement = isValidElement(y)

    if (isXElement && isYElement) {
        // Subscribes are a special case; their props are never updated as they're
        // handled directly by ComponentImplementation, so we consider them
        // different if their properties are not identical.
        return (
            x.type === 'subscribe'
                ? (y.type === 'subscribe' && x.props.to === y.props.to)
                : (x.type === y.type && x.key === y.key)
        )
    }
    else {
        // If we're not an element, object or array, we won't need to create or
        // dispose a governor, so we're good.
        return !isXElement && !isYElement
    }
}