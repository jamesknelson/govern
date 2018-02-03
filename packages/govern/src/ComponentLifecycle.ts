import { GovernNode } from './Core'

export interface ComponentLifecycle<Props={}, State={}, Value=any, Subs=any> {
    componentDidInstantiate?();
    componentWillReceiveProps?(nextProps: Props);
    subscribe?(): GovernNode<any, Subs> | null;
    shouldComponentUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    getValue(): Value;
    componentDidUpdate?(prevProps?: Props, prevState?: State, prevSubs?: Subs);
    componentWillBeDisposed?();
}