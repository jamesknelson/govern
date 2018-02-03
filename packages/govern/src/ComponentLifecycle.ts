import { GovernNode } from './Core'

export interface ComponentLifecycle<P, S, C, O> {
    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: P);
    subscribe?(): GovernNode<any, C> | null;
    shouldComponentUpdate?(prevProps?: P, prevState?: S, prevSubs?: C);
    render(): O;
    componentDidUpdate?(prevProps?: P, prevState?: S, prevSubs?: C);
    componentWillBeDisposed?();
}