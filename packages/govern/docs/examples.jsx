<zoom governor={env} path='subName' />


const CurrentUser = ({ env }) =>
    <map
        from={env}
        to={value => {
            let id = value.auth.currentUser && value.auth.currentUser.id
            return !id ? null : <IdQuery env={env} id={currentUserId} />
        }}
    />


class Zoom extends Component {
    connect() {
        return {
            outlet: this.props.governor
        }
    }

    publish() {
        return {
            value: this.inlet.values[this.props.path],
            actions: this.inlet.actions[this.props.path],
        }
    }
}

const EnvQuery = ({ env, query }) =>
    <Query
        store={
            <zoom into={env} path='store' />
        }
        query={query(env.getValue().schema)}
    />

class Query extends Component {
    connect() {
        return {
            store: this.props.store,
        }
    }

    shouldComponentPublish(prevProps) {
        let { query } = this.props

        return (
            !this.props.query.equals(prevProps.query) ||
            this.props.query.canChangeAffectResult(this.connectedValue.store)
        )
    }

    publishValue() {
        return this.props.query.select(this.props.connectedValue.store)
    }
}



// @subscribe(props => ({
//     controller: <LoginFormController env={props.env} />
// }))
class LoginForm extends React.Component {
    render() {
        let model = Govern.zoom(this.props.controller.governor, 'model')

        return (
            <Form onSubmit={this.handleSubmit}>
                <InputField
                    label='E-mail'
                    model={GovernModel.zoom(model, 'email')}
                />
                <InputField
                    label='Password'
                    model={GovernModel.zoom(model, 'password')}
                    type='password'
                />
            </Form>
        )
    }

    handleSubmit = (e) => {
        e.preventDefault()
        this.props.controller.actions.submit()
    }
}


const InputField = ({ model, label, ...other }) =>
    <Subscribe to={model}>
        {(state, actions) =>
            <label>
                <span>{label}</span>
                <input
                    {...other}
                    value={state.value}
                    onChange={(e) => actions.change(e.target.value)}
                />
                <span>{state.error}</span>
            </label>
        }
    </Subscribe>
