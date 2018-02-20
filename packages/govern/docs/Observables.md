Quiz time! What's wrong with the design of this #reactjs component?

```jsx
const Identity = ({ observable }) =>
    <Subscribe to={observable.map(state => state.currentUser)}>
        {currentUser => 
            <div className='NavBar'>
                <img src={currentUser.gravatarURL} />
                <span>{currentUser.name}</span>
            </div>
        }
    </Subscribe>
```


Answers:

- a new observable needs to be created each time the component is rendered,
  and re-subscribed to on each render (yuck)
- the component will re-render each time anything in the store changes


These problems can be solved by using stores and queries:

```jsx
const Identity = ({ appStore }) =>
    <Subscribe to={<Query path='currentUser' from={appStore} />}>
        {currentUser => 
            <div className='NavBar'>
                <img src={currentUser.gravatarURL} />
                <span>{currentUser.name}</span>
            </div>
        }
    </Subscribe>


class AppStore extends Govern.Component {
    subscribe() {
        return {
            // TODO: currentUser: <Model />,
            currentUser: 'Fred',
        }
    }

    publish() {
        return {
            currentUser: this.subs.currentUser
        }
    }
}


class Query extends Govern.Component {
    subscribe() {
        return {
            data: this.props.from
        }
    }

    shouldComponentPublish(prevProps, prevState, prevSubs) {
        let path = this.props.path
        this.subs.data[path] !== prevSubs.data[path]
    }

    publish() {
        let path = this.props.path
        return {
            [path]: this.subs.data[path],
        }
    }
}


let appStore = Govern.instantiate(
    <AppStore />
)

ReactDOM.render(
    <Identity appStore={appStore} />,
    document.getElementById('app')
)
```
