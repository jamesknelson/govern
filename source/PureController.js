import shallowCompare from './shallowCompare'
import Controller from './Controller'

export default class PureController extends Controller {
  reconcile(a, b) {
    return shallowCompare(a, b)
  }
}