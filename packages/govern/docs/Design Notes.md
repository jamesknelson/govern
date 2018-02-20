DESIGN NOTES
------------

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
- important parts of env *state* at the time of request (not the store itself)
- a `dispatch` function

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


### monadic stores?

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

`Govern.instantiate` can turn an element into an store.


### mapping stores

The problem with allowing `map` on an store is that it would encourage
users to use `.map` within a component's `subscribe` method with
anonymous functions. As each call to `.map` receives a new function,
a new store will be returned. This would require re-subscribing on
each call to `connect`, possibly creating/destroying flatMapped
components.

I think `map`, `flatMap`, etc. on an store should return an element,
giving the user control over when it is instantiated. Otherwise the
user would need to manually dispose every lifted governor, or governors
would be auto-disposed on unsubscribe/getValue - and both of these are
not particularly attractive.

This also neatly solves the problem of reconciling lifted governors;
as they're just elements until they're instantiated, you can embed them
in `subscribe` methods and it just works. And if you really want to
create a lifted governor outside of a component (which you probably
don't, you just pass it to Govern.instantiate).


### typing

- if you're using types, you can use the types to make stricter code
- if you're *not* using types, things can be a little looser (e.g. overloading flatMap with map)


### `instantiate`

Why not overload name it `createStore`, and overload it to take same arguments
as createElement? After all, stores and elements can be used interchangeably,
this function creates a store, and it would just make sense?

The thing is, you generally don't want to create a store. You want to create an
element. By making it too easy to create a store, it is likely that users will
abuse it. Naming it this way makes the user think about whether they want to
create a new instance instead of just an element.

Additionally, you'll likely only need to create one or two stores manually in
an entire app, so the additional step won't get in the way.


### built-in elements

- <combine children />
- <combineArray children />
- <constant of />       // even if children is an element, that becomes the actual value
- <flatMap from to />   // falls back to map when `to` doesn't return an element/governor, like promises
- <map from to />       // when to returns an element, it is passed through as-is.


More elements can be added from utility packages, and if they get really
popular, they can be added as built-ins later.

While `map`, `flatMap`, etc. could be methods of Element, I won't add them
initially, as they'd be missing from elements created with React.createElement.
However, this makes it impossible to chain `flatMap` calls from a store. If
this turns out to be a problem, elements can have `map` and `flatMap` added to
them at a later date.

