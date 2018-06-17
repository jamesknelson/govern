import { map, flatMap, combine, createElement, instantiate, Component, Store, SFC, constant } from '../src'
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

    subscribe() {
      return constant({
        change: this.change,
        value: this.state.value,
        error: this.props.validate(this.state.value)
      })
    }

    publish() {
      return this.subs
    }
  }

  return class Model extends Component<{ defaultValue }> {
    static defaultProps = {
      defaultValue: {},
    }

    subscribe() {
      return map(
        combine({
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
        }),
        ({ name, email }) => {
          let error = {} as any
          if (name.error) error.name = name.error
          if (email.error) error.email = email.error
          if (!Object.keys(error).length) error = undefined

          return {
            children: { name, email },
            value: {
              name: name.value,
              email: email.value,
            },
            error: error,
            change: this.change,
          }
        }
      )
    }

    publish() {
      return this.subs
    }

    change = (value) => {
      if (value.name) {
        this.subs.children.name.change(value.name)
      }
      if (value.email) {
        this.subs.children.email.change(value.email)
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

    receive = (store) => {
      this.setState({ store })
    }

    subscribe() {
      return map(
        this.state.store && combine(this.state.store),
        data => ({
          receive: this.receive,
          data,
        })
      )
    }

    publish() {
      return this.subs
    }
  }
}

const DataSourceData = (props: { dataSource: Store<{receive, data}> }) =>
  flatMap(props.dataSource, state => state.data)

function createFormControllerClass() {
  const Model = createModelClass()

  return class FormController extends Component<{ data }> {
    awaitingData: boolean = true

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
    let store = instantiate(
      createElement(Model, {
        defaultValue: {
          name: 'James',
          email: 'james'
        }
      })
    )
    let output = store.getValue()
    expect(output.value).toEqual({
      name: 'James',
      email: 'james',
    })
    expect(output.error.email).toBeTruthy()

    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })

  it('notifies changes', () => {
    let store = instantiate(
      createElement(Model, {
        defaultValue: {
          name: 'James',
          email: 'james'
        }
      })
    )
    let harness = createTestHarness(store)
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

    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })
})

describe("FormController", () => {
  const FormController = createFormControllerClass()
  const DataSource = createDataSourceClass()

  it('initializes with empty observable', () => {
    let empty = {}
    class Constant extends Component {
      subscribe() {
        return null
      }

      publish() {
        return this.subs
      }
    }
    let data = instantiate(createElement(Constant))
    let store = instantiate(
      createElement(FormController, { data })
    )
    let harness = createTestHarness(store)
    expect(harness.value.data).toBe(null)
    expect(harness.value.model.error.email).toBeTruthy()
  })

  it('emits a new model when initial data is received', () => {
    let dataSource = instantiate(createElement(DataSource, {}))
    let dataSourceData = instantiate(createElement(DataSourceData, { dataSource }))
    let store = instantiate(
      createElement(FormController, { data: dataSourceData })
    )
    let harness = createTestHarness(store)
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