import compose from './compose'
import instantiateDefaultControllers from './instantiateDefaultControllers'
import connectControllers from './connectControllers'

const controlledBy = controllerClasses => Component =>
  compose(
    instantiateDefaultControllers(controllerClasses),
    connectControllers(typeof controllerClasses == 'function' ? 'controller' : Object.keys(controllerClasses))
  )(Component)

export default controlledBy