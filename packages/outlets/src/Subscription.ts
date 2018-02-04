export interface Subscription  {
    closed: boolean;
    unsubscribe: () => void;
}

export class ClosableSubscription implements Subscription {
    // A boolean value indicating whether the subscription is closed
    closed: boolean;

    protected unsubscribeCallback?: () => void

    constructor(unsubscribeCallback?: () => void) {
        this.closed = false
        this.unsubscribeCallback = this.unsubscribeCallback
    }

    // Cancels the subscription
    unsubscribe(): void {
        if (this.closed) {
            console.warn(`"unsubscribe" was called on a "Subscription" that is already closed.`)
            return
        }

        if (this.unsubscribeCallback) {
            this.unsubscribeCallback()
        }
        
        this.closed = true
    }
}

export const closedSubscription = {
    closed: true,
    unsubscribe: () => { /* noop */ },
}