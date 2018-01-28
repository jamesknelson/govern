import { Governor } from './Governor'


export interface Governable<P, O> {
    createGovernor(): Governor<P, O>;
}

export interface GovernableClass<P, O> {
    new (props: P): Governable<P, O>;
    defaultProps?: Partial<P>;
    displayName?: string;
}