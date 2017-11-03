API
===

This is the planned API.

**Note: some parts of this API do not yet exist.**

Types
-----

*Exported from `govern` package.*

```typescript
export type Unsubscriber = () => void;

export type GovernComponent<P, O> =
  GovernComponentClass<P, O>,
  (input: P): O,
  GovernComponent<any, any>[],
  { [key: string]: GovernComponent<P, any> }

export class GovernComponentClass<P, O> {
  isGovernComponent()
}

export interface GovernOutlet<T> {
  getOutput(): O;

  subscribe(
    // Should only be called between `onTransactionStart` and `onTransactionEnd`
    onChange: (output: O) => void,

    // Should be called before any possible side effects
    onTransactionStart: () => void,

    // Should be called once out of the side effect zone. The `done`
    // function should be called once the subscriber has processed all of
    // the transaction's changes.
    onTransactionEnd: (done: () => void) => void

    // Signals that there will be no further transactions or changes.
    onDestroy: () => void,
  ): Unsubscriber;

  // Memoized over `type`, so that repeated calls will result in the same
  // outlet (until it is destroyed).
  map<M>(type: GovernComponent<T, M>): GovernOutlet<M>;
}

export interface GovernController<P, O> extends GovernOutlet<O> {
  // If this is called on a component with no subscribers, the new props won't
  // be processed until a `getOutput`, `subscribe`, or subsequent
  // `scheduleChange` is called. In the case that  no `getOutput` is called
  // before a subsequent `scheduleChange`, `componentWillReceiveProps`
  // will be called, but `output` will not be (but may be called where
  // required on nested components)
  scheduleChange(newProps: P): void;

  // Should close any open transactions.
  destroy(): void;

  // A helper method to return an outlet when you want to pass a controller
  // somewhere without giving it control authority.
  getOutlet(): GovernOutlet<O>;
}

export function createController<P, O>(type: GovernComponent<P, O>, initialProps: P): GovernController<P, O>;


// A simple type of GovernComponentClass that can be used as a base class.
export class Govern.Component<P, O, S> extends Govern.Component<P, O> {
  readonly actions: { [name: string]: (...args: any[]) => void };
  readonly props: I;
  readonly state: S;

  constructor(props: I);

  setState(state: S): void;

  componentWillReceiveProps(nextProps): boolean;

  output(): O;

  reconcile(prevOutput: O, nextOutput: O): boolean;

  componentWillBeDestroyed(): void;
}



`@withController(prop='controller')`
------------------------------

*Exported from `react-govern` package.*

Higher Order Component that injects a GovernController whose output is the
component's current props.

### Example

```jsx
@withController()
class Example extends React.Component {
  constructor(props) {
    super(props)
    this.exampleController = props.controller.map(ExampleComponent)
  }

  render() {
    return (
      <Subscribe to={this.exampleController}>
        {bus =>
          <div>
            <div className='title'>{bus.title}</div>
            <button onClick={bus.actions.delete}>Delete</button>
          </div>
        }
      </Subscribe>
    )
  }
}
```


`@controlledBy(component: GovernComponent)`
----------------------

*Exported from `react-govern` package.*

Higher Order Component that replaces a component's props with the output of the
specified GovernComponent.

Internally, this should use the `<WithController>` and `<Subscribe>` components
with a map on the controller injected by `WithController`.

### Example

```jsx
TODO
```


`<WithController props children={(controller: GovernController) => ReactElement} />`
-------------------------------------------

*Exported from `react-govern` package.*

Component that injects a GovernController that just outputs whatever props were
passed into the component.

Used internally by the `withController` decorator.

### Example

```jsx
TODO
```


`<Subscribe to={controllerOutlet} children={(bus) => ReactElement} />`
-------------------------------------------------------------------

*Exported from `react-govern` package.*

Component that subscribes to the outlet specified on `to`, and passes its
latest output to the render function.


HoCs
----

### `merge<P, O, M>(type: GovernComponent<P, O>, mergeFn: (props: P, output: O) => M): GovernComponent<P, M>`

Returns a new GovernComponent that merges the initial input back into the output
of the passed in GovernComponent.

### `factory(key: string, type: GovernComponent<I, O>)`

Returns a new GovernComponent that outputs a Controller on the specified key.
Keeps the props of the embedded Component in sync, and destroys it when it is
destroyed itself.

### `subscribe(propName: string)`

Returns a new GovernComponent that accepts a Controller via the specified
prop, subsribes to it, and forwards its output.

### `withDefaultProps(defaultProps: Object)(component: GovernComponent<P, O> | ReactComponent)`

Return a new Component with the specified default props added. Also works with
React components.