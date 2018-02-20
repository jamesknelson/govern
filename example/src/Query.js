import * as Govern from "govern";

export class Query extends Govern.Component {
  subscribe() {
    return {
      data: this.props.from
    };
  }

  shouldComponentPublish(prevProps, prevState, prevSubs) {
    let path = this.props.path;
    return this.subs.data[path] !== prevSubs.data[path];
  }

  publish() {
    return this.subs.data[this.props.path];
  }
}
