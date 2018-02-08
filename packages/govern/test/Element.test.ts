import * as React from 'react'
import { createElement, isValidElement, Component } from '../src'


describe('isValidElement', () => {
    class TestComponent extends Component<any, { a: number, b: number, c: number }> {
        static defaultProps = {
          a: 1
        }
  
        publish() {
          return {
                a: this.props.a,
                b: 2,
                c: this.props.c,
          }
        }
    }

    it("returns true for valid elements created with Govern.createElement", () => {
        let element = createElement(TestComponent as any, { c: 3 }) as any
        expect(isValidElement(element)).toBe(true)
    })

    it("returns true for valid elements created with React.createElement", () => {
        let element = React.createElement(TestComponent as any, { c: 3 }) as any
        expect(isValidElement(element)).toBe(true)
    })

    it("returns false for html-like elements", () => {
        let element = createElement('div' as any, { className: 'test' }) as any
        expect(isValidElement(element)).toBe(false)
    })
})