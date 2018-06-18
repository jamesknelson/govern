Govern
======

A component-based state management library.

[![npm version](https://img.shields.io/npm/v/govern.svg)](https://www.npmjs.com/package/govern)

[Try it live at CodeSandbox](https://codesandbox.io/s/31oo429ql1).

---

Managing state in React apps can be daunting. Govern makes it straightforward.

With Govern, you manage your state with an API you already know - *components*. Govern components are just like React components - they receive props, call `setState`, and define lifecycle methods. But where React components render UI elements, Govern components render plain old JavaScript objects.

Govern components can handle state, actions, side effects, and selectors. This means that Govern can replace redux (or MobX), redux-thunk, redux-saga, reselect, and even recompose. But you can still use these tools when it makes sense - Govern is flexible, just like React.

And if you know React, then you already know most of Govern's API, so you'll be productive in no time.

```bash
# Install with NPM
npm install --save govern react-govern

# Install with Yarn
yarn add govern react-govern
```

Simple, Sensible Forms: A Guide.
--------------------------------

Creating forms with React can be a little awkward. While React components are great for representing the form's UI, most forms also have a lot of business logic behind the UI.

Govern makes forms simpler by allowing you to write components that *just* manage business logic.

This guide will walk you through creating a Govern component that manages the business logic for user registration, including:

- Form state
- Validation
- Submitting a request
- Redirecting the user on success


### Defining Govern components

Govern components are just JavaScript classes that extend `Govern.Component`. Like React components, they have `props`, `state`, and lifecycle methods like `componentDidMount` and `componentDidUpdate`.

To build a form, you'll need to store the form's state somewhere. And ideally, this state will be decoupled from the view -- which makes a Govern component the perfect place to store it!

Forms are usually composed from multiple fields. So let's start by building a component that models a single field's logic. It'll need to output the following:

- The current value of the field
- A function to change the current value
- Any validation errors

Here's an example of how you could make this component with Govern:

```js
import * as Govern from 'govern'

class FieldModel extends Govern.Component {
  static defaultProps = {
    defaultValue: ''
  }

  constructor(props) {
    super(props)

    this.state = {
      value: props.defaultValue,
    }
  }

  render() {
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

The neat thing about the above component is that if you know React, you already know what is going on here!

The only difference from a standard React component is that instead of rendering UI elements, you render raw data. Which you can then subscribe from within your view.


### Subscribing to a Govern component

Govern provides a `<Subscribe to>` React component that allows React components to subscribe to Govern components.

This component takes a Govern element for its `to` prop, and a render function for its `children` prop. It calls the render function with each new published value -- kind of like a super-powered version of React's context API.

Here's a barebones example that connects a `<Model>` to an input field. [See it live at CodeSandbox](https://codesandbox.io/s/0y10o4977l).

```js
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Subscribe } from 'react-govern'

ReactDOM.render(
  <Subscribe to={
    // JSX is optional. This is equivalent to:
    // Govern.createElement(Model, { validate: validateEmail })
    <FieldModel validate={validateEmail} />
  }>
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
    return "please enter a valid e-mail"
  }
}
```

Of course, forms usually have a number of fields, and it would be downright tedious to hook them all up this way. In fact, if you've used React Context, you may have experienced this yourself. Luckily, Govern gives you another option.

### Combining components

Govern components can render more than just plain old JavaScript objects -- like React, they can also render other components!

```js
class WrapperComponent extends Govern.Component {
  render() {
    return (
      <FieldModel
        validate={validateEmail}
        defaultValue={this.props.defaultValue.email}
      />
    )
  }
}
```

There's just one problem -- how do you combine multiple components? Unlike React, Govern isn't rendering to the DOM, so you can't wrap multiple components with `<div>` or `<span>` tags.

To solve this, Govern provides its own primitives for combining elements. For example, the `Govern.combine` primitive can be used to render an object with the latest values of some specified elements:

```js
class RegistrationFormModel extends Govern.Component {
  static defaultProps = {
    defaultValue: { name: '', email: '' }
  }

  render() {
    let defaultValue = this.props.defaultValue

    return Govern.combine({
      name:
        <FieldModel
          defaultValue={defaultValue.name}
          validate={validateNotEmpty}
        />,
      email:
        <FieldModel
          defaultValue={defaultValue.email}
          validate={validateEmail}
        />,
    })
  }
}

function validateNotEmpty(value) {
  if (!value) {
    return "please enter your name"
  }
}
```

And with that, you now have a component that manages the state of your entire form! You can then subscribe to the form model with `<Subscribe to>`, just as before.

One of the benefits of using the same `<FieldModel>` component for every field is that it makes creating reusable form controls simpler. For example, you could create a `<Field>` React component to render your field models. [See it live at CodeSandbox](https://codesandbox.io/s/vv09or2853).

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

Like React, Govern allows you to define your components as simple render functions.

For example, you could convert the above `<RegistrationFormModel>` component to a stateless functional component. [See it live at CodeSandbox](https://codesandbox.io/s/n5993ozp5l).

```js
const RegistrationFormModel = ({ defaultValue }) =>
  Govern.combine({
    name: <FieldModel defaultValue={defaultValue.name} validate={validateNotEmpty} />,
    email: <FieldModel defaultValue={defaultValue.email} validate={validateEmail} />
  });

RegistrationFormModel.defaultProps = {
  defaultValue: { name: '', email: '' } 
}
```


### Submitting forms

Once you have some data in your form, submitting it is easy -- you just publish a `submit` handler along with the form data. Everything you know about handling HTTP requests in React components transfers over to Govern components.

But before we can make a request, we need to know data the request should contain. Which is a problem, because the form data is stored within a child component...

#### The `value` instance variable

Each Govern component has a `value` instance variable that holds the current rendered value. You can use this to access the actions and state that child components have exposed to subscribers.

For example, a `RegistrationFormController` component could render a `<RegistrationFormModel>`, and use the `value` instance variable to get the form's state when the user presses "submit":

```js
class RegistrationFormController extends Govern.Component {
  render() {
    return Govern.combine({
      model: <RegistrationFormModel />,
      submit: this.submit,
      request:
        this.state.action &&
        <PostRegistrationRequest
          data={this.state.action.data}

          // Like React, components will be unmounted and remounted if the key
          // changes. This ensures that resubmitting results in a new request.
          key={this.state.action.key}
        />,
    })
  }

  submit = e => {
    e.preventDefault();

    let data = {
      email: this.value.model.email.value,
      name: this.value.model.name.value
    };

    // Make an AJAX request with the form's data.
    postRegistration(data)
  };
}
```


#### Request components

One great thing about Govern is that it let's you re-use patterns that are already well understood by the community. For example, you could implement your request by following Dave Ceddia's excellent guide on [AJAX Requests in React](https://daveceddia.com/ajax-requests-in-react/).

Of course, the other great thing about Govern is that it let's you decouple your UI from your state -- without learning a brand new API. One practical example is that you can put your AJAX logic in *Request Components*. Like with Dave Ceddia's guide, these components make a request on mount. But instead of rendering the output directly to the UI, they render an object containing the request's status.

```js
import * as axios from "axios";

class PostRegistrationRequest extends Govern.Component {
  state = {
    isBusy: true,
  }

  render() {
    return this.state
  }

  componentDidMount() {
    axios.post('/user', this.props.data)
      .then(response => {
        if (!this.isCancelled) {
          this.setState({
            data: response.data,
            isBusy: false,
            response,
            wasSuccessful: true,
          })
        }
      })
      .catch(response => {
        if (!this.isCancelled) {
          this.setState({
            data: response && response.data,
            isBusy: false,
            response,
            wasError: true,
          })
        }
      });
  }

  componentWillUnmount() {
    // If the component is unmounted, we should not handle the response.
    this.isCancelled = true
  }
}
```

Defining requests as Govern components may feel a little weird at first, but it has some big advantages:

- Requests can automatically retry on failure, outputting a relevant status as they change
- Unlike promises, request components can output progress and be cancelled by unmounting
- You can pass elements around as "lazy" requests - they won't be run until they're mounted

Request components also make it easy to share communication logic within and between applications. For an example, see [this gist](https://gist.github.com/jamesknelson/ab93890eb26f2841a2f8846d4013b151) of an axios-based `<Request>` component.

Once you have a request component like `PostRegistrationRequest`, you can start it by subscribing to it from a parent component. [See it live at CodeSandbox](https://codesandbox.io/s/313j167zpp).

```js
class RegistrationFormController extends Govern.Component {
  state = {
    action: null
  };

  render() {
    return Govern.combine({
      model: <RegistrationFormModel />,
      submit: this.submit,
      request:
        this.state.action &&
        <PostRegistrationRequest
          data={this.state.action.data}

          // Like React, components will be unmounted and remounted if the key
          // changes. This ensures that resubmitting results in a new request.
          key={this.state.action.key}
        />,
    })
  }

  submit = e => {
    e.preventDefault();
    this.setState({
      action: {
        data: {
          email: this.value.model.email.value,
          name: this.value.model.name.value
        },
        key: Date.now(),
      }
    });
  };
}

ReactDOM.render(
  <Subscribe to={
    <RegistrationFormController />
  }>
    {({ model, request, submit }) => (
      <form onSubmit={submit}>
        {request &&
          request.wasError && (
            <p style={{ color: "red" }}>Your request failed :-(</p>
          )}
        <Field label="Name" model={model.name} />
        <Field label="E-mail" model={model.email} />
        <button type="submit">
          Register
        </button>
      </form>
    )}
  </Subscribe>,
  document.getElementById("root")
);
```

Note how the `key` prop is used in the above example; just like React, changing `key` will result in a new component instance being created, and thus a new request being made each time the user clicks "save".

But while we do want the user to be able to start a new request if the previous one failed, we don't want the user to accidentally start two requests, or to start a second request after the first one succeeds. How can we keep track of this?


### Computed values

Suppose that the `RegistrationFormController` component renders a `canSubmit` boolean. This would make it possible to guard against resubmission by checking `this.value.canSubmit` within the `submit` action, and to set the `disabled` prop of the submit button.

This hypothetical `canSubmit` value would be `true` when:

- The model does not have any errors, and
- Submit hasn't been clicked yet (i.e. `this.state.action` is null) or
- The previous submit failed (i.e. `this.value.request.wasError` is true)

While `this.value` can't be accessed directly from within `render()`, Govern provides a `map` primitive that allows you to map the output of an element, just like you can map an array.

For example, you could use `Govern.map` to compute a `canSubmit` value for the above component as so. [See it live at CodeSandbox](https://codesandbox.io/s/l7pk9wnpjl).

```js
class RegistrationFormController extends Govern.Component {
  state = {
    action: null
  };

  render() {
    return Govern.map(
      Govern.combine({
        model: <RegistrationFormModel />,
        request:
          this.state.action &&
          <PostRegistrationRequest
            data={this.state.action.data}
            key={this.state.action.key}
          />,
      }),
      ({ model, request }) => ({
        model,
        request,
        submit: this.submit,
        canSubmit:
          !model.email.error && !model.name.error &&
          (!request || request.wasError)
      })
    )
  }

  submit = e => {
    e.preventDefault();
    if (this.value.canSubmit) {
      this.setState({
        action: {
          data: {
            email: this.value.model.email.value,
            name: this.value.model.name.value
          },
          key: Date.now(),
        }
      });
    }
  };
}
```

Govern's `map` and `flatMap` primitives serve a similar purpose to the React [Render Prop](https://reactjs.org/docs/render-props.html) pattern. However, map/flatMap have a number of advantages:

- You can use `shouldComponentUpdate` (doing so in React components with render props results in wailing and gnashing of teeth)
- You can change the structure of components' children (doing so in React results in child components being remounted)
- You can use the `combine` primitive on mapped components (combining React components with render props results in pyramids of doom)

But returning to our registration form example, the user now has a problem - once they've registered, they'll be stuck on a screen with a disabled form. Let's fix this by automatically redirecting them to a welcome page.


### Reacting to changes in value

To redirect away from the page when the request completes, we just need to watch for the `wasSuccessful` value of `<PostRegistrationRequest>` to turn to true.

Govern doesn't currently provide a way to watch a controller's output value. But not to worry, we can just pass the output through another component's props using the `flatMap` primitive, and watch it that way.

[See it live at CodeSandbox](https://codesandbox.io/s/31oo429ql1).

```js
class RegistrationFormController extends Govern.Component {
  state = {
    action: null
  };

  render() {
    return Govern.flatMap(
      Govern.combine({
        model: <RegistrationFormModel />,
        request:
          this.state.action &&
          <PostRegistrationRequest
            data={this.state.action.data}
            key={this.state.action.key}
          />,
      }),
      ({ model, request }) => 
        <InnerRegistrationFormController
          // Separate the output (which will be passed through to our
          // subscribers) from the props used by the inner component itself.
          history={this.props.history}
          output={{
            model,
            request,
            submit: this.submit,
            canSubmit: 
              !model.email.error && !model.name.error &&
              (!request || request.wasError)
          }}
        />
    )
  }

  submit = e => {
    e.preventDefault();
    if (this.value.canSubmit) {
      this.setState({
        action: {
          data: {
            email: this.value.model.email.value,
            name: this.value.model.name.value
          },
          key: Date.now(),
        }
      });
    }
  };
}

class InnerRegistrationFormController extends Govern.Component {
  hasNavigated = false

  render() {
    return this.props.output
  }

  componentDidUpdate() {
    let request = this.props.output.request
    if (request && request.wasSuccessful && !this.hasNavigated) {
      this.hasNavigated = true
      this.props.history.push('/members/welcome')
    }
  }
}
```

So what's the difference between `map` and `flatMap`? Simple:

- `map` expects a function that **returns a plain JavaScript object**
- `flatMap` expects a function that **returns an element**


The App Observable
------------------

Most apps have a single "App" component that holds application-wide state, including authentication, cached data, etc. Because this component is relevant to the entire app, mounting it with the react-govern <Subscribe> doesn't make sense -- it would cause the entire app to be re-rendered on any change, and would require you to pass the output via props or React context.

It's best to stick to `<Subscribe>` where possible. But when you need more control, you can create a **Govern observable**.

Govern observables are wrappers around a Govern component. They can be manually instantiated, and passed to primitives like `map` and `flatMap` in place of elements. You can also pass them through React props and context, allowing you to access app-level state within controllers for individual screens.


### An offline indicator

This example App observable exports a value that indicates whether the user is online or offline. A React component then subscribes to the offline indicator using `flatMap` and `distinct` -- which ensures that the indicator only re-renders when `isOnline` changes, regardless of other changes within the store.

The App also exports an automatically increasing `counter` variable; notice how even though the counter is increasing, the online/offline status only changes when you enable/disabled your network connectivity.

[See it live at CodeSandbox](https://codesandbox.io/s/9yzkqx9wr).

```js
import * as Govern from "govern";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Subscribe } from "react-govern";

class App extends Govern.Component {
  state = {
    isOnline: window.navigator.onLine,
    counter: 1
  };

  render() {
    return this.state;
  }

  componentDidMount() {
    window.addEventListener("offline", this.handleOnlineChange);
    window.addEventListener("online", this.handleOnlineChange);
    window.setInterval(() => {
      this.setState(state => ({
        counter: state.counter + 1
      }));
    }, 1000);
  }

  handleOnlineChange = () => {
    this.setState({
      isOnline: window.navigator.onLine
    });
  };
}

const appObservable = Govern.createObservable(<App />);

let counterRenderCount = 0;
let networkRenderCount = 0;

ReactDOM.render(
  <div>
    <Subscribe
      to={Govern.flatMap(appObservable, app => Govern.distinct(app.counter))}
    >
      {counter => (
        <React.Fragment>
          <h3>Counter (rendered {++counterRenderCount} times)</h3>
          {String(counter)}
        </React.Fragment>
      )}
    </Subscribe>
    
    <Subscribe
      to={Govern.flatMap(appObservable, app => Govern.distinct(app.isOnline))}
    >
      {isOnline => (
        <React.Fragment>
          <h3>Network status (rendered {++networkRenderCount} times)</h3>
          {isOnline ? "ONLINE" : "offline"}
        </React.Fragment>
      )}
    </Subscribe>
  </div>,
  document.getElementById("root")
);
```



Two out of Three types of state
-------------------------------

React application state can be split into roughly three categories:

-   App store

    State that is global to your entire application. For example:

    * Navigation state
    * Communication state
    * Authentication state
    * Cached data

    *Govern is great at handling environment state, and can also be integrated with your existing Redux or MobX-based store.*

-   Controllers

    State that represents that current view, and any actions that have been initialized from it. For example:

    * Form state
    * Errors form requests
    * Selected list items

    *Govern is great at handling control state.*

-   View state

    State that represents the view, but does not affect the environment or control state. For example, animations, transitions, and state for controlling interactions with DOM elements.

    *Govern is **not** meant to handle view state. Use React component state instead.*


API Documentation
-----------------

### Govern.Component

Govern components are JavaScript classes that extend `Govern.Component`, and contain a `render()` method.

If you've used React, the component API will be familiar. There are just a few differences:

- `render` can output anything!
- There are no refs; use `this.value` instead
- Context is not supported; use Govern Observables instead
- `getSnapshotBeforeUpdate` is not available (or necessary)
- The `dispatch` method allows for manually specified batches

##### Rendering

- `render()`
- `value` (the latest output of the element returned by `render()`)

##### Methods shared with React

- `constructor()`
- `static getDerivedStateFromProps()`
- `componentWillReceiveProps()`
- `componentDidMount()`
- `componentDidUpdate()`
- `componentWillUnmount()`
- `setState()`

##### Miscellaneous methods

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

Similar to React's component [constructor](https://reactjs.org/docs/react-component.html#constructor), a Govern component's constructor can be used to bind event handlers, set initial state, etc.

##### `static getDerivedStateFromProps()`

```js
static getDerivedStateFromProps(props, state)
```

Similar to React's [getDerivedStateFromProps](https://reactjs.org/docs/react-component.html#static-getderivedstatefromprops), this can be used to compute state from props.

##### `componentDidMount()`

```js
componentDidMount()
```

Similar to React's [componentDidMount](https://reactjs.org/docs/react-component.html#componentdidmount), this component will be called once the initial output is available.

Note that this will be called *before* the initial value of the component is flushed to any listening `<Subscribe>` components.

Any Govern state changes caused by this method will be executed before changes are flushed to React.

##### `componentWillReceiveProps()`

```js
componentWillReceiveProps(nextProps)
```

Similar to React's [UNSAFE_componentWillReceiveProps](https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops). Not prefixed with `UNSAFE_` as Govern doesn't have plans for supporting async rendering.

Where possible, avoid this in favor of `static getDerivedStateFromProps`.

##### `shouldComponentUpdate()`

```js
shouldComponentUpdate(nextProps, nextState)
```

Similar to React's [shouldComponentUpdate](https://reactjs.org/docs/react-component.html#shouldcomponentupdate).

When defined, returning a falsy value will prevent `render` from being called.

##### `componentDidUpdate()`

```js
componentDidUpdate(prevProps, prevState)
```

Similar to React's [componentDidUpdate](https://reactjs.org/docs/react-component.html#componentdidupdate), but receives a third argument with the previous `value`.

Any Govern state changes caused by this method will be executed before changes are flushed to `<Subscribe>` React components.

##### `componentWillUnmount()`

```js
componentWillUnmount()
```

Similar to React's [componentWillUnmount](https://reactjs.org/docs/react-component.html#componentwillunmount) lifecycle method, this component will be called before a component is scheduled to be disposed.

##### `setState()`

```js
setState(updater[, callback])
```

Similar to React's [setState](https://reactjs.org/docs/react-component.html#setstate).

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

##### `value`

This property holds the latest output of the element that was returned from your component's `render()` method.


#### Class properties

##### `defaultProps`

Identical to React's [`defaultProps`](https://reactjs.org/docs/react-component.html#defaultprops).


### Stateless functional components

As with React, you can define a component as a stateless function, which will be treated as the `render()` method of an otherwise empty component.

```js
// Stateless functional component
const SFC = () =>
  ({ foo: 'bar' })

// Equivalent class component
class SFC extends Govern.Component {
  render() {
    return { foo: 'bar' }
  }
}
```


### Primitive Govern components

Govern provides a number of primitives for composing elements. Typically these are accessed through the following factory methods:

- `combine()`
- `map()`
- `flatMap()`
- `distinct()`
- `constant()`

Like React, these can also be created by passing a string as the first argument to `Govern.createElement()`. Govern also accepts elements created by `React.createElement()`, so you can define them with JSX.

#### `combine()`

```js
// With factory function
Govern.combine({ name: elementOrObservable })

// With JSX
<combine>{{
  name: elementOrObservable
}}</combine>
```

#### `map()`

```js
// With factory function
Govern.map(elementOrObservable, value => computedValue)

// With JSX
<map from={elementOrObservable} to={value => computedValue} />
```

Maps the output of `from`, using the function passed to `to`. Each publish on the `from` store will result in a new publish.

#### `flatMap()`

```js
// With factory function
Govern.flatMap(elementOrObservable, value => computedElement)

// With JSX
<flatMap from={elementOrObservable} to={value => computedElement} />
```

Maps the output of `from`, using the output of whatever element is returned by `to`. Each published of the *mapped* element results in a new publish.

#### `distinct()`

```js
// With factory function
Govern.distinct(children, /* optional */ (x, y) => areValuesEqual)

// With JSX
<distinct by={/* optional */ (x, y) => areValuesEqual}>
  {elementOrObservable}
</distinct>
```

Publishes the output of the child element, but only when it differs from the previous output. By default, outputs are compared using shallow equality, but you can supply a custom comparison function via the `by` prop.

#### `constant()`

```js
// With factory function
Govern.constant(value)

// With JSX
<constant>{{value}}</constant>
```

An element to represent an unchanging value. You won't usually need this, as objects returned from `render()` are treated as constants by default. However, it can come in handy in conjunction with `flatMap`, which expects its props to be elements.

### React components

The *react-govern* package exports a single component for creating and subscribing to Govern stores/elements within React applications.

#### `<Subscribe>`

```js
<Subscribe to={elementOrObservable}>
  {value => <SomeReactElement />}
</Subscribe>
```

Mounts the given Govern Element (if necessary), and subscribes to it -- passing each value to the `children` render function.

Any prop changes are passed through; if the type or key of the `to` element changes, the old component will be unmounted.


### `GovernObservable` objects

Govern components are basically observables. In fact, Govern lets you create Observables from Govern elements. These observables implement the proposed [ESNext Observable](https://github.com/tc39/proposal-observable) specification, along with some Govern-specific methods.

Observables can be passed to `combine`, `flatMap` and `map`, in place of elements.

Govern observables are a great way to manage an app-wide store. Just create an observable at the root of your application, then pass it down to where it is required using React context or as a prop, and subscribe to the parts you need with `distinct`, `map`, etc.

#### `createObservable()`

```
createObservable(element)
```

Instantiates the component specified by the `element` argument, and returns a `GovernObservable` object that can be used to interact with the component.

#### Observable methods

##### `getValue()`

```
observable.getValue()
```

Return the component's current value.

##### `subscribe()`

```
observable.subscribe(onNext, onError?, onComplete?, onStartDispatch?, onEndDispatch?, priority?)
```

*In general, you should avoid manually creating subscriptions in favor of using the `<Subscribe to>` component from the *react-govern* package.*

Creates a new subscription to the store.

This method is compatible with the proposed [ESNext Observable](https://github.com/tc39/proposal-observable) specification, and thus can be used with RxJS, etc.

If `onStartDispatch` and `onEndDispatch` are not provided, then `onNext` not be called during a dispatch. 

`Component.prototype.setState` cannot be called on the any component connected to the observable while `onNext` is being called. If you need to call actions during an `onNext` handler, wrap the call within `waitUntilNotFlushing()`.

##### `dispose()`

```
observable.dispose()
```

Clean up any resources used by the observable.

##### `waitUntilNotFlushing()`

```
waitUntilNotFlushing(functionToRunWhenNotFlushing)
```

Runs the specified function once it is safe to call `setState` again. Mainly used when you need to call an action from within an observables `subscribe()` handler, or from within a React lifecycle method.
