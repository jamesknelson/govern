import { Store, getUniqueId } from '../../src'

export function createTestHarness<Value>(store: Store<Value, any>, onChange?: () => void): { dispatch: Function, value: Value, setProps: Function } {
    let harness = {
        dispatch: undefined as any,
        value: undefined as any,
        setProps: (props) => {
            let id = getUniqueId()
            store.transactionStart(id)
            store.setProps(props)
            store.transactionEnd(id)
        }
    }
    store.subscribe((value, dispatch) => {
        harness.value = value
        harness.dispatch = dispatch
        if (onChange) {
            onChange()
        }
    })
    return harness
}