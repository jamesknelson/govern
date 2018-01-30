import * as Observable from 'zen-observable'
import { map, source, sink, shape, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'

function createModelClass() {
  class ModelPrimitive extends StrictComponent<{ defaultValue, validate }, any, { value }> {
    static defaultProps = {
      validate: () => {},
    }

    constructor(props: { defaultValue, validate }) {
      super(props)
      this.change = this.bindAction(this.change)
      this.state = {
        value: props.defaultValue
      }
    }

    change(value) {
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

  return class Model extends StrictComponent<{ defaultValue }> {
    static defaultProps = {
      defaultValue: {},
    }

    constructor(props) {
      super(props)
      this.change = this.bindAction(this.change)
    }

    change(value) {
      let output = this.getTypedOutput(this)

      if (value.name) {
        output.children.name.change(value.name)
      }
      if (value.email) {
        output.children.email.change(value.email)
      }
    }

    render() {
      return map({
        name: createElement(ModelPrimitive, {
          defaultValue: this.props.defaultValue.name,
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
      }, children => {
        let error = {} as any
        if (children.name.error) error.name = children.name.error
        if (children.email.error) error.email = children.email.error
        if (!Object.keys(error).length) error = undefined

        return {
          children: children,
          value: {
            name: children.name.value,
            email: children.email.value,
          },
          error: error,
          change: this.change,
        }
      })
    }
  }
}

function createDataSourceClass() {
  return class DataSource extends StrictComponent<{}, { store }> {
    constructor(props) {
      super(props)
      this.state = { store: null }
      this.receive = this.bindAction(this.receive)
    }

    receive(store) {
      this.setState({ store })
    }

    render() {
      return shape({
        receive: this.receive,
        observable: source(shape(this.state.store))
      })
    }
  }
}

function createFormControllerClass() {
  const Model = createModelClass()

  return class FormController extends StrictComponent<{ data }> {
    awaitingData: boolean = true

    render() {
      return shape({
        data: sink(this.props.data),
        model: createElement(Model, null)
      })
    }

    componentDidInstantiate() {
      this.receiveDataIfAvailable(this.output)
    }

    componentDidUpdate(nextProps, nextState, nextOutput) {
      this.receiveDataIfAvailable(nextOutput)
    }

    receiveDataIfAvailable(output) {
      if (this.awaitingData && output && output.data && Object.keys(output.data).length > 0) {
        this.awaitingData = false
        this.output.model.change(output.data)
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
    let output = governor.get()
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
    governor.get().change({
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
    let output = governor.get()
    expect(output.data).toBe(null)
    expect(output.model.error.email).toBeTruthy()
  })

  it('emits a new model when initial data is received', () => {
    let dataSource = createGovernor(createElement(DataSource, {})).get()
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