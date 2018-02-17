DESIGN NOTES
------------

### Naming

// i like this name for some reason.
`subscribe`

// while long, the meanings of these are obvious when paired with `connect`
`subs`

// separate because otherwise you'll end up writing return { value: ... }
// often, and leaving them together would almost certainly result in
// people forgetteng the { value } when just returning a value.
`publish`


Maybe "governor" is not the best name? Observable makes it more obvious
what is happening, even if it isn't a standard observable. "Channel" would
be a nice name too. Package name can always be changed if required.

"Governor" is easy to rename, so just use that for now and maybe think about
a name change before release.


### `dispatch` vs. `actions`

`dispatch` could be made available on the governor itself. However, by not
putting it on the governor, it forces people to subscribe to any governors
that they want to dispatch on, with `dispatch` called on the parent governor
instead of the governor that is being subscribed on, encouraging the user to
keep the number of transactions to a minimum.

This makes sense within other govern components; subscribing is simple.
However, it does make it a little difficult to use with the React <Subscribe>
component, where most actions are used as individual event handlers. As such,
the child function of <Subscribe> receives actions bound to dispatch, instead
of the dispatch function.


### `componentWillReceiveSubs`

While at first it feel like this lifecycle method should be available, there
is an important different from `componentWillReceiveProps` that makes it
particularly dangerous:

Any call to `setState` in this lifecycle method would require the same method
to be called again, as it would also result in `subscribe` being called again.
This means that calls to `setState` which aren't predicated on some condition
would cause an infinite loop. This is obviously not acceptable.

Instead, if you need to memoization some computation that depends on `subs`,
just use a memoized function, plain instance variables or a within `publish`.


### how to do requests?

Requests are a PITA. They:

- make changes to the envirnoment, both synchronously and asynchronously
- often require multiple changes
- need to be watched by both the environment and the controller that creates
  them
- are often called in series with changes to a form controller's state

Requests should receive:

- an id
- the env state at the time of request
- actions that can be dispatched

This way, the request can be created *within* the env controller, ensuring
that a `dispatch` call on the request controller will result in a transaction
on the `env` controller -- allowing actions to be called safely in an async
response.

It will also allow the current state of the response to be queried by the
form controller.

The reason that requests should be children of the `env` controller, is that
you may want to retry a request after the child that created it is destroyed.
If you're happy with requests being disposed/cancelled along with the form
that creates it, you can just add it as a child of the controller itself.


### dev tools

for each publicly accessible outlet, need to be able to see its state in some sort of dev tool,
as well as record previous dispatches (and their actions), and previous states


### monadic governors?

governors / elements can be treated as a monad, where governors are "eager",
and elements are "lazy".

They both can support a "flatMap" method, which maps the value to another
governor or element. (With elements, this just returns a <flatMap> element)

A <constant> element can act as `return`/`point`/`of` for elements.

As elements can always be used where governors are expected, and an "eager"
constant doesn't make sense, we don't need `return/point/of` for governors.

Then, `map`, `join`, `ap` etc. can be implemented from <constant> and flatMap,
see: https://brianmckenna.org/blog/category_theory_promisesaplus

I feel like plain objects / primitives should be treated as <constant>
elements, just for usability / making it easier for beginners. But this could
be disallowed when using TypeScript.

`Govern.materialize` can turn an element into an outlet.


### mapping governors

The problem with allowing `map` on an outlet is that it would encourage
users to use `.map` within a component's `subscribe` method with
anonymous functions. As each call to `.map` receives a new function,
a new outlet will be returned. This would require re-subscribing on
each call to `connect`, possibly creating/destroying flatMapped
components.

I think `map`, `flatMap`, etc. on a governor should return an element,
giving the user control over when it is instantiated. Otherwise the
user would need to manually dispose every lifted governor, or governors
would be auto-disposed on unsubscribe/getValue - and both of these are
not particularly attractive.

This also neatly solves the problem of reconciling lifted governors;
as they're just elements until they're instantiated, you can embed them
in `subscribe` methods and it just works. And if you really want to
create a lifted governor outside of a component (which you probably
don't, you just pass it to Govern.instantiate).


### built-in elements

- <combine children />
- <constant of />       // even if children is an element, that becomes the actual value
- <flatMap from to />   // falls back to map when `to` doesn't return an element/governor, like promises
- <get path from />     // outputs value/actions of given path on `from` element/governor

Undocumented: people who know how to use them will probably figure out that
they exist anyway, and flatMap will be less confusing for people who don't.

- <flatten children />  // undocumented; when children's value is an element, that element's value is output
- <map from to />       // undocumented; when to returns an element, it is passed through as-is.

const FlatMap = ({ from, to }) =>
  <flatten>
    <map from={from} to={to} />
  </flatten>

More elements can be added from utility packages, and if they get really
popular, they can be added as built-ins later.

While `map`, `flatMap`, etc. could be methods of Element, I won't add them
initially, as they'd be missing from elements created with React.createElement.


TODO
----

clean up (and get tests working)

o remove plain observables from tests
o as `setProps` shouldn't be available on the public API, governor doesn't
  need to be typed on props, or at least, props should be the second type arg
  and it should default to any
o remove all references to <outlet> from existing tests
o remove all references to outlet.map, outlet.lift from existing tests
o remove references to getOutlet, replace with raw governor

transactions

- remove flush in favor of transactions, get tests to pass

note: no renaming just yet.

- test: setState outside of transaction fails
- test: setState works as expected within callback to component.prototype.transaction
- test: outlet.subscribe's first callback receives dispatch as second argument
- test: setState works as expected within dispatch from `outlet.subscribe`
- remove manual transactionStart/transactionEnd from outlet in favor of dispatch where possible

connectChild (don't rename yet)

- test: setState on children fails outside of parent's dispatch
- test: setState on children works within component.prototype.dispatch
- test: setState on children works within `outlet.subscribe's` dispatch

- test: component.prototype.dispatch is a getter that cannot be accessed
        outside of the constructor, and lifecycle methods (so that the user
        can only use it when creating async subscriptions, but not in actions)

- test: outlets can be added as-is to connectChild's return object to subscribe to them
- test: outlets can be added as-is to `<combine>` to subscribe to them
- remove `<subscribe />` built-in, get tests passing

note: these don't all need to type check, but they should be supported for raw js
- test: elements can be returned from connectChild
- test: objects can be returned from connectChild, and their properties will be subscribed to
- test: nested objects can be returned from cnonectChild, and their propreties will be subscribed to
- test: arrays can be returned from connectChild, and their properties will be subscribed to as arrays
- test: array elements with same `key` prop but different index share instances
  (arrays allow <OperationTracker /> that is just a list of operation governors or elements)
- test: a <constant of={<element />} /> can be returned from connectChild, and the value will not be subscribed to.
- test: strings/numbers can be returned and are treated as constants

- test: `<flatMap>` doesn't emit a new value when the element returned by the `to` function doesn't
  (allowing shouldComponentPublish to work inside the from function's returned component)

- test: `<get>` component works as expected

- rename `connectChild` to `subscribe`
- rename `child` to `subs`
- rename component.prototype.transaction -> `dispatch`
- rename createGovernor -> Govern.instantiate

- merge <Subscribe /> code back into react-govern, stop exporting raw `<Subscribe />`
- test: <Subscribe /> binds actions to dispatch and injects into children function
- test: <Subscribe /> accepts governors as well as elements

- subscribe HoC: 

subscribe(
  mapOwnPropsToElement,
  mapValueToProps, // receives ownProps and dispatch too
  mapDispatchToProps, // receives value and ownProps too
  merge
)

- test: rewrite tests with JSX types

OTHER

- govern-fetch package (has fetch component that calls `terminate` once complete)
- figure out how to make nestable queries for a store

FUTURE

- `map` could be implemented on an outlet/governor object, you'd just want the
  map function to return an element instead of a value, and you'd want the
  result to be an object with the same source but different operator
  (like RxJS), so that when used within a component's `subscribe` block, the
  block can reconcile the source and mapped elements separately instead of
  trying to reconcile the mapped outlet. This would go most of the way to the
  "query" support I was thinking about.

  One level of mapping should be simple; just convert the mapped outlet into
  a `<map>` builtin within component impl's `subscribe` method. More levels
  *may* be simple depending on how operators/outlets are structured.

  A `return` function (maybe Outlet.of) may help here, so you can do
  Outlet.of(x) to map to some non-element function.