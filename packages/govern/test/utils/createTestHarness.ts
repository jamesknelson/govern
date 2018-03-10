import { Store } from '../../src'

export function createTestHarness<Value>(store: Store<Value, any>, onChange?: () => void): { dispatch: Function, value: Value, setProps: Function } {
    let harness = {
        dispatch: store.governor.dispatcher.enqueueAction,
        value: store.getValue(),
        setProps: (props) => store.setProps(props),
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