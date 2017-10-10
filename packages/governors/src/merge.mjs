function defaultMergeFn(props, output) {
  return Object.assign({}, props, output)
}

export default function merge(Governor, mergeFn=defaultMergeFn) {
  return [
    {
      props: props => props,
      output: Governor,
    },
    ({ props, output }) => mergeFn(props, output)
  ]
}