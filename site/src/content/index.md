Govern
======

A simpler way to manage React application state.

- [API Reference](./api.md)

Govern lets you manage state with renderless components, facilitating reusability while keeping to the concepts you already know.


Another state management tool?
------------------------------

The React ecosystem already has Redux and `setState`. So why create yet another solution?

**Govern doesn't replace Redux or `setState`, but embraces and complements them.**

Where Redux is great at managing *global* state like fetched data, Govern is great at managing *control* state -- for example, selected items, pagination, or search queries.

And where React's `setState` method is great for simple cases like animations, it still ties state to the DOM. With Govern's renderless components, you can use the same `setState` API to store state wherever you'd like. This makes it great for keeping form state between route changes.


Renderless Components
---------------------

Govern allows you to manage state with Components. And to do this, it gives you a new type of Component: *Renderless Components*.

In a vanilla React app, all your components must render some markup. Every component is tied to the DOM in one way or another. But what if you want some state to exist independent of the view?


---

Where React components are tasked with 

Govern gives you a way to create **state-only components**. These components are a lot like React components. But unlike React components, Govern components don't render anything, and must be manually instantiated.


Govern gives you a new type of component, which you can use much the same way as React components. Govern components have a constructor, `setState` method, and `componentWillReceiveProps` -- just like the React components you already know.

But Govern components don't have a `render()` method, as you don't need markup to manage state. Instead, they have an `output()` method, that lets you select the props that will act as input for the next component.









Redux is a single global store. This works well for global things like data caches, but doesn't always make sense when writing UI components. The actions and types for a view are global -- so what if you want to re-use a screen?

In contrast, Govern is component-based. It fits more with how React works, which makes it easier to structure apps, and makes it easier for you to switch betweeen writing views, and writing controllers - while still integrating seamlessly with Redux for when global state makes sense.

Actually, Govern is pretty similar to MobX. The main difference is that Govern mimics React's API where possible -- so you probably already know enough to get started!


React Components, Govern Components
-----------------------------------

- Govern is built around components, just like React.
- Govern components share a number of similarities with React Components:
  * They both receive props
  * They both can be defined with ES6 classes or stateless functions
  * State is managed with `setState`
  * They both have lifecycle methods, and in particular they have `componentWillReceiveProps`
- But Govern Components are focused on state management, so they do have some differences. In particular
  * Govern components don't have a `render` method, and thus are also missing `refs` and mount-related lifecycle methods like `componentDidMount` and `componentWillUnmount`.
  * Govern components must be instantiated manually, using `createController`
  * Govern components have an `output` method, which lets you choose the props of the "next" component.



For example:

...

Problems:

- 