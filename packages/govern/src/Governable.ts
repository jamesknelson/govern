import { Outlet } from './Outlet'


export interface Governable<Props, Value> {
    createOutlet(initialTransactionId: string): Outlet<Value, Props>;
}

export interface GovernableClass<Props, Value> {
    new (props: Props): Governable<Props, Value>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}