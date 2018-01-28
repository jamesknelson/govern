import { isPlainObject } from './isPlainObject'
import { GovernNode } from './Core'
import { createElement, GovernElement } from './Element'

export function convertToElementIfPossible(node: GovernNode): GovernNode {
    // Plain objects and arrays are treated as elements with type `shape`,
    // with the object or array being the element's children.
    if (isPlainObject(node) || Array.isArray(node)) {
        return createElement("shape", { children: node })
    }
    else {
        return node
    }
}