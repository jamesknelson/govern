import React from "react";
import * as Govern from "govern";
import { Model } from "./Model";

export class AppStore extends Govern.Component {
  subscribe() {
    return {
      currentUser: <Model defaultValue="" />
    };
  }

  publish() {
    return {
      currentUser: this.subs.currentUser
    };
  }
}
