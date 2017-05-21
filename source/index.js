import connectControllers from './connectControllers'

export { default as controlledBy } from './controlledBy'
export { default as Controller } from './Controller'
export { default as instantiateController } from './instantiateController'
export { default as instantiateDefaultControllers } from './instantiateDefaultControllers'
export { default as PureController } from './PureController'

export { connectControllers }
export const connectController = connectControllers('controller')