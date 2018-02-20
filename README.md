Govern
======

Component-based state management.

[![npm version](https://img.shields.io/npm/v/govern.svg)](https://www.npmjs.com/package/govern)

---

Use govern to create data stores from re-usable components.

If you've used React, you already know the API. Just replace `render` with `subscribe` and `publish`!

Create components for your forms, data store, authentication, etc, and then combine them with govern's built-in components.

See a [live demo](https://codesandbox.io/s/w6j1xk8nvw) at Code Sandbox.


Example with React
------------------


```jsx
import * as Govern from "govern";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Subscribe } from "react-govern";

// Create components to hold state and actions.
class Model extends Govern.Component {
  static defaultProps = {
    defaultValue: ""
  };

  constructor(props) {
    super(props);
    this.state = {
      value: props.defaultValue
    };
  }

  publish() {
    return {
      value: this.state.value,
      error: this.props.validate && this.props.validate(this.state.value),
      onChange: this.onChange
    };
  }

  onChange = value => {
    this.setState({ value });
  };
}

// Govern supports Stateless Functional Components too
const SignUpFormModel = () => ({
  name: <Model validate={value => !value && "who are you?"} />,
  email: (
    <Model validate={value => value.indexOf("@") === -1 && "not an email"} />
  )
});

// Create stores by instantiating them.
let store = Govern.instantiate(<SignUpFormModel />);

// Use `store.map` to create elements that select parts of the store's state.
const SignUpForm = ({ store }) => (
  <div>
    <h2>Hello, Store Components!</h2>
    <Field
      label="Name"
      store={store.map(state => state.name)}
    />
    <Field label="E-mail" store={store.map(state => state.email)} />
  </div>
);

// Use `<Subscribe>` to access state within a React component
const Field = props => (
  <div>
    <label>
      <span>{props.label}</span>
      <Subscribe to={props.store}>
        {(model, dispatch) => (
          <React.Fragment>
            <input
              value={model.value}
              onChange={e =>
                // Use `dispatch` to indicate that the store may change
                dispatch(() => model.onChange(e.target.value))
              }
            />
            {model.error && <span style={{ color: "red" }}>{model.error}</span>}
          </React.Fragment>
        )}
      </Subscribe>
    </label>
  </div>
);

ReactDOM.render(<SignUpForm store={store} />, document.getElementById("root"));
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
  // Govern compoents can have default props, just like React components.
  static defaultProps = {
    defaultValue: ''
  }

  constructor(props) {
    super(props)

    // Set the initial value of the form field
    this.state = {
      value: props.defaultValue,
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
  <Model
    defaultValue={props.defaultValue}
    validate={(value) =>
      (!value || value.indexOf('@') === -1)
        ? ['Please enter an e-mail address']
        : (props.validate && props.validate())
    }
  />
```



A simple store component
-------------------------

If you've used React, Govern's renderless components will feel familiar. They have lifecycle methods, a constructor that receives `props`, and can call `this.setState()`.

store components have two main differences from React components:

- They don't output React elements. Instead of an `render()` method, they have a `publish()` method that returns a plain JavaScript object.
- Handler methods with side effects should be wrapped with `this.transaction(() => { ... })`.

For example, here is a store component that could be used to manage a single input's state:

```js
import Govern from 'govern'

class Model extends Govern.Component {
  // Govern compoents can have default props, just like React components.
  static defaultProps = {
    defaultValue: ''
  }

  constructor(props) {
    super(props)

    // Set the initial value of the form field
    this.state = {
      value: props.defaultValue,
    }
  }

  change = (newValue) => {
    this.setState({
      value: newValue,
    })
  }

  publish() {
    // store components output plain old JavaScript objects and arrays.
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


Using store components
-----------------------

### subscribe(mapOwnPropsToGovernElement, mapOutputToProps)

Once you have a store component, you can instantiate it and attach its output to a React component with the `subscribe` decorator function. Or, you can manually instantiate elements:

### `instantiate(element: GovernElement): Store`

This function instantiates the argument element, and returns a `Store` object, which allows you to subscribe to the output, or make changes to the props.

The equivalent in the React world is `ReactDOM.render`; the main difference being that in the React world, the component output is written directly to the DOM, while with Govern, you'll need to consume the output yourself.

```
instantiate: (element: GovernElement) => Store
```

For example, if you wanted to create an instance of the above EmailModel component, you would do the following:

```js
import { createElement, instantiate } from 'govern'

let emailModel = instantiate(
  createElement(EmailModel, { defaultValue: 'test@example.com' })
)
```

You can an observable's latest published value by calling `getValue()`:

```js
emailModel.getValue() // test@example.com
```

The returned Store objects also follow the proposed [ESNext Observables](https://github.com/tc39/proposal-observable) format, so subscribing to them is simple:

```js
// Note that store components receive a `dispatch` function in addition to
// the standard `value` object. Use `dispatch` when you want to make changes
// to the store's state.
emailModel.subscribe((value, dispatch) => {
  console.log('component published:', value)
})
```

### `<Subscribe to={store} children={(value, dispatch) => ReactNode} />`

Once you have a Store object, you can use the `<Subscribe>` component to access its output in a React component. Internally, this uses the store's `subscribe` method to request notification of any changes to its output. It then feeds each new output to the render function passed via the `children` prop.


Composing components
--------------------

The best part about having state in components, is that you can *compose* those components to make bigger components.


### Objects

When you have multiple independent components that share the same inputs, you can use an object to indicate that you'd like a new component that nests the output of each child component.

For example, you could create a LoginFormModel component that contains the state for an entire login form.

```jsx
const LoginFormModel = ({ defaultValue }) =>
  ({
    email:
      <EmailModel defaultValue={props.defaultValue.email} />,
    password:
      <Model
        defaultValue=''
        validate={(value) => !value && ["Please enter your password"]}
      />,
  })

LoginFormModel.defaultProps = {
  defaultValue: {},
}

let store = instantiate(createElement(LoginFormModel))
```


### <map from={GovernElement | Store} to={mapOutputToValue} />

The built-in `map` element allows you to extract values from within an element.

For example, you can use this to select part of the output:

```js
createElement('map', {
  from: createElement(Model, { defaultValue: 1 }),
  to: (output) => output.value
})
```


### <flatMap from={GovernElement | Store} to={mapOutputToElement} />

The built-in `flatMap` element allows you to use the output of one component to compute the props of another element.


Component Lifecycle
-------------------

As store components are not mounted/unmounted from the DOM, their lifecycle is a little different from the React component lifecycle.

### `constructor(props)`

The constructor is called when a Controller isntance is instantiated.

Perform any initialization here, including:

- setting an initial value of `this.state`
- addings event handlers to stores, etc.

*Note that store components do **not** receive `context`, so you'll need to pass any required data in via props.*

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

### `this.subs`

A property that contains the last output of the component connected via `subscribe`.

This is similar in purpose to React's `refs` property. You can use it to interact with child components when required, but it is generally cleaner to avoid this if possible.

### `this.setState(changes)`

Usage is identical to React's `setState`.

### `this.dispatch(Function)`

If you need to make calls to `setState` outside of lifecycle methods or
React components, you'll need to wrap these calls in a `dispatch` call.

For example, you'll need to use this when handling the response of a HTTP
Request.
