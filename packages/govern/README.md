Govern
======

A state management library for people who enjoy React.

[![npm version](https://img.shields.io/npm/v/govern.svg)](https://www.npmjs.com/package/govern)

---

Managing state in React apps can be daunting. Govern makes it staightforward. It lets you get more done with the APIs you already know, and untangles your business logic in the same way that React untangled your view.

With Govern, you manage your state with *store components*. These are a lot like React components - they can receive props, call `setState`, and define lifecycle methods. They can be defined as ES6 classes, or as stateless functions. 

Store components can handle state, actions, side effects, and selectors. This means that Govern can replace redux (or MobX), redux-thunk, redux-saga, reselect, and even recompose. But you can still use these tools when it makes sense - Govern is flexible, just like React.

And if you know React, then you already know most of Govern's API, so you'll be productive in no time.


Simple, Sensible Forms: a short guide.
--------------------------------------

Creating forms with React is usually a little awkward. Govern makes it easy and fun. It lets you break your state into small components, and then reuse them -- as God and [Douglas McIlroy](https://en.wikiquote.org/wiki/Doug_McIlroy) intended.


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

When a component's `subscribe` method returns an object of Govern elements, the component will subscribe to those element, and place the latest values on `this.subs`. You can then use the value of `this.subs` within the `publish` method, allowing you to *combine* store components.

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

    *Govern is great at handling environment state -- just create a store at the root of your application, and pass it to your screen controllers via React props.*

-   Control state

    State that represents that current view, and any actions that have been initialized from it. For example:

    * Form state
    * Errors form requests
    * Selected list items

    *Govern is great at handling control state. Just follow the guide above.*

-   View state

    State that represents the view, but does not affect the environment or control state. For example, animations and transitions.

    *Govern is **not** meant to handle view state. Instead use React component state.*


API Documentation
-----------------

### Component Classes


- not sure what example to use
- note that any changes caused by componentDidUpdate will be executed *before*
  changes are flushed to react, ensuring that you don't get multiple renders.
  (don't mention componentDidFlush... it can stay in the API docs, and will
  confuse people otherwise.)

#### `this.subs`

A property that contains the last output of the component connected via `subscribe`.

This is similar in purpose to React's `refs` property. You can use it to interact with child components when required, but it is generally cleaner to avoid this if possible.

#### `this.setState(changes)`

Usage is identical to React's `setState`.

#### `this.dispatch(Function)`

If you need to make calls to `setState` outside of lifecycle methods or
React components, you'll need to wrap these calls in a `dispatch` call.

For example, you'll need to use this when handling the response of a HTTP
Request.


### Component Lifecycle

As store components are not mounted/unmounted from the DOM, their lifecycle is a little different from the React component lifecycle.

#### `constructor(props)`

The constructor is called when a Controller isntance is instantiated.

Perform any initialization here, including:

- setting an initial value of `this.state`
- addings event handlers to stores, etc.

*Note that store components do **not** receive `context`, so you'll need to pass any required data in via props.*

#### `componentDidInstantiate()`

Similar to `componentDidMount`, this component will be called once the initial output is available.

#### `UNSAFE_componentWillReceiveProps(nextProps)`

This is identical to the React lifecycle method.

#### `componentDidUpdate(nextProps, nextState, nextChild)`

Similar to React's `componentDidUpdate`.

#### `componentWillBeDisposed()`

Called when a component will be be destroyed. Use this in the same way that you'd use React's `componentWillUnmount()` lifecycle method.


### Stateless function components

- a little different to React, as they need to handle publish *and* subscribe instead of just render
- the function is treated as a `subscribe` function, and all suscriptions are published.


### Built-in Govern components

#### <map from={Store | Element} to={output => mappedOutput} />

Maps the output of `from`, using the function passed to `to`. Each publish on the `from` store will result in a new publish.

#### <flatMap from={Store | Element} to={output => mappedElement} />

Maps the output of `from`, using the output of whatever element is returned by `to`. Each published of the *mapped* element results in a new publish.

#### <distinct by?={(x, y) => boolean} children>

Publishes the output of the child element, but only when it differs from the previous output. By default, outputs are compared using reference equality, but you can supply a custom comparison function via the `by` prop.


### React components

#### <Store of={GovernElement} children={store => ReactElement}>

Instantiates 

#### <Subscribe to={GovernElement | Store} children={output => ReactElement}>


### `Store` objects

#### `getValue()`

#### `subscribe()`
