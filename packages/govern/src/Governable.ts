import { Governor } from './Governor'


export interface Governable<Props, T> {
    createGovernor(): Governor<Props, T>;
}

export interface GovernableClass<Props, T> {
    new (props: Props): Governable<Props, T>;
    defaultProps?: Partial<Props>;
    displayName?: string;
}