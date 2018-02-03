import * as Observable from 'zen-observable'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'

function createModelClass() {
  class ModelPrimitive extends Component<{ defaultValue, validate }, any> {
    static defaultProps = {
      validate: () => {},
    }

    constructor(props: { defaultValue, validate }) {
      super(props)
      this.state = {
        value: props.defaultValue
      }
    }

    change = (value) => {
      this.setState({ value }) 
    }

    render() {
      return {
        change: this.change,
        value: this.state.value,
        error: this.props.validate(this.state.value)
      }
    }
  }

  return class Model extends Component<{ defaultValue }> {
    static defaultProps = {
      defaultValue: {},
    }

    get comp() {
      return this.getTypedComp(this)
    }

    compose() {
      return combine({
        name: createElement(ModelPrimitive, {
          defaultValue: this.props.defaultValue.name as string,
          validate: (value) => {
            if (!value) {
              return ["Please enter your name"]
            }
          }
        }),
        email: createElement(ModelPrimitive, {
          defaultValue: this.props.defaultValue.email,
          validate: (value) => {
            if (!value || value.indexOf('@') === -1) {
              return ["Please enter an e-mail address"]
            }
          }
        }),
      })
    }

    render() {
      let error = {} as any
      if (this.comp.name.error) error.name = this.comp.name.error
      if (this.comp.email.error) error.email = this.comp.email.error
      if (!Object.keys(error).length) error = undefined

      return {
        children: this.comp,
        value: {
          name: this.comp.name.value,
          email: this.comp.email.value,
        },
        error: error,
        change: this.change,
      }
    }

    change = (value) => {
      this.transaction(() => {
        if (value.name) {
          this.comp.name.change(value.name)
        }
        if (value.email) {
          this.comp.email.change(value.email)
        }
      })
    }
  }
}

function createDataSourceClass() {
  return class DataSource extends Component<{}, { store }> {
    constructor(props) {
      super(props)
      this.state = { store: null }
    }

    get comp() {
      return this.getTypedComp(this)
    }

    receive = (store) => {
      this.setState({ store })
    }

    compose() {
      return outlet(combine(this.state.store))
    }

    render() {
      return {
        receive: this.receive,
        observable: this.comp
      }
    }
  }
}

function createFormControllerClass() {
  const Model = createModelClass()

  return class FormController extends StrictComponent<{ data }> {
    awaitingData: boolean = true

    get comp() {
      return this.getTypedComp(this)
    }

    compose() {
      return combine({
        data: subscribe(this.props.data),
        model: createElement(Model, null)
      })
    }

    render() {
      return this.comp
    }

    componentDidInstantiate() {
      this.receiveDataIfAvailable(this.comp.data)
    }

    componentDidUpdate(prevProps, prevState, prevComp) {
      this.receiveDataIfAvailable(prevComp.data)
    }

    receiveDataIfAvailable(output) {
      if (this.awaitingData && output && Object.keys(output).length > 0) {
        this.transaction(() => {
          this.awaitingData = false
          this.comp.model.change(output)
        })
      }
    }
  }
}

describe("Model", () => {
  const Model = createModelClass()

  it('returns expected initial value', () => {
    let governor = createGovernor(
      createElement(Model, {
        defaultValue: {
          name: 'James',
          email: 'james'
        }
      })
    )
    let output = governor.getValue()
    expect(output.value).toEqual({
      name: 'James',
      email: 'james',
    })
    expect(output.error.email).toBeTruthy()
  })

  it('notifies changes', () => {
    let governor = createGovernor(
      createElement(Model, {
        defaultValue: {
          name: 'James',
          email: 'james'
        }
      })
    )
    let latest
    governor.subscribe(value => {
      latest = value
    })
    governor.getValue().change({
      email: 'james@jamesknelson.com'
    })
    expect(latest.error).toBeFalsy()
    expect(latest.value).toEqual({
      name: 'James',
      email: 'james@jamesknelson.com'
    })
  })
})

describe("FormController", () => {
  const FormController = createFormControllerClass()
  const DataSource = createDataSourceClass()

  it('initializes with empty observable', () => {
    let empty = {}
    let data = Observable.from([null])
    let governor = createGovernor(
      createElement(FormController, { data })
    )
    let output = governor.getValue()
    expect(output.data).toBe(null)
    expect(output.model.error.email).toBeTruthy()
  })

  it('emits a new model when initial data is received', () => {
    let dataSource = createGovernor(createElement(DataSource, {})).getValue()
    let governor = createGovernor(
      createElement(FormController, { data: dataSource.observable })
    )
    let latest
    governor.subscribe(value => {
      latest = value
    })
    let received = {
      name: 'James',
      email: 'james@jamesknelson.com'
    }
    dataSource.receive(received)
    expect(latest.data).toEqual(received)
    expect(latest.model.error).toBeFalsy()
  })
})