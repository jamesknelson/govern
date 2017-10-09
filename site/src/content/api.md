API
===


Governor Instances
-----------------

*Exported from `govenors` package.*

```typescript
export type Unsubscriber = () => void;

// Governors can be represented by:
// - An class that extends the `Governor.Class` class
// - A function that takes an input and returns an output
// - An array of govenor types whose outputs should be passed into the following input
// - An object that shapes govenors
export type GovernorType<I, O> =
  GovernorConstructor<I, O>,
  (input: I): O,
  GovernorType<any, any>[],
  { [key: string]: GovernorType<I, any> }

export interface GovernorOutlet<T> {
  get(): O;

  subscribe(
    // Should only be called between `onTransactionStart` and `onTransactionEnd`
    onChange: (output: O) => void,

    // Should be called before any possible side effects
    onTransactionStart: () => void,

    // Should be called once out of the side effect zone
    onTransactionEnd: (unlock: () => void) => void

    // Signals that there will be no further transactions or changes.
    onDestroy: () => void,
  ): Unsubscriber;

  // Memoized over `govenor`, so that repeated calls will result in the same
  // govenor (until it is destroyed).
  map<M>(type: GovernorType<T, M>): GovernorOutlet<M>;
}

export interface GovernorController<I, O> {
  outlet: GovernorOutlet<O>;
  set(input: I): void;
  destroy(): void;
}

export function createGovernor<I, O>(type: GovernorType<I, O>, initialProps: I): Governor<I, O>;


// The interface that is used to actually create a Govenor by `createGovenor` is private.
export class GovernorClass<I, O, S> {
  readonly actions: { [name: string]: (...args: any[]) => void };
  readonly props: I;
  readonly state: S;

  constructor(props: I);

  setState(state: S): void;

  governorWillReceiveProps(nextProps): boolean;

  output(): O;

  reconcile(prevOutput: O, nextOutput: O): boolean;

  governorWillBeDestroyed(): void;
}



`@withGovernor(prop='govenor')`
------------------------------

*Exported from `react-govenors` package.*

Higher Order Component that injects a govenor instance whose output is the
component's current props.

### Example

```jsx
@withGovernor()
class Example extends React.Component {
  constructor(props) {
    super(props)
    this.exampleGovernor = props.govenor.map(ExampleGovernor)
  }

  render() {
    return (
      <Subscribe to={this.exampleGovernor}>
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


`@governedBy(Governor)`
----------------------

*Exported from `react-govenors` package.*

Higher Order Component that replaces a component's props with the output of the
specified govenor.

Internally, this uses the `<WithGovernor>` and `<Subscribe>` components.

### Example

```jsx
TODO
```


`<WithGovernor props children={(govenor) => ReactElement} />`
-------------------------------------------

*Exported from `react-govenors` package.*

Component that injects a govenor that just outputs whatever props were passed
into the component.

Used internally by the `withGovernor` decorator.

### Example

```jsx
TODO
```


`<Subscribe to={govenor} children={(bus) => ReactElement} />`
------------------------------------------------

*Exported from `react-govenors` package.*

Component that subscribes to the govenor specified on `to`, and passes its
latest output to the render function.


HoGs
----

### `merge<I, O, M>(type: GovernorType<I, O>, mergeFn: (input: I, output: O) => M): GovernorType<I, M>`

Returns a new GovernorType that merges the initial input back into the output
of the passed in GovernorType.

### `factory(type: GovernorType<I, O>)`

Returns a new GovernorType that outputs an GovernorInstance of the given type.
Keeps the props of the embedded Governor in sync, and destroys it when it is
destroyed itself.

### `subscribe(propName: string)`

Returns a new GovernorType that accepts a Governor instance via the specified
prop, subsribes to it, and forwards its output.

