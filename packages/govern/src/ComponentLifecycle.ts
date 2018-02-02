import { GovernNode } from './Core'

export interface ComponentLifecycle<P, S, C, O> {
    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: P);
    compose?(): GovernNode<any, C> | null;
    shouldComponentUpdate?(prevProps?: P, prevState?: S, prevComp?: C);
    render(): O;
    componentDidUpdate?(prevProps?: P, prevState?: S, prevComp?: C);
    componentWillBeDisposed?();
}