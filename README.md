react-controllers
=================

A tool for separating state from React Components.

[![npm version](https://img.shields.io/npm/v/react-controllers.svg)](https://www.npmjs.com/package/react-controllers)


Controller Classes
------------------

Controller Classes are classes with the following interface:

```typescript
type Unsubscriber = () => void;

abstract class Controller<I, O> {
  constructor(input: I);

  $intialize(): void;

  $set(input: I): void;
  $get(): O;

  $subscribe(
    // Should be called before any possible side effects
    onTransactionStart: () => void,

    // Should be called once out of the side effect zone
    onTransactionEnd: (unlock: () => void) => void

    // Should only be called between `onTransactionStart` and `onTransactionEnd`
    onChange: (output: O) => void,
  ): Unsubscriber;

  $destroy(): void;
}
```

- By emiting `onTransactionStart` and `onTransactionEnd` around any possible
side effects, **react-controllers** can batch state changes across multiple
controllers, and multiple changes to its props, before flushing them to
a child React component in one operation.

- Controllers should always return a new object if any part of it has changed.
  Modifying an output object in-place may cause changes to go undetected.