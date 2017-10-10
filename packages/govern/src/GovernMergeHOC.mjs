function defaultMergeFn(props, output) {
  return Object.assign({}, props, output)
}

export default function merge(Component, mergeFn=defaultMergeFn) {
  return [
    {
      props: props => props,
      output: Component,
    },
    ({ props, output }) => mergeFn(props, output)
  ]
}