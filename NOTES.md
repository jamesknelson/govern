- update `createGovernor` to accept a class and props, which will be automatically turned into an element
  (in contrast to ReactDOM.render, which only accepts elements, createGovernor will be called more
  frequently)
- make OutletSubject also an Outlet (so you don't need to pass it to an Outlet to make it usable),
  test this by rewriting react-outlets tests



outlet element transactions
---------------------------

Currently, transactions aren't emitted on the parent component when a child
outlet element emits transactions/changes; the parent component is treated as
constant (which it is).

However, if Env is a Component that contains all its output outlets as child
elements wrapped in <outlet> tags, it may be beneficial if Env itself emits
transaction events when its child outlets do (even though it won't emit change
events). This is because the transaction events could somehow be used by the
react `Connect` component that connects env's output into the app to indicate
that a batch is in progress, and DOM operations can be batched.
 

===

state is split into three type:

- environment
- control
- view


> Govern is about keeping your control state closer to your controls


Changes to environment state should all be applied to the environment object.
these are applied by calling env.update(actions => { ... })

Comm changes the environment too, so comm actions should be structured in
such a way that all of the changes are called within env.update blocks.
This could be as simple as passing `env` to io functions and wrapping all
changes in `env.update`, or it could involve passing  "operation creators" to
an operation tracker on the environment, which wraps the call to the operation
creator in `env.update`. I tend to prefer manually wrapping changes in
env.update within the actions, as it makes it more clear, and means that
the controller that initiates the request has direct access to the Operation
outlet if it wants.

The env.update pattern makes it hard to give actions return values, but I
have a gut feeling that they shouldn't have return vales anyway.

---

Control state components subscribe to parts of the environment state, as well
as its own internal state (e.g. models). It then combines it into something
useful, such as a Form record.

*If* control state components receive parts of the env via react props, but
part via outlets, they may go through multiple updates in one env update.
Resolutions to this involve passing env outlets instead of raw data, or
makin env render a number of outlets that don't generally update.

---

Ideal design:

- event calls an action on a control state controller
- this causes updates to a few parts of the environment, e.g. optracker and
  store
- changes are broadcast to the subscribed parts of the app via env outlet
- if you need just parts of the outlet, map it/operate on it (inrex should
  provide operators).
- even if env emits multiple changes, they're part of a single transaction,
  so each part is only re-rendered once (including the part controlled by the
  original controller)
- as changes are received by controllers before "end transaction" is,
  operations on the store will be immediately visible by the controllers.
- put the side effects in the top level controller. re-usable Components
  probably shouldn't have side effects.

store could be implemented with redux, or could be composed from redux,
junctions, etc.

---

my ideal env store:

- "Env" just outputs everything as raw data. Stored data, predictions,
  in-progress requests, current route, authentication, etc.
- All actions, including replay request etc., are only availble through
  `env.update`
- To consume env, you `<subscribe>` to it within a Govern or React component,
  so that you only cause re-renders after all updates have completed.
- You should only update env through a control component's actions.
- Child components of Env don't need to use the same `.update` pattern, so
  long as their actions can only be called from within env.update, as
  their outputs must be fed through Env, and thus their outputs will share
  the same transaction.

control components:

- can output actions directly (without an `.update` wrapper), as they're just
  meant to be consumed as event handlers, or composed within other components.

maybe in the future:

- if components could output separate "actions" and "data" outlets, where
  consuming an action outlet opens transactions in the reverse direction
  (a transaction in a consumer opens a transaction on the publisher), then
  maybe the `.update` wrapper could be removed and we'd get multi-render
  safety on control component actions too. But not now - I'm not even sure
  how I'd resolve the circular references.

---

easy things to remember:

- if its in your children or your parent's children, it is batched properly.



----------



desired API:

let model = formController.query(q => q.model)

model.do(a => a.patch({ $set: 'test' }))


class ProfileFormController extends Component {
    connect() {
        // can do the same thing without `Govern.object` outside of TS
        return Govern.object(
            currentUser: this.props.env.query(q => q.currentUser),
            model: <Model />,
            operation: this.state.operation && <subscribe to={this.state.operation} />,
        })
    }

    // Define what the `value` of the outlet will be
    getValue() {
        // By default, just returns connected value.
        return this.connectedValue
    }

    // When any of these actions are called in a `do` block, you can use
    // `setState` within this component and child components. Otherwise,
    // an exception will be thrown.
    getActions() {
        // By default, returns an object with connected actions
        // You can also access this.connectedValue if required.
        return this.connectedActions
    }
}



class Store extends Component {
    connect() {
        return <object children={this.props.children} />
    }

    getActions() {
        // maybe can add actions that let you select resource key string key?
    }
}


class Env extends Component {
    connect() {
        return {
            auth: <Auth />,
            operationTracker: <OperationTracker />,
            store:
                <Store>
                {{
                    account: <Store.Resource />,
                    breadboards: <Store.Resource />,
                    completedLessons: <Store.Resource />,
                    users: <Store.Resource />,
                }}
                </Store>,
        }
    }

    getQueries() {
        // Contains sub-queries for an <object>, with an element referencing
        // each child directly at the `root` property. This is ugly but I
        // can't think of anything nicer right now, and it can probably be
        // fixed later on.
        this.connectedQueries

        // e.g. map over store keys, with
        // store: <subscribe to={this.connectedOutlet.query(q => q.store).query(q => q.key)}

        // as well as being able to get an element for a child, we also want to be able
        // to run one of its queries, and get *that* element.
        // if we *can* run queries

        return {
            // adds store, auth, comm queries 
            ...this.connectedQueries

            // just a helper to make it easier to place this somewhere else. 
            currentUser:
                this.connectedQueries.store.users.id(this.connectedValue.auth.currentUserId)}
        }
    }
}


class Resource extends Component {
    getQueries() {
        return {
            id: (id) => <IdQuery id={id} data={this.connectedValue} />,
            index: (key) => <IndexQuery key={key} data={this.connectedValue} />,
        }
    }
}
function IdQuery({ data, id }) {
    return data.records[id]
}
class IndexQuery extends Component {
    // by using a component instad, you can set shouldComponentUpdate,
    // add actions, etc.
    // you can also use state, so that you can keep collections with reference equality until they change
    
    getValue() {
        return this.props.data.records[this.props.id]
    }
}


class Model extends Component {
    constructor(props) {
        super(props)
        this.state = {
            memcord: ModelRecord.create(...)
        }
    }

    connect() {

    }

    getActions() {
        return {
            actions: this.patch
        }
    }

    getQueries() {
        return {
            zoom: (key: string) =>
                <ZoomModel
                    key={key}
                    property={key}
                    value={this.state.memcord}
                    patch={this.patch}
                />
        }
    }
    
    patch = (value) => {
        this.setState({
            memcord: this.state.memcord.merge(...)
        })
    }
}
class ZoomModel extends Component {
    constructor(props) {
        super(props)

        let key = props.property
        let model = props.value

        this.state = {
            memcord: Model.create({
                children: model.children ? model.children[key] : null,
                disabled: model.disabled,
                error: model.error ? model.error[key] : null,
                id: model.id,
                path: model.path.concat(key),
                value: model.value[key],
            })
        }
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        let model = nextProps.value
        let key = nextProps.property

        return {
            // todo: if key/id changes, create a new object
            memcord: prevState.memcord.merge({
                children: model.children ? model.children[key] : null,
                disabled: model.disabled,
                error: model.error ? model.error[key] : null,
                value: model.value[key],
            })
        }
    }

    getValue() {
        return state.memcord
    }

    getActions() {
        return {
            change: this.change,
            patch: this.patch,
        }
    }

    getQueries(connectedQueries) {
        return {
            zoom: (key: string) =>
                <ZoomModel
                    key={key}
                    property={key}
                    value={this.state.memcord}
                    patch={this.patch}
                />
        }
    }

    patch = (patch: Model.Patch<M["value"]>) => {
        this.props.patch({
            $children: {
                [key]: patch
            }
        })
    }

    change = (newValue: M["value"]) => {
        this.patch({ $set: newValue })
    }
}


interface Outlet {
    // subscribes to state/and maybe actions
    subscribe(observer)

    // gets the state
    getValue(): Value

    // calls actions, with the block receiving current actions
    do(block): void

    // returns a new outlet
    query(block): Outlet

    // map/filter are not made available, as we need to be able to reconcile
    // outlets, and anonymous functions are not easily reconcilable

    // ---
    // private interface, for use by parent component:

    actions
    queries

    // maybe this can be used so that you can embed a query result directly
    // as a child in `connect`? It just needs to wrap with `<subscribe>`.
    toGovernElement(): GovernElement
}


If I can keep this stateless, like an element, then I can compare outlets
to see if they "reconcile", and should use the same underlying instance.

This may be achievable by having `query` return an object that lists the
queries in order, along with the original source. Then the outlet can be
translated into a component (or series of components) that subscribes to
things along the way, with updates to queries just resulting in updated
props for those elements, and the <subscribe> eventually subscribing to
the output of that component.

If you call `subscribe` manually, this is irrelevant, as "reconciling" is
just about automatically deciding if we need to resubscribe.