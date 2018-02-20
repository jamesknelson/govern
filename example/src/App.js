import React from "react";
import { Subscribe } from "react-govern";
import { Field } from "./Field";
import { Query } from "./Query";
import './App.css';

class App extends React.Component {
  render() {
    let currentUserQuery = <Query path="currentUser" from={this.props.store} />;

    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Welcome to Govern!</h1>
          <h3>Build your application store with Components!</h3>
        </header>

        <div>
          <Subscribe to={currentUserQuery}>
            {currentUser => (
              <h2>
                Hello, {currentUser.value || "there"}! {"\u2728"}
              </h2>
            )}
          </Subscribe>
          <Field label="May I kindly ask your name?" store={currentUserQuery} />
        </div>
      </div>
    );
  }
}

export default App;
