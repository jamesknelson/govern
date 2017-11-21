import { createController, isGovernController } from './GovernController'
import { StatefulComponent, PureStatefulComponent, StrictStatefulComponent } from './GovernBaseClasses'
import { default as merge } from './GovernMerge'
import { createSubscriberComponent as subscriber } from './GovernSubscriber'
import { default as factory } from './GovernFactory'

// These are here to allow for a nicer TypeScript API; they're not actually
// require when using Govern with plain JavaScript.
export function sequence(...x) { return x }
export function parallel(x) { return x }
export function map(x) { return x }

const Govern = {
  createController,
  isGovernController,
  StatefulComponent,
  PureStatefulComponent,
  StrictStatefulComponent,
  merge,
  subscriber,
  factory,

  sequence,
  parallel,
  map,
}

export {
  createController,
  isGovernController,
  StatefulComponent,
  PureStatefulComponent,
  StrictStatefulComponent,
  merge,
  subscriber,
  factory,
}

export default Govern