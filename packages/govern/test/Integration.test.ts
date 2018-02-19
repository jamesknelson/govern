import { flatMap, combine, createElement, instantiate, Component, Outlet, SFC } from '../src'
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

    get subs() {
      return this.getTypedSubs(this)
    }

    subscribe() {
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
      if (this.subs.name.error) error.name = this.subs.name.error
      if (this.subs.email.error) error.email = this.subs.email.error
      if (!Object.keys(error).length) error = undefined

      return {
        children: this.subs,
        value: {
          name: this.subs.name.value,
          email: this.subs.email.value,
        },
        error: error,
        change: this.change,
      }
    }

    change = (value) => {
      if (value.name) {
        this.subs.name.change(value.name)
      }
      if (value.email) {
        this.subs.email.change(value.email)
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

    get subs() {
      return this.getTypedSubs(this)
    }

    receive = (store) => {
      this.setState({ store })
    }

    subscribe() {
      return this.state.store && combine(this.state.store)
    }

    publish() {
      return {
        receive: this.receive,
        data: this.subs
      }
    }
  }
}

const DataSourceData = (props: { dataSource: Outlet<{receive, data}> }) =>
  flatMap(props.dataSource, state => state.data)

function createFormControllerClass() {
  const Model = createModelClass()

  return class FormController extends Component<{ data }> {
    awaitingData: boolean = true

    get subs() {
      return this.getTypedSubs(this)
    }

    subscribe() {
      return combine({
        data: this.props.data,
        model: createElement(Model, null)
      })
    }

    publish() {
      return this.subs
    }

    componentDidInstantiate() {
      this.receiveDataIfAvailable(this.subs.data)
    }

    componentDidUpdate(prevProps, prevState, prevSubs) {
      this.receiveDataIfAvailable(this.subs.data)
    }

    receiveDataIfAvailable(output) {
      if (this.awaitingData && output && Object.keys(output).length > 0) {
        this.awaitingData = false
        this.subs.model.change(output)
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