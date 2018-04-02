Govern
======

A state management library for people who enjoy React.

[![npm version](https://img.shields.io/npm/v/govern.svg)](https://www.npmjs.com/package/govern)

[Try it at CodeSandbox &raquo;](https://codesandbox.io/s/0ozlm2lxjl)

---

Managing state in React apps can be daunting. Govern makes it staightforward. It lets you get more done with the APIs you already know, and untangles your business logic in the same way that React untangled your view.

With Govern, you manage your state with *store components*. These are a lot like React components - they can receive props, call `setState`, and define lifecycle methods. They can be defined as ES6 classes, or as stateless functions. 

Store components can handle state, actions, side effects, and selectors. This means that Govern can replace redux (or MobX), redux-thunk, redux-saga, reselect, and even recompose. But you can still use these tools when it makes sense - Govern is flexible, just like React.

And if you know React, then you already know most of Govern's API, so you'll be productive in no time.

```bash
# Install with NPM
npm install --save govern react-govern

# Install with Yarn
yarn add govern react-govern
```

Simple, Sensible Forms: a short guide.
--------------------------------------

Creating forms with React is usually a little awkward. Govern makes it easy and fun. It lets you break your state into small components, and then reuse them -- as God and Douglas McIlroy intended.


### Defining store components

Govern components are just JavaScript classes that extend `Govern.Component`. Like React components, they have props, state, and lifecycle methods.

For example, here's how you'd create a `Model` component that handles state and validation for individual form fields:

```js
import * as Govern from 'govern'

class Model extends Govern.Component {
  static defaultProps = {
    defaultValue: ''
  }

  constructor(props) {
    super(props)

    this.state = {
      value: props.defaultValue,
    }
  }

  publish() {
    let value = this.state.value
    let error = this.props.validate ? this.props.validate(value) : null

    return {
      value: this.state.value,
      error: error,
      change: this.change,
    }
  }

  change = (newValue) => {
    this.setState({
      value: newValue,
    })
  }
}
```

Govern components have one major difference from React components: instead of `render`, they take a `publish` method. This is where you specify the component's output, which will be computed each time the component's props or state change.


### Subscribing to stores

Now that you have a Model component, the next step is to subscribe to its published values from inside of your React app.

Govern exports a `<Subscribe to>` React component to handle this for you. This component takes a Govern element for its `to` prop, and a render function for its `children` prop. It calls the render function with each new published value -- just like React's context API.

Here's a barebones example that connects a `<Model>` to an input field, using `<Subscribe>`. [See it live at CodeSandbox](https://codesandbox.io/s/0y10o4977l).

```js
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Subscribe } from 'react-govern'

ReactDOM.render(
  <Subscribe to={<Model validate={validateEmail} />}>
    {emailModel =>
      <label>
        Email: 
        <input
          value={emailModel.value}
          onChange={e => emailModel.change(e.target.value)}
        />
        {
          emailModel.error &&
          <p style={{color: 'red'}}>{emailModel.error}</p>
        }
      </label>
    }
  </Subscribe>,
  document.getElementById('root')
)

function validateEmail(value) {
  if (value.indexOf('@') === -1) {
    return "pleae enter a valid e-mail"
  }
}
```

Congratulations -- you've just learned a new way to manage state! And all you need to remember is that:

- Store components extend from `Govern.Component` in place of `React.Component`.
- Store components use a `publish` method in place of `render`.
- You can subscribe to store components with `<Subscribe to>`.

These three things will get you a long way. But there's one more tool that will make your life even easier:


### Combining stores

Govern components have one special method that doesn't exist on React components -- `subscribe`.

When a component's `subscribe` method returns some Govern elements, the component will subscribe to those elements, placing their latest published values on `this.subs`. You can then use the value of `this.subs` within the component's `publish` method, allowing you to *combine* store components.

For example, you could combine two `<Model>` elements to create a `<RegistrationFormModel>` component:

```js
class RegistrationFormModel extends Govern.Component {
  static defaultProps = {
    defaultValue: { name: '', email: '' }
  }

  subscribe() {
    let defaultValue = this.props.defaultValue

    return {
      name: <Model defaultValue={defaultValue.name} validate={validateNotEmpty} />,
      email: <Model defaultValue={defaultValue.email} validate={validateEmail} />,
    }
  }

  publish() {
    return this.subs
  }
}

function validateNotEmpty(value) {
  if (!value) {
    return "please enter your name"
  }
}
```

You can then subscribe to the form model with `<Subscribe to>`, just as before.

One of the benefits of using the same `<Model>` component for every field is that it makes creating reusable form controls simpler. For example, you could create a `<Field>` React component to render your field models. [See it live at CodeSandbox](https://codesandbox.io/s/vv09or2853).

```js
class Field extends React.Component {
  render() {
    return (
      <label style={{display: 'block'}}>
        <span>{this.props.label}</span>
        <input
          value={this.props.model.value}
          onChange={this.handleChange}
        />
        {
          this.props.model.error &&
          <p style={{color: 'red'}}>{this.props.model.error}</p>
        }
      </label>
    )
  }

  handleChange = (e) => {
    this.props.model.change(e.target.value)
  }
}

ReactDOM.render(
  <Subscribe to={<RegistrationFormModel />}>
    {model =>
      <div>
        <Field label='Name' model={model.name} />
        <Field label='E-mail' model={model.email} />
      </div>
    }
  </Subscribe>,
  document.getElementById('root')
)
```


### Stateless functional components

You'll sometimes find yourself creating components that just `subscribe` to a few elements, and then re-publish the outputs without any changes. Govern provides a shortcut for defining this type of component: just return the elements you want to subscribe to from a plain function -- like React's stateless functional components.

For example, you could convert the above `<RegistrationFormModel>` component to a stateless functional component. [See it live at CodeSandbox](https://codesandbox.io/s/pyr7y18xq).

```js
const RegistrationFormModel = ({ defaultValue }) => ({
  name: <Model defaultValue={defaultValue.name} validate={validateNotEmpty} />,
  email: <Model defaultValue={defaultValue.email} validate={validateEmail} />
});

RegistrationFormModel.defaultProps = {
  defaultValue: { name: '', email: '' } 
}
```


### Submitting forms

Once you have some data in your form, submitting it is easy -- you just publish a `submit` handler along with the form data. Everything you know about handling HTTP requests in React components transfers over to Govern components.

But Govern gives you an advantage over plain old React -- your requests can be components too!

For example, this component takes the request body as props, makes a request in the `componentDidInstantiate` lifecyle method, and emits the request status via the `publish` method.

```js
import * as axios from "axios";

class PostRegistrationRequest extends Govern.Component {
  state = {
    status: 'fetching',
  }

  publish() {
    return this.state
  }

  componentDidInstantiate() {
    axios.post('/user', this.props.data)
      .then(response => {
        if (!this.isDisposed) {
          this.setState({
            status: 'success',
            result: response.data,
          })
        }
      })
      .catch((error = {}) => {
        if (!this.isDisposed) {
          this.setState({
            status: 'error',
            message: error.message || "Unknown Error",
          })
        }
      });
  }

  componentWillBeDisposed() {
    this.isDisposed = true
  }
}
```

You can then make a request by subscribing to a new `<PostRegistrationRequest>` element. [See it live at CodeSandbox](https://codesandbox.io/s/8zxv9kq9vl).

```js
class RegistrationFormController extends Govern.Component {
  state = {
    request: null
  };

  subscribe() {
    return {
      model: <RegistrationFormModel />,
      request: this.state.request
    };
  }

  publish() {
    return {
      ...this.subs,
      canSubmit: this.canSubmit(),
      submit: this.submit
    };
  }

  canSubmit() {
    return (
      !this.subs.model.email.error &&
      !this.subs.model.name.error &&
      (!this.subs.request || this.subs.request.status === "error")
    );
  }

  submit = e => {
    e.preventDefault();

    if (this.canSubmit()) {
      let data = {
        email: this.subs.model.email.value,
        name: this.subs.model.name.value
      };

      this.setState({
        request: (
          <PostRegistrationRequest data={data} key={new Date().getTime()} />
        )
      });
    }
  };
}

ReactDOM.render(
  <Subscribe to={<RegistrationFormController />}>
    {({ canSubmit, model, request, submit }) => (
      <form onSubmit={submit}>
        {request &&
          request.status === "error" && (
            <p style={{ color: "red" }}>{request.message}</p>
          )}
        <Field label="Name" model={model.name} />
        <Field label="E-mail" model={model.email} />
        <button type="submit" disabled={!canSubmit}>
          Register
        </button>
      </form>
    )}
  </Subscribe>,
  document.getElementById("root")
);
```

Note how the `key` prop is used in the above example; just like React, changing `key` will result in a new component instance being created, and thus a new request being made each time the user clicks "save".

While request components can take a little getting used to, they have the benefit of being able to publish multiple statuses over time -- where promises can only publish one. For example, you could publish *disconnected* or *unauthenticated* states, along with a `retry` action that attempts to fix them.

Request components also make it easy to share communication logic within and between applications. For an example, see [this gist](https://gist.github.com/jamesknelson/ab93890eb26f2841a2f8846d4013b151) of an axios-based `<Request>` component.


### Performance note: selecting data

Govern's `<Subscribe>` component needs to call its render prop each time that *any* part of its output changse. This is great for small components, but as the output gets larger and more complicated, the number of re-renders will also grow -- and a perceivable delay can creep into user interactions.

Where possible, you should stick to `<Subscribe>`. But in the rare case that there is noticeable lag, you can use Govern's `<Store of>` component to instantiate a *Store* object, which allows you to manually manage subscriptions.

Once you have a store object, there are two ways you can use it:

- You can access the latest output with its `getValue()` method.
- You can return the store from a component's `subscribe` method, and then republish the individual parts that you want.

For example, here's how the above example would look with a `<Store of>` component. Note that this adds a fair amount of complexity -- try to stick to `<Subscribe to>` unless performance becomes an issue. [See it live at CodeSandbox](https://codesandbox.io/s/616xxyppyz).

```js
class MapDistinct extends Govern.Component {
  subscribe() {
    return this.props.from
  }
  shouldComponentUpdate(nextProps, nextState, nextSubs) {
    return nextProps.to(nextSubs) !== this.props.to(this.subs)
  }
  publish() {
    return this.props.to(this.subs)
  }
}

const Field = ({ model, label }) => (
  <Subscribe to={model}>
    {model => (
      <label style={{ display: "block" }}>
        <span>{label}</span>
        <input
          value={model.value}
          onChange={e => model.change(e.target.value)}
        />
        {model.error && <p style={{ color: "red" }}>{model.error}</p>}
      </label>
    )}
  </Subscribe>
);

ReactDOM.render(
  <Store of={<RegistrationFormController />}>
    {store => (
      <form onSubmit={store.getValue().submit}>
        <Subscribe
          to={<MapDistinct from={store} to={output => output.request} />}
        >
          {request =>
            request && request.status === "error" ? (
              <p style={{ color: "red" }}>{request.message}</p>
            ) : null
          }
        </Subscribe>
        <Field
          label="Name"
          model={<MapDistinct from={store} to={output => output.model.name} />}
        />
        <Field
          label="E-mail"
          model={<MapDistinct from={store} to={output => output.model.email} />}
        />
        <Subscribe
          to={<MapDistinct from={store} to={output => output.canSubmit} />}
        >
          {canSubmit => (
            <button type="submit" disabled={!canSubmit}>
              Register
            </button>
          )}
        </Subscribe>
      </form>
    )}
  </Store>,
  document.getElementById("root")
);
```

Note how the above example only uses `getValue()` to access the `submit` action. This is ok, because we know that `submit` won't change, and thus we don't need to subscribe to future values.

Also note how the selector component defines a `shouldComponentUpdate` method. If this *wasn't* defined, then each update to the `from` store would cause a new publish -- even if the published value didn't change! Defining `shouldComponentUpdate` gives you control over exactly which changes cause a publish.


### Built-in components

Govern has a number of built-in elements to help you reduce boilerplate and accomplish common tasks. These are particularly useful for creating selector components.

The three built-ins that you'll use most often are:

1. `<map from={Store | Element} to={output => mappedOutput} />`

Maps the output of `from`, using the function passed to `to`. Each publish on the `from` store will result in a new publish.

2. `<flatMap from={Store | Element} to={output => mappedElement} />`

Maps the output of `from`, using the output of whatever element is returned by `to`. Each published of the *mapped* element results in a new publish.

3. `<distinct by?={(x, y) => boolean} children>`

Publishes the output of the child element, but only when it differs from the previous output. By default, outputs are compared using reference equality, but you can supply a custom comparison function via the `by` prop.

---

For example, you could use the `<flatMap>` and `<distinct>` built-ins to rewrite the `<MapDistinct>` component from the previous example as a stateless functional component. [See it live at CodeSandbox](https://codesandbox.io/s/0ozlm2lxjl).

```js
const MapDistinct = props => (
  <distinct>
    <map from={props.from} to={props.to} />
  </distinct>
);
```


Two out of Three types of state
-------------------------------

React application state can be split into roughly three categories:

-   Environment state

    State that is global to your entire application. For example:

    * Navigation state
    * Communication state
    * Authentication state
    * Cached data

    *Govern is great at handling environment state -- but it can also integrate with your existing Redux or MobX-based store.*

-   Control state

    State that represents that current view, and any actions that have been initialized from it. For example:

    * Form state
    * Errors form requests
    * Selected list items

    *Govern is great at handling control state. Just follow the guide above.*

-   View state

    State that represents the view, but does not affect the environment or control state. For example, animations and transitions.

    *Govern is **not** meant to handle view state. Use React component state instead.*


API Documentation
-----------------

### Govern.Component

Govern components are JavaScript classes that extend `Govern.Component`, and contain a `publish()` method.

If you've used React, the component API will be familiar. However, there are a couple differences:

- Govern components output plain JavaScript objects instead of DOM elements
- Govern components can declare subscriptions to other elements and stores

As a component author, the most obvious difference is that you'll define a `publish()` method in place of `render()`.

Govern also gives you the `subscribe()` method, and `subs` instance property, which combine to allow you to declare subscriptions to elements and stores.

##### Publishing and subscribing

- `publish()`
- `subscribe()`
- `subs`

##### Methods shared with React

- `constructor()`
- `static getDerivedStateFromProps()`
- `UNSAFE_componentWillReceiveProps()`
- `componentDidInstantiate()` (see React's `componentDidMount()`)
- `componentDidUpdate()`
- `componentWillBeDisposed()` (see React's `componentWillUnmount()`)
- `setState()`

##### Miscelaneous methods

- `dispatch()`

##### Instance properties shared with React

- `props`
- `state`

##### Class properties shared with React

- `defaultProps`

---

#### Component Lifecycle

##### `constructor()`

```js
constructor(props)
```

Identical to React's component [constructor](https://reactjs.org/docs/react-component.html#constructor), a Govern component's constructor can be used to bind event handlers, set initial state, etc.

##### `static getDerivedStateFromProps()`

```js
static getDerivedStateFromProps(nextProps, prevState)
```

Identical to React's [getDerivedStateFromProps](https://reactjs.org/docs/react-component.html#static-getderivedstatefromprops), this can be used to compute state from props.

##### `componentDidInstantiate()`

```js
componentDidInstantiate()
```

Similar to React's [componentDidMount](https://reactjs.org/docs/react-component.html#componentdidmount), this component will be called once the initial output is available.

Note that this will be called *before* the initial value of the component is flushed to any listening `<Subscribe>` components.

Any Govern state changes caused by this method will be executed before changes are flushed to React.

##### `UNSAFE_componentWillReceiveProps()`

```js
UNSAFE_componentWillReceiveProps(nextProps)
```

Identical to React's [UNSAFE_componentWillReceiveProps](https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops).

Where possible, avoid this in favor of `static getDerivedStateFromProps`.

##### `shouldComponentUpdate()`

```js
shouldComponentUpdate(nextProps, nextState, nextSubs)
```

Similar to React's [shouldComponentUpdate](https://reactjs.org/docs/react-component.html#shouldcomponentupdate), but receives a third argument with the latest values of the component's subscriptions.

When defined, returning a falsy value will prevent `publish` from being called, and prevent any changes from being published to subscribers.

##### `componentDidUpdate()`

```js
componentDidUpdate(prevProps, prevState, prevSubs)
```

Similar to React's [componentDidUpdate](https://reactjs.org/docs/react-component.html#componentdidupdate), but receives a third argument with the previous values of the component's subscriptions.

Any Govern state changes caused by this method will be executed before changes are flushed to React.

##### `componentWillBeDisposed()`

```js
componentWillBeDisposed()
```

Similar to React's [componentWillUnmount](https://reactjs.org/docs/react-component.html#componentwillunmount) lifecycle method, this component will be called before a component is scheduled to be disposed.

##### `setState()`

```js
setState(updater[, callback])
```

Identical to React's [setState](https://reactjs.org/docs/react-component.html#setstate).

##### `dispatch()`

```js
dispatch(actionFunction)
```

The dispatch method allows you to ensure that a group of changes only result in a single flush to your React app via `<Subscribe>` components.

This method is never required, but can be used to improve performance when making multiple changes in response to a single event.


#### Instance properties

##### `props`

Identical to React's [`props`](https://reactjs.org/docs/react-component.html#props).

##### `state`

Identical to React's [`state`](https://reactjs.org/docs/react-component.html#state).

##### `subs`

This property holds the latest output of any elements or stores that have been returned from your `subscribe()` method.


#### Class properties

##### `defaultProps`

Identical to React's [`defaultProps`](https://reactjs.org/docs/react-component.html#defaultprops).


### Stateless functional components

Govern's stateless functional components are a little different to React's. While React can treat function components as `render()` methods, a Govern stateless Govern component with just a `publish()` wouldn't be very useful at all.

As such, Govern treats function components as the `subscribe()` method of a class component, and publishes `this.subs` as its output.

For example, if you have a stateless functional component `sfc(props)`, then it will map to the following class component:

```js
class SFC extends Govern.Component {
  subscribe() {
    return sfc(this.props)
  }

  publish() {
    return this.subs
  }
}
```


### Built-in Govern components

Govern provides a number of useful primitives as built-in elements. Just like React, these can be created by passing a string as the first argument to `createElement()`.


#### `<map>`

```js
<map from={Store | Element} to={output => mappedOutput} />
```

Maps the output of `from`, using the function passed to `to`. Each publish on the `from` store will result in a new publish.

#### `<flatMap>`

```js
<flatMap from={Store | Element} to={output => mappedElement} />
```

Maps the output of `from`, using the output of whatever element is returned by `to`. Each published of the *mapped* element results in a new publish.

#### `<distinct>`

```js
<distinct by?={(x, y) => boolean} children={GovernElement | Store}>
```

Publishes the output of the child element, but only when it differs from the previous output. By default, outputs are compared using reference equality, but you can supply a custom comparison function via the `by` prop.


### React components

The *react-govern* package exports two components for creating and subscribing to Govern stores/elements within React applications.

#### `<Store>`

```js
<Store of={GovernElement} children={store => ReactElement} />
```

Instantiates the given Govern element as a `Store` object, and passes this object to the render function specified on `children`.

When the element passed to `of` changes, Govern will compare it against the previous element. If the element type and `key` prop match, Govern will update the props on the existing component instance. Otherwise, it will dispose the existing component instance and create a new one.

Unlike `<Subscribe>`, the render function will not be called when the store publishes new values. It will only be called when a new store is created, or when the `<Subscribe>` component itself is re-rendered.


#### `<Subscribe>`

```js
<Subscribe to={GovernElement | Store} children={output => ReactElement} />
```

Instantiates a store for the given Govern Element (if necessary), and subscribes to it -- passing each value to the `children` render function.

Uses the same strategy as `<Store>` for reconciling the element passed to `to`.


### `Store` objects

#### `getValue()`

```
getValue()
```

Return the store's current output.

#### `subscribe()`

```
subscribe(onNext, onError, onComplete, onStartDispatch, onEndDispatch, priority)
```

Creates a new subscription to the store.

This method is compatible with the [ESNext Observable proposal](https://github.com/tc39/proposal-observable), and thus can be used with RxJS, etc.

In general, you should avoid manually creating subscriptions in favor of using the `<Subscribe to>` component from the *react-govern* package.