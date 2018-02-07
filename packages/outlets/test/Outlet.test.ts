import * as Observable from 'zen-observable'
import { OutletSubject, Outlet } from '../src'

describe('Outlet', () => {
    describe('#map', () => {
        it("maps via getValue()", () => {
            let subject = new OutletSubject({ x: 2 })
            let outlet = new Outlet(subject)
            let mappedOutlet = outlet.map(({ x }) => x * 2)
            expect(mappedOutlet.getValue()).toBe(4)
        })
    })

    it('can be unsubscribed from', () => {
        let subject = new OutletSubject(1)
        let outlet = new Outlet(subject)
        let latest
        let subscription = outlet.subscribe(next => { latest = next })
        subscription.unsubscribe()
        subject.next(2)
        expect(latest).toBe(1)
    })
})