Govern
======

[![Version](http://img.shields.io/npm/v/govern.svg)](https://www.npmjs.org/package/govern)


**A component-based state management tool for React.**

[Try it out](https://reactarmory.com/examples/govern/govern-form) in React Armory's live editor!

Govern is based around the concept of *renderless components*, i.e. components without a `render` function.

Renderless components are great for managing application state. For example, you can use them to implement re-usable form controllers, authentication logic, or even a JSON API interface. And best of all, they can be composed and re-used.


Another state management tool?
------------------------------

The React ecosystem already has Redux and `setState`. So why do we need Govern too?

**Govern doesn't replace Redux or `setState`, but embraces and complements them.**

Where Redux is great at managing *global* state like fetched data, Govern is great at managing [*control* state](http://jamesknelson.com/5-types-react-application-state/) -- for example, selected items, pagination, or search queries.

And where React's `setState` method is great for simple cases like animations, it still ties state to the DOM. With Govern's renderless components, you can use the same `setState` API to store state wherever you'd like.

#### When should I use Govern?

- Storing form state without losing it between route changes
- Re-usable components that don't render anything
- Business logic that doesn't belong in a global store

#### When should I use Redux?

- Storing data received from the server
- Business logic that is completely independent of the DOM tree
- When time-travelling is a requirement

#### When should I use React component state?

- Animated components
- Managing interactions with the DOM
- Pop-out menus, tooltips, etc.


Getting started
---------------

Govern is split into two packages:

- The `govern` package can be used with any view library
- The `react-govern` package helps you connect Govern components with React components

```bash
npm install --save govern react-govern
```


A simple Govern component
-------------------------

If you've used React, Govern's renderless components will feel familiar. They have lifecycle methods, a constructor that receives `props`, and can call `this.setState()`.

Govern components have two main differences from React components:

- They don't output React elements. Instead of an `render()` method, they have an `output()` method that returns a plain JavaScript object.
- Handler methods must be bound using the `this.bindActions()` method instead of JavaScript's `Function.prototype.bind()`.

For example, here is a Govern component that could be used to manage a single input's state:

```js
import Govern from 'govern'

class Model extends Govern.StatefulComponent {
  constructor(props) {
    super(props)

    // Set the initial value of the form field
    this.state = {
      value: props.defaultValue || '',
    }

    // This binds the class's `change` method as a handler function
    this.actions = this.bindActions(
      'change'
    )
  }

  change(newValue) {
    this.setState({
      value: newValue,
    })
  }

  output() {
    return {
      change: this.actions.change,
      value: this.state.value,
    }
  }
}
```


Using Govern components
-----------------------

### controlledBy(governComponent)

Once you have a Govern component, you can attach an instance to a React component with the `controlledBy` decorator function. Its signature is:

```
controlledBy: (component: GovernComponent) => (component: ReactComponent) => ReactComponent
```

If you've used Redux before, `controlledBy` will be familiar; it is a lot like `connect`. It accepts a Govern Component as an argument, and returns another function that can be used to create stateful React components.

The return React component's props will be passed to your Govern component, and the Govern component's output will be passed to the wrapped React component.

For example:

```jsx
import { controlledBy } from 'react-govern'

const EmailForm = (model) =>
  <label>
    E-mail:
    <input
      value={model.value}
      onChange={e => model.change(e.targe.value)}
    />
  </label>

// Create a stateful React component from a stateful Govern component
// and a stateless React component.
const ControlledEmailForm = controlledBy(Model)(EmailForm)

ReactDOM.render(
  // The props for `ControlledEmailForm` will be passed to the Model
  // Govern component.
  //
  // The output of Model wil then be used as the props of <EmailForm>.
  <ControlledEmailForm defaultValue='hello@example.com' />,
  document.getElementById('app')
)
```

You can also use `controlledBy` with the ESNext decorator syntax:

```jsx
@controlledBy(Model)
class EmailForm extends React.Component {
  render() {
    <label>
      E-mail:
      <input
        value={this.props.value}
        onChange={e => this.props.change(e.target.value)}
      />
    </label>
  }
}
```

While `controlledBy` is the simplest way of using a Govern component, there can be times when it doesn't give you enough... control (*ba-dum-tsh*). And that's why Govern gives you options.

### `createController(component, initialProps)`

Unlike React components, Govern components can be instantiated manually. You won't often need to do this, but the option is there.

To instantiate a Govern component, you use the `createController` method. This returns a **Controller** object; i.e. an object that wraps your component instance, and can be used to interact with your component instance.

```
createController: (component: GovernComponent, initialProps: object) => Controller
```

For example, if you wanted to create an instance of the above Model component, you would do the following:

```js
import { createController } from 'govern'

let modelController = createController(Model, { defaultValue: 'test@example.com' })
```

You can then interact with the component through the returned controller's `get()`, `set(...)`, `subscribe(...)` and `destroy()` methods:

```js
// `test@example.com`
modelController.get().value

// `no`
modelController.set({ value: 'no' })
modelController.get().value
```

### `<Subscribe to={controller} render={(output) => ReactNode} />`

Once you have a Controller object, you can use `<Subscribe>` to access its output in a React component. This React component will use the controller's `subscribe` method to request notification of any changes to its output. It then feeds each new output to the `render` function.

For example, you could re-implement the above form using `createController` and `<Subscribe>`, but with the form's state stored *outside* the form component:

```jsx
import { Subscribe } from 'react-govern'

const EmailForm = ({ controller }) =>
  <Subscribe to={controller} render={model =>
    <label>
      E-mail:
      <input
        value={model.value}
        onChange={e => model.change(e.targe.value)}
      />
    </label>
  } />

const controller = createController(Model, {
  initialProps: 'test@example.com'
})

ReactDOM.render(
  <EmailForm controller={controller} />,
  document.getElementById('app')
)
```


Composing components
--------------------

The best part about having state in components, is that you can *compose* those components to make bigger components.

As Govern components aren't tied to the DOM, Govern's approach to composition is a little different than React. Instead of nesting components with JSX and elements, Govern allows you to create **parallel** and **sequential** components.


### Parallel composition

When you have multiple independent components that share the same inputs, you can use an object to indicate that you'd like a new component that nests the output of each child component.

For example, you could create a LoginFormModel by composing a number of the Model components from the previous examples:

```jsx
const LoginFormModel = {
  email: Model,
  password: Model
}

let controller = createController(LoginFormModel, { defaultValue: '' })
let output = controller.get()

// you can set the value of "email" without affecting the value of "password"
output.email.change('james@reactarmory.com')

// returns 'james@reactarmory.com'
controller.get().email.value

// returns an empty string
controller.get().password.value
```

*Note: if you're using TypeScript, you can wrap the object in `Govern.parallel()` to get proper typings.*


### Sequence composition

Sometimes, you'll want to use the output of one component as the input for another component.

For example, you may want to use the output of the above model component as the input for a "LoginEndpoint" component:

```jsx
class LoginEndpoint extends Govern.StatefulComponent {
  constructor(props) {
    super(props)

    this.state = {
      status: 'ready',
      error: null,
    }
    this.actions = this.bindActions(
      'start',
      'handleSuccess',
      'handleFailure',
    )
  }

  start() {
    this.setState({
      status: 'busy',
    })

    postToAPI(URL, {
      email: this.props.email.value,
      password: this.props.password.value,
    }).then(
      this.actions.handleSuccess,
      this.actions.handleFailure,
    )
  }

  handleSuccess() {
    this.setState({
      status: 'complete',
    })
  }

  handleFailure(error) {
    this.setState({
      status: 'error',
      error: error,
    })
  }

  output() {
    return {
      start: this.actions.start,
      ...this.state,
      ...this.props,
    }
  }
}

// An array indicates that props will flow from the output of one component
// to the input of the next component.
const Login = [
  LoginFormModel,
  LoginEndpoint,
]

let controller = createController(Login, { defaultValue: '' })
let output = controller.get()

output.email.set('james@reactarmory.com')
output.password.set('kangaroo')
output.start()

// returns 'busy'
output.get().status
```

*Note: if you're using TypeScript, you can wrap the array in `Govern.sequence()` to get proper typings.*


### Stateless function components

In practice, you'll sometimes find that the output of one component is not exactly what you need. Luckily, Govern also supports React-style stateless function components; they just return props instead of elements.

For example, you could use a stateless function component along with parallel/sequence components to create a `merge` higher-order component to merge the output of a controller with its input props:

```jsx
function defaultMergeFn(props, output) {
  return Object.assign({}, props, output)
}

function merge(governComponent, mergeFn=defaultMergeFn) {
  return [
    {
      props: props => props,
      output: governComponent,
    },
    ({ props, output }) => mergeFn(props, output)
  ]
}
```

This higher-order govern component (or HoG) is so useful that it actually comes with Govern. You can access it at `Govern.merge()`.


Component Lifecycle
-------------------

As Govern components are not mounted/unmounted from the DOM, their lifecycle is a little different from the React component lifecycle.

### `constructor(props)`

The constructor is called when a Controller isntance is instantiated.

Perform any initialization here, including:

- creating actions with `bindActions`
- setting an initial value of `this.state`
- addings event handlers to stores, etc.

*Note that Govern components do **not** receive `context`, so you'll need to pass any required data in via props.*

### `componentWillReceiveProps(nextProps)`

This is identical to the React lifecycle method.

### `componentWillBeDestroyed()`

Called when a component will be be destroyed. Use this in the same way that you'd use React's `componentWillUnmount()` lifecycle method.


Component Instance API
----------------------

### `this.bindActions(...methodNames)`

This function accepts a list of methods names from your class, and returns an object containing *action* functions; i.e. functions that are bound to the component instance, and whose changes are wrapped in a transaction. It should be used in the constructor; conventionally, you'll assign its output to `this.actions`.

Generally speaking, you'll want to create actions for any methods which call `setState`, or cause side-effects (such as changing the component's input props).

#### Usage

```
class Model extends Govern.StatefulComponent {
  constructor(props) {
    super(props)

    // This binds the class's `change` and `save` methods as handler functions
    this.actions = this.bindActions(
      'change',
      'save'
    )
  }

  change(newValue) {
    this.setState({
      value: newValue,
    })
  }

  save() {
    this.props.onSave(this.state)
  }
}
```

### `this.setState(changes)`

Usage is mostly identical to React's `setState`, but with two main differences:

- It is executed synchronously, so it doesn't accept an on-complete callback
- It doesn't yet accept a reducer function (pull requests are welcome!)


Controller API
--------------

Controller objects have the following API:

```typescript
interface Controller<Input, Output> {
  // Return the result of `output()`
  get(): Output,

  // Set the current input props
  set(newProps: I): void,

  // Clean up the component instance
  destroy(): void,

  // Allows you to subscribe to changes, or notification of the start/end of
  // a group of changes (i.e. the start/end of an action).
  //
  // You can pass `null` for callbacks which you don't need.
  subscribe(
    onChange?: (output: Output) => void,
    onTransactionStart?: () => void,
    onTransactionEnd?: (confirm: () => void) => void,
    onDestroy?: () => void,
  ): UnsubscribeCallback,
}
```
