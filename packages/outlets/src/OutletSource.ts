import { Target } from './Target'
import { Subscription } from './Subscription'

export interface OutletSource<T> {
    closed: boolean;
    getValue(): T
    subscribe(target: Target<T>): Subscription;
}