const KNOWN_STATICS = {
    name: true,
    length: true,
    prototype: true,
    caller: true,
    arguments: true,
    arity: true
}

export default function hoistStatics(source, target) {
  const keys = Object.getOwnPropertyNames(source)
  for (let i = 0; i < keys.length; ++i) {
    if (!KNOWN_STATICS[keys[i]]) {
        try {
            target[keys[i]] = source[keys[i]]
        }
        catch (error) {}
    }
  }
}