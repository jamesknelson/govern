/* 
(The MIT License)
Copyright (c) 2014 Halász Ádám <mail@adamhalasz.com>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Based on:
https://github.com/adamhalasz/uniqid/blob/master/index.js
*/

export const getUniqueId: GetUniqueId = (prefix?: string) => {
    // Add a default prefix, so that if this module is loaded multiple times, 
    // different instances won't produce the same instance multiple times.
    if (!prefix && !getUniqueId.defaultPrefix) {
        getUniqueId.defaultPrefix = Math.random().toString(36).slice(2)
    }
    return (prefix || getUniqueId.defaultPrefix) + now().toString(36)
}

interface GetUniqueId {
    (): string
    defaultPrefix?: string
}


const now: Now = () => {
    let time = Date.now()
    let last = now.last || time;
    return now.last = time > last ? time : last + 1
}

interface Now {
    (): number
    last?: number
}
