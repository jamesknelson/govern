import shallowCompare from './shallowCompare'
import Controller from './Controller'

export default class PureController extends Controller {
  shouldCalculateOutput(previousProps, previousState) {
    return !shallowCompare(this.props, previousProps) || !shallowCompare(this.state, previousState)
  }
}