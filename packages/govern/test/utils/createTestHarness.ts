import { Outlet, getUniqueId } from '../../src'

export function createTestHarness<Value>(outlet: Outlet<Value, any>, onChange?: () => void): { dispatch: Function, value: Value, setProps: Function } {
    let harness = {
        dispatch: undefined as any,
        value: undefined as any,
        setProps: (props) => {
            let id = getUniqueId()
            outlet.transactionStart(id)
            outlet.setProps(props)
            outlet.transactionEnd(id)
        }
    }
    outlet.subscribe((value, dispatch) => {
        harness.value = value
        harness.dispatch = dispatch
        if (onChange) {
            onChange()
        }
    })
    return harness
}