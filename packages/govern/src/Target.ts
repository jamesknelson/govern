import { Subscription } from './Subscription'

/**
 * Target objects represent a single location where observable events can be
 * pushed to.
 * 
 * Targets can be closed by their creator, using the `subscription` object
 * is passed to `start`. Once closed, the target holder should clean up any
 * resources used to push to the target.
 */
export abstract class Target<T> {
    // A boolean value indicating whether the subscription is closed
    readonly closed: boolean

    // Receives the subscription object when `subscribe` is called
    abstract start(subscription: Subscription): void

    abstract next(value: T): void
    abstract error(err?: any): void
    abstract complete(): void
    abstract transactionStart(transactionId: string): void
    abstract transactionEnd(transactionId: string): void
}

export function isValidTarget(target: any): target is Target<any> {
    return target instanceof Target
}

export class TargetClosedError extends Error {
    constructor() {
        super('target closed');
        this.name = 'TargetClosedError';
        (Object as any).setPrototypeOf(this, TargetClosedError.prototype);
    }
}