import * as Govern from "govern";

export class Model extends Govern.Component {
  static defaultProps = {
    defaultValue: ""
  };

  constructor(props) {
    super();
    this.state = {
      value: props.defaultValue
    };
  }

  publish() {
    return {
      value: this.state.value,
      error: this.props.validate && this.props.validate(this.state.value),
      change: this.change
    };
  }

  change = value => {
    this.setState({ value });
  };
}
