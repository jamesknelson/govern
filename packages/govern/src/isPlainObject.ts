/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

import { isValidElement } from './Element'

function isObject(x) {
	return typeof x === 'object' && x !== null;
}

function isObjectObject(o) {
    return isObject(o) === true
      && Object.prototype.toString.call(o) === '[object Object]';
  }

export function isPlainObject(o) {
    let ctor, prot

    if (isValidElement(o)) return false;
  
    if (isObjectObject(o) === false) return false;
  
    // If has modified constructor
    ctor = o.constructor;
    if (typeof ctor !== 'function') return false;
  
    // If has modified prototype
    prot = ctor.prototype;
    if (isObjectObject(prot) === false) return false;
  
    // If constructor does not have an Object-specific method
    if (prot.hasOwnProperty('isPrototypeOf') === false) {
      return false;
    }
  
    // Most likely a plain Object
    return true;
  };