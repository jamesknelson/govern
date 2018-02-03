import * as React from 'react'
import * as Govern from 'govern'


export interface SourceProps {
  element?: Govern.GovernElement<any, any>,
  children: (observable: Govern.Observable<any>) => React.ReactNode | null,
}


/**
 * A Component that creates an observable from a Govern Element that is
 * injected via the `element` prop.
 * 
 * The created observable is passed to the children via a render function.
 */
export class Source extends React.Component<SourceProps> {
  governor: Govern.Governor<any, any>

  getSourceElement(props: SourceProps) {
    return props.element || Govern.createElement('combine', { children: {} })
  }

  componentWillMount() {
    // Create controllers within `componentWillMount` instead of in
    // `constructor`, as we can't rule out the possibility that
    // the controller will have some side effects on initialization.
    this.governor = Govern.createGovernor(
      Govern.outlet(this.getSourceElement(this.props))
    )
  }

  componentWillReceiveProps(nextProps) {
    this.governor.setProps({
      children: this.getSourceElement(nextProps)
    })
  }

  componentDidCatch(error) {
    this.governor.dispose()
    throw error
  }

  componentWillUnmount() {
    this.governor.dispose()
  }

  render() {
    return this.props.children(this.governor.getValue())
  }
}