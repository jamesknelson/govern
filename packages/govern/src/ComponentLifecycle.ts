import { GovernNode } from './Core'

export interface ComponentLifecycle<Props, State, Subs, T> {
    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: Props);
    subscribe?(): GovernNode<any, Subs> | null;
    shouldComponentUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    render(): T;
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    componentWillBeDisposed?();
}