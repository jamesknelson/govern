import { createController, isGovernController } from './GovernController'
import { Component, PureComponent } from './GovernBaseClasses'
import { default as merge } from './GovernMerge'
import { createSubscriberComponent as subscriber } from './GovernSubscriber'
import { default as factory } from './GovernFactory'

const Govern = {
  createController,
  isGovernController,
  Component,
  PureComponent,
  merge,
  subscriber,
  factory,
}

export {
  createController,
  isGovernController,
  Component,
  PureComponent,
  merge,
  subscriber,
  factory,
}

export default Govern