import * as Observable from 'zen-observable'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC } from 'govern'

describe('Outlet', () => {
    describe('#map', () => {
        it("maps via getValue()", () => {
            let governor = createGovernor(combine({ x: 2 })) as any
            let mappedOutlet = governor.map(({ x }) => x * 2)
            expect(mappedOutlet.getValue()).toBe(4)
        })
    })
})