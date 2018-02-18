import { map, subscribe, combine, createElement, instantiate, Component, Outlet, SFC } from '../src'
import { createTestHarness } from './utils/createTestHarness'

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

    publish() {
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

    get child() {
      return this.getTypedChild(this)
    }

    connectChild() {
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

    publish() {
      let error = {} as any
      if (this.child.name.error) error.name = this.child.name.error
      if (this.child.email.error) error.email = this.child.email.error
      if (!Object.keys(error).length) error = undefined

      return {
        children: this.child,
        value: {
          name: this.child.name.value,
          email: this.child.email.value,
        },
        error: error,
        change: this.change,
      }
    }

    change = (value) => {
      if (value.name) {
        this.child.name.change(value.name)
      }
      if (value.email) {
        this.child.email.change(value.email)
      }
    }
  }
}

function createDataSourceClass() {
  return class DataSource extends Component<{}, { store }> {
    constructor(props) {
      super(props)
      this.state = { store: null }
    }

    get child() {
      return this.getTypedChild(this)
    }

    receive = (store) => {
      this.setState({ store })
    }

    connectChild() {
      return this.state.store && combine(this.state.store)
    }

    publish() {
      return {
        receive: this.receive,
        data: this.child
      }
    }
  }
}

const DataSourceData = (props: { dataSource: Outlet<{receive, data}> }) =>
  map(subscribe(props.dataSource), state => state.data)

function createFormControllerClass() {
  const Model = createModelClass()

  return class FormController extends Component<{ data }> {
    awaitingData: boolean = true

    get child() {
      return this.getTypedChild(this)
    }

    connectChild() {
      return combine({
        data: subscribe(this.props.data),
        model: createElement(Model, null)
      })
    }

    publish() {
      return this.child
    }

    componentDidInstantiate() {
      this.receiveDataIfAvailable(this.child.data)
    }

    componentDidUpdate(prevProps, prevState, prevSubs) {
      this.receiveDataIfAvailable(this.child.data)
    }

    receiveDataIfAvailable(output) {
      if (this.awaitingData && output && Object.keys(output).length > 0) {
        this.awaitingData = false
        this.child.model.change(output)
      }
    }
  }
}

describe("Model", () => {
  const Model = createModelClass()

  it('returns expected initial value', () => {
    let outlet = instantiate(
      createElement(Model, {
        defaultValue: {
          name: 'James',
          email: 'james'
        }
      })
    )
    let output = outlet.getValue()
    expect(output.value).toEqual({
      name: 'James',
      email: 'james',
    })
    expect(output.error.email).toBeTruthy()
  })

  it('notifies changes', () => {
    let outlet = instantiate(
      createElement(Model, {
        defaultValue: {
          name: 'James',
          email: 'james'
        }
      })
    )
    let harness = createTestHarness(outlet)
    harness.dispatch(() => {
      harness.value.change({
        email: 'james@jamesknelson.com'
      })
    })
    expect(harness.value.error).toBeFalsy()
    expect(harness.value.value).toEqual({
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
    class Constant extends Component {
      publish() {
        return null
      }
    }
    let data = instantiate(createElement(Constant))
    let outlet = instantiate(
      createElement(FormController, { data })
    )
    let harness = createTestHarness(outlet)
    expect(harness.value.data).toBe(null)
    expect(harness.value.model.error.email).toBeTruthy()
  })

  it('emits a new model when initial data is received', () => {
    let dataSource = instantiate(createElement(DataSource, {}))
    let dataSourceData = instantiate(createElement(DataSourceData, { dataSource }))
    let outlet = instantiate(
      createElement(FormController, { data: dataSourceData })
    )
    let harness = createTestHarness(outlet)
    let received = {
      name: 'James',
      email: 'james@jamesknelson.com'
    }
    harness.dispatch(() => {
      dataSource.getValue().receive(received)
    })
    expect(harness.value.data).toEqual(received)
    expect(harness.value.model.error).toBeFalsy()
  })
})