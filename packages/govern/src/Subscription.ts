export interface Subscription  {
    closed: boolean;
    unsubscribe: () => void;
}

export const closedSubscription = {
    closed: true,
    unsubscribe: () => { /* noop */ },
}