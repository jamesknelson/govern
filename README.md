Govern
======

[![Version](http://img.shields.io/npm/v/govern.svg)](https://www.npmjs.org/package/govern)

**Govern is a React-like component system, but for state.**

Use govern to create re-usable controllers for your forms, data store, authentication, etc. Use govern's four built-in components to combine them.

If you've used React, you already know the API. Just replace `render` with `publish`!

See a [live demo](https://codesandbox.io/s/vmvzk774n0) at Code Sandbox.

```
import * as Govern from "govern";
import { Connect } from "react-govern";


class Model extends Govern.Component {
  constructor(props) {
    super(props)
    this.state = {
      value: props.defaultValue || '',
    }

    this.change = this.change.bind(this)
  }

  change(value) {
    this.setState({ value })
  }

  publish() {
    return {
      change: this.change,
      value: this.state.value,
      error: this.props.validate && this.props.validate(this.state.value),
    }
  }
}


const SignUpForm = (props) =>
  <Connect to={
    <combine children={{
      name:
        <Model
          validate={value => !value && 'who are you?'}
        />,
      email:
        <Model
          validate={value => value.indexOf('@') === -1 && 'not an email'}
        />,
    }} />
  }>
    {model =>
      <div>
        <Field label='Name' model={model.name} />
        <Field label='E-mail' model={model.email} />
      </div>
    }
  </Connect>


const Field = (props) =>
  <div>
    <label>
      {props.label}
      <input
        value={props.model.value}
        onChange={e => props.model.change(e.target.value)}
      />
      {props.model.error &&
        <span style={{ color: 'red' }}>{props.model.error}</span>
      }
    </label>
  </div>
```


Another state management tool?
------------------------------

The React ecosystem already has Redux and `setState`. So why do we need Govern too?

**Govern doesn't replace Redux or `setState`, but embraces and complements them.**

Where Redux is great at managing *global* state like fetched data, Govern is great at managing [*control* state](http://jamesknelson.com/5-types-react-application-state/) -- for example, selected items, pagination, or search queries.

And where React's `setState` method is great for simple cases like animations, it still ties state to the DOM. With Govern's observable components, you can use the same `setState` API to store state wherever you'd like.

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

- They don't output React elements. Instead of an `render()` method, they have a `publish()` method that returns a plain JavaScript object.
- Handler methods with side effects should be wrapped with `this.transaction(() => { ... })`.

For example, here is a Govern component that could be used to manage a single input's state:

```js
import Govern from 'govern'

class Model extends Govern.Component {
  constructor(props) {
    super(props)

    // Set the initial value of the form field
    this.state = {
      value: props.defaultValue || '',
    }
  }

  change = (newValue) => {
    this.setState({
      value: newValue,
    })
  }

  publish() {
    // Govern components output plain old JavaScript objects and arrays.
    return {
      change: this.change,
      value: this.state.value,
      error: !this.props.validate || this.props.validate(this.state.value)
    }
  }
}
```

Govern also supports stateless function components. For example, this component builds on the above Model component to add e-mail specific validation:

```js
const EmailModel = (props) =>
  Govern.createElement(Model, {
    defaultValue: props.defaultValue,
    validate: (value) =>
      (!value || value.indexOf('@') === -1)
        ? ['Please enter an e-mail address']
        : (props.validate && props.validate())
  })
```


Using Govern components
-----------------------

### connect(mapOwnPropsToGovernElement, mapOutputToProps)

Once you have a Govern component, you can instantiate it and attach its output to a React component with the `connect` decorator function. It's signature is:

```
govern(
  GovernElement | (ownProps: Props) => GovernElement,
  (elementOutput: any, ownProps: Props) => Props
):
  (component: ReactComponent) => ReactComponent
```

If you've used Redux before, `connect` will be familiar, but takes slightly different arguments. It's first function is used to specify what data you need, and its second (optional) function let's you specify how to inject that data into an attached component.

For example:

```jsx
import * as React from 'react'
import * as Govern from 'govern'
import { govern } from 'react-govern'

const EmailForm = (props) =>
  <label>
    E-mail:
    <input
      value={props.value}
      onChange={e => props.change(e.target.value)}
    />
  </label>

// Create a new component which uses the output of EmailModel as the props
// for EmailForm.
const ControlledEmailForm =
  connect(props => Govern.createElement(EmailModel, props))(EmailForm)

ReactDOM.render(
  // The props for `ControlledEmailForm` will be passed to
  // `getEmailFormController`, and used to create the Model element.
  <ControlledEmailForm defaultValue='hello@example.com' />,
  document.getElementById('app')
)
```

You can also use `govern` with the ESNext decorator syntax:

```jsx
@connect(props => Govern.createElement(EmailModel, props))
class EmailForm extends React.Component {
  render() {
    <label>
      E-mail:
      <input
        value={this.props.value}
        onChange={e => this.props.change(e.targe.value)}
      />
    </label>
  }
}
```

Creating a Govern element that receives all input props is a common scenario,
so there is a shortcut, where you can just pass in a component:

```jsx
@connect(EmailModel)
class EmailForm extends React.Component {
  render() {
    <label>
      E-mail:
      <input
        value={this.props.value}
        onChange={e => this.props.change(e.targe.value)}
      />
    </label>
  }
}
```

While `connect` is the simplest way of using a Govern component, there can be times when it doesn't give you enough control. Luckily, you have other options.

### `createGovernor(element: GovernElement)`

This function instantiates the argument element, and returns a `Governor` object, which allows you to subscribe to the output, or make changes to the props.

The equivalent in the React world is `ReactDOM.render`; the main difference being that in the React world, the component output is written directly to the DOM, while with Govern, you'll need to consume the output yourself.

```
createGovernor: (element: GovernElement) => Governor
```

For example, if you wanted to create an instance of the above EmailModel component, you would do the following:

```js
import { createElement, createGovernor } from 'govern'

let emailModel = createGovernor(
  createElement(EmailModel, { defaultValue: 'test@example.com' })
)
```

You can an observable's latest published value by calling `getValue()`:

```js
emailModel.getValue() // test@example.com
```

The returned Governor objects also follow the proposed [ESNext Observables](https://github.com/tc39/proposal-observable) format, so subscribing to them is simple:

```js
emailModel.subscribe(value => {
  console.log('component published:', value)
})
```

You can also set the governor component's props using its `setProps()` method, but try to leave this to the `connect` decorator or `<Connect to />` component when possible.

### `<Subscribe to={observable} children={(output) => ReactNode} />`

Once you have a Governor object, you can use the `<Subscribe>` component to access its output in a React component. Internally, this uses the governor's `subscribe` method to request notification of any changes to its output. It then feeds each new output to the render function passed via the `children` prop.

For example, you could re-implement the above form example using `createGovernor` and `<Subscribe>`, but with the form's state stored *outside* the form component:

```jsx
import { Connect } from 'react-govern'

const EmailForm = ({ governor }) =>
  <Connect to={governor} children={model =>
    <label>
      E-mail:
      <input
        value={model.value}
        onChange={e => model.change(e.target.value)}
      />
    </label>
  } />

const governor = createGovernor(
  createElement(Model, {
    defaultValue: 'test@example.com'
  })
)

ReactDOM.render(
  <EmailForm governor={governor} />,
  document.getElementById('app')
)
```


Composing components
--------------------

The best part about having state in components, is that you can *compose* those components to make bigger components.


### Objects

When you have multiple independent components that share the same inputs, you can use an object to indicate that you'd like a new component that nests the output of each child component.

For example, you could create a LoginFormModel component that contains the state for an entire login form.

```jsx
const LoginFormModel = ({ defaultValue }) =>
  Govern.createElement('combine', {
    email: createElement(EmailModel, {
      defaultValue: props.defaultValue.email
    }),
    password: createElement(Model, {
      defaultValue: '',
      validate: (value) => !value && ["Please enter your password"]
    }),
  })
}

// Govern respects `defaultProps`, just like React.
LoginFormModel.defaultProps = {
  defaultValue: {},
}

let governor = createGovernor(createElement(LoginFormModel, null))
let output = governor.get()

// you can set the value of "email" without affecting the value of "password"
output.email.change('james@reactarmory.com')

// returns 'james@reactarmory.com'
governor.get().email.value

// returns an empty string
governor.get().password.value
```


### <map from={GovernElement} to={mapOutputToElementLike} />

The built-in `map` element allows you to use the output of one component to compute the props of another element.

For example, you can use this to select part of the output:

```js
createElement('map', {
  from: createElement(Model, { defaultValue: 1 }),
  to: (output) => output.value
})
```

### <sink observable={Observable}>

The built-in `sink` element accepts a `Governor` or `Observable`, and outputs each of value that the observable emits.

Use `sink` to pass through the output of another governor. 

For example, if you have a global `auth` governor, you may want to feed part of its output through to an `AuthStatus` React component within your application:

```js
const AuthStatusController = () => ({
  auth: createElement('sink', { observable: authGovernor })
})

let ConnectedAuthStatus = connect(AuthStatusController)(AuthStatus)
```


### <source children={GovernElement} />

The built-in `source` element outputs an `Observable` with the output of its children elements. You can use this along with `sink` to create a "portal" from one component to another.

```js
// This component will have the same output as its children.
const Identity = ({ children }) =>
  createElement('sink', {
    observable: createElement('source', { children })
  })
}
```


Component Lifecycle
-------------------

As Govern components are not mounted/unmounted from the DOM, their lifecycle is a little different from the React component lifecycle.

### `constructor(props)`

The constructor is called when a Controller isntance is instantiated.

Perform any initialization here, including:

- setting an initial value of `this.state`
- addings event handlers to stores, etc.

*Note that Govern components do **not** receive `context`, so you'll need to pass any required data in via props.*

### `componentWasInstantiated()`

Similar to `componentDidMount`, this component will be called once the initial output is available.

### `componentWillReceiveProps(nextProps)`

This is identical to the React lifecycle method.

### `componentDidUpdate(nextProps, nextState, nextChild)`

Similar to React's `componentDidUpdate`.

### `componentWillBeDisposed()`

Called when a component will be be destroyed. Use this in the same way that you'd use React's `componentWillUnmount()` lifecycle method.


Component Instance API
----------------------

### `this.child`

A property that contains the last output of the component connected via `connectChild`.

This is similar in purpose to React's `refs` property. You can use it to interact with child components when required, but it is generally cleaner to avoid this if possible.

### `this.setState(changes)`

Usage is identical to React's `setState`.

### `this.transaction(Function)`

Used to ensure that multiple changes to a component's state (or props) will only result in one change being emitted to subscribers.


Governor API
------------

Governor objects implement the ESNext [Observable proposal](https://github.com/tc39/proposal-observable). This means they work great with RxJS.

```typescript
interface Governor<Props, Output> {
  // Return the result of `output()`
  get(): Output,

  // Set the current input props
  setProps(newProps: P): void,

  // Clean up the component instance
  dispose(): void,

  // Subscribes to the sequence with an observer
  subscribe(observer: Observer<T>): Subscription;

  // Subscribes to the sequence with callbacks
  subscribe(onNext: (value: T) => void,
            onError?: (error: any) => void,
            onComplete?: () => void,
            onTransactionStart?: () => void,
            onTransactionEnd?: () => void): Subscription;
}

export interface Subscription {
    // Cancels the subscription
    unsubscribe(): void;

    // A boolean value indicating whether the subscription is closed
    readonly closed: Boolean;
}

export interface Observer<T> {
    // Receives the subscription object when `subscribe` is called
    start?(subscription: Subscription): void;

    // Receives the next value in the sequence
    next(value: T): void;

    // While not useful at the level of a single observable, these allow
    // observers to arbitrarily split observables, and then recombine
    // them, and still only emit a single batch (while there will now
    // be multiple transactions.)
    //
    // For example:
    // - Observable emits { users: ['Alice', 'Bob', 'Carol'] }
    // - This is split into two separate observables, { firstUser: 'Alice' }
    //   and { 'lastUser': 'Carol' }
    // - These are recombined into 'Alice to Carol'
    // - As two separate change events are emitted on the two intermediate
    //   observables, two changes will be emitted on the final observable.
    //   However, the change events will be wrapped in batch events, allowing
    //   us to only perform the computation once, and only emit a single
    //   change.
    transactionStart?(): void;
    transactionEnd?(): void;

    // Receives the sequence error
    error?(errorValue: any): void;

    // Receives a completion notification
    complete?(): void;
}
```
