Controllers
===========

- controllers could define actions using decorators in typescript (similar to mobx)...
- `connectControllers` should be `connectController`. Use ParallelController if you'd like many
- may help with performance to have some more composible method of handling multiple `connects`. Maybe a library method like "makeConnector" that returns a kinda half-thunk that checks the argument, and composes if not an element/node?


SeriesController
----------------

Execute multiple controllers in series, allowing the output of interanal controllers to
call actions and affect the input of internal controllers, while still giving safety when
treated as a whole controller.

Note: FreezableControllers don't work well in SeriesControllers, as they can't pass data onto the next controller while frozen.

- `static controllers` is an array of controller classes to use
- `input()` method returns the env that will be passed to first serial controller, allowing methods/actions/state to be passed in
- `this.internalOutput` is the output of the serialControllers
- `this.instances` contains the internal instances. this can be used to feed actions to our actions
- `output()` is responsible for feeding serialOutput to the actual output
- any controller with a junction will be treated as children of the parent junction

ParallelController
------------------

Allow multiple controllers to be bundled into a single controller

- `static controllers` is an object mapping key to controller class
- `input()`
- `this.internalOutput` is an object mapping key to controller output
- `this.instances`
- `output()` defaults to just returning `internalOutput`
- creates a junction set from any junctions on controllers

HoverController
---------------

Adds a "hover" output when the mouse is hovered, including the hover coordinates.

- `connectHover()` clones passed in React Element, merging in `onMouseEnter` and `onMouseLeave` callbacks

FocusableController
-------------------

Communicates with `bus.focusManager` to keep track of `tabindex` and inject `focused` prop.

- `focus()` action will focus
- `connectFocusable()` adds ref to passed in React Element, allowing `focus()` action to work with DOM and to add onFocus/onBlur events
- doesn't need a separate backend/monitor, just a ref that allows it to be focused manually
- pass actions to React onBlur and onFocus props, which delegate out to the focusManager
- outputs `tabindex`, `focused`
- accepts `onFocus`, `onBlur` callbacks
- outputs `focus()` action on bus

DraggableController
-------------------

Communicates with `bus.dragDropManager` to make `bus.value` available to dropzones.

- Passes through `bus.onCancel` after cancelling any in-progress drags.
- Extend to configure
- `this.monitor` can be used to provide drag state to the output
- `canDrag()` defaults to `return !bus.disabled && !!bus.value`, but can be overriden
- calls `bus.onDragStart`, `bus.onDragEnd` callbacks
- `connectDraggable()`

DropZoneController
------------------

Communicates with `bus.dragDropManager` to receive a value from a draggable somewhere

- Extend to configure
- `this.monitor` can be used to provide drag state to the output
- `canDrop()` can be overriden to decide what draggables can be dropped
- `draggableDidHover()` is called when a draggable hovers over the drop zone
- `draggableDidDrop()` is called when a draggable is dropped over the drop zone
- calls `bus.onDrop` callbacks
- `connectDropZone()`

ActivatableController
---------------------

Controller that adds listeners to `connect` that call an "onActivate" callback on specified buttons, including possibly mouse buttons, and add an "activating" output. adds `onCancel` listener to the bus, cancels when called and then continues up the bus.

WheelController
---------------

Injects relevant listeners onto `connect` and provides rate-limited lifecycles and callbacks

ScopeController
---------------

Provides "onCancel/onSubmit" handlers to bus that do not pass through if the relevant lifecycles are provided

CancelController
----------------

Calls bus onCancel when given key is hit, defaulting to "Escape"

SubmitController
----------------

Calls bus onSubmit and cancels propagation on specified buttons



---

FocusController

- should call "focus" only when programatically focusing
- should call "blur" only when programatically blurring
- accepts "onFocusIn" callback, called before the element is focused
- accepts "onFocusOut" callback, called before the element is blurred
- outputs "focused" prop
  * `true` if this element holds tabfocus
  * a number if its child holds tabfocus
  * `false` if not focused

Lifecycle:

- control is clicked by user
- previous control loses focus




---

Each bus should have an `id` that corresponds to its expected data. Roughly, each control's bus will have a single id.
`busFork` stores the latest value of bus by id, using this value within the forked handlers. This way, second and
subsequent renders just need to update the cached bus value -- they don't need to create new handlers.

This also allows busFork to be used within Stateless Functional Components.

Each forked bus needs to have a new id. Ids can be created as paths. Updated buses created within controls also need new ids.



busFork.cache = {}
function busFork(bus, field) {
  const result = {
    value: bus.value && bus.value[fields],
  }

  const cache = busFork.cache[bus.id]
  if (cache) {
    cache.__bus = bus

    // ...
  }
}



The `onChange` handler of a bus can accept `Patch` objects as well as new values. When a `Patch` object is received, it will be run on the the original value to produce a new value.


import update from 'immutability-helper'

class Patch {
  constructor(commands = {}) {
    this.commands = {}
  }

  execute(input) {
    return update(input, this.commands)
  }

  $zoom(key) {
    return new Patch({ [key]: this.commands })
  }
}

function $merge(obj) {
  return new Patch({ $merge: obj })
}


---


when you want to use a bus without passing it directly, use Wormhole.Entry and Wormhole.Exit to create wormhole-enabled controls or screens:


<Wormhole.Entry bus={}>

</Wormhole.Entry>

@Wormhole.Exit


A wormhole Exit will inject whatever props are at the closest wormhole entry. Internally, it uses state and callbacks to make sure the exit is updated when then entry changes, even if there are shouldComponentRender methods in between.