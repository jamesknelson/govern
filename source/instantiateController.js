export default function instantiateController(type, value) {
  const instance = new type(value)

  instance.$initialize()

  const controller = {
    set: instance.$set.bind(instance),
    get: instance.$get.bind(instance),
    subscribe: instance.$subscribe.bind(instance),
    destroy: instance.$destroy.bind(instance),
  }

  return Object.freeze(controller)
}
