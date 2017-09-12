export default function instantiateController(type, props) {
  const propsWithDefaults = Object.assign({}, props)
  const defaultProps = type.defaultProps
  if (defaultProps) {
    for (let key of Object.keys(defaultProps)) {
      if (props[key] === undefined) {
        propsWithDefaults[key] = defaultProps[key]
      }
    }
  }

  const instance = new type(propsWithDefaults)

  instance.$initialize()

  const controller = {
    set: instance.$set.bind(instance),
    get: instance.$get.bind(instance),
    subscribe: instance.$subscribe.bind(instance),
    destroy: instance.$destroy.bind(instance),
  }

  return Object.freeze(controller)
}
