import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { FlatMapProps } from '../Core'
import { instantiateWithManualFlush, Instantiable } from '../Instantiable'
import { Store } from '../Store'
import { GovernElement, createElement, convertToElement, doElementsReconcile } from '../Element'
import { getUniqueId } from '../utils/getUniqueId'
import { Subscription } from '../Subscription'
import { Target } from '../Target'

interface Child<FromValue> {
    element: GovernElement<any, FromValue>,
    store?: Store<FromValue>,
    subscription?: Subscription,
    target?: Target<any>,
    value: FromValue,
}

const noop = () => {}

export class FlatMap<FromValue, ToValue> implements Instantiable<FlatMapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<FlatMapProps<FromValue, ToValue>, any, ToValue, ToValue> {
    from: Child<FromValue>
    hasUnpublishedChanges: boolean = true
    impl: ComponentImplementation<FlatMapProps<FromValue, ToValue>, any, ToValue, ToValue>;

    transactionId?: string

    // A list of transactions that were received from children.
    childTransactions: Set<string> = new Set()

    // A list of children that have been removed, but are awaiting unsubscribe
    // when the transaction level reaches 0.
    childrenAwaitingUnsubscribe: Child<any>[] = []

    // A list of transactions from external sources, which we've dispatched to
    // child stores and need to close when 
    externalTransactions: Map<string, Store<FromValue>[]> = new Map()
    
    constructor(props: FlatMapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)

        // This hack records *when* we receive new values from the underlying
        // `to` component, even if the values are the same. It allows us to
        // respect `shouldComponentUpdate` of `to` if it exists.
        // DO NOT TRY THIS AT HOME.
        let originalSetKey = this.impl.setKey
        this.impl.setKey = (key: string, value) => {
            originalSetKey.call(this.impl, key, value)
            this.hasUnpublishedChanges = true
        }
    }

    componentWillEnterTransaction(transactionId: string) {
        this.transactionId = transactionId

        // Only start transaction on child if the transaction originated
        // from outside of the child.
        if (!this.childTransactions.has(transactionId) && this.from && this.from.store) {
            this.registerStoreTransaction(transactionId, this.from.store)
            this.from.store.transactionStart(transactionId, this.from.target!)
        }
    }

    componentWillReceiveProps(nextProps: FlatMapProps<FromValue, ToValue>) {
        this.receiveProps(nextProps)
    }

    componentWillLeaveTransaction() {
        this.closeRegisteredTransactions()
    }

    componentWillBeDisposed() {
        delete this.from
    }

    subscribe() {
        return this.impl.props.to(this.from.value)
    }

    shouldComponentPublish(prevProps, prevState, prevSubs) {
        return this.hasUnpublishedChanges
    }

    publish() {
        this.hasUnpublishedChanges = false
        return this.impl.subs
    }

    instantiate(initialTransactionId: string, parentTarget: Target<any> | undefined): Store<ToValue, FlatMapProps<FromValue, ToValue>> {
        this.impl.transactionStart(initialTransactionId, parentTarget)
        this.receiveProps(this.impl.props)
        return this.impl.createStore()
    }


    receiveProps(props: FlatMapProps<FromValue, ToValue>) {
        // invariant: we'll always be inside a transaction within this method.
        //
        // - `componentWillReceiveProps` is always called inside a transaction
        // - a transaction is started at the beginning of `instantiate`

        let fromElement = convertToElement(props.from)
        let elementHasChanged = !this.from || !doElementsReconcile(this.from.element, fromElement)

        if (elementHasChanged && this.from && this.from.target) {
            let prevElement = this.from.element
            if (prevElement.type !== 'subscribe' && prevElement.type !== 'constant') {
                this.from.store!.dispose()
            }

            // Prevent any further changes from being received from this child.
            // Once we've hit 0 transaction level, we'll unsubscribe.
            this.from.target.next = noop
            this.childrenAwaitingUnsubscribe.push(this.from)
        }

        if (elementHasChanged) {
            let store: Store<any> | undefined
            let target: Target<any> | undefined

            if (fromElement.type === 'subscribe') {
                target = new FlatMapTarget(this)
                store = fromElement.props.to

                // It is possible that the `to` store will call actions on the
                // `from` store during initialization, so we need to open a
                // transaction on it.
                store!.transactionStart(this.transactionId!, target)
            }
            else if (fromElement.type !== 'constant') {
                target = new FlatMapTarget(this)
                store = instantiateWithManualFlush(fromElement, this.transactionId!, target)
            }

            if (store) {
                this.from = {
                    element: fromElement,
                    value: <any>undefined,
                    store,
                    target,
                }
                this.registerStoreTransaction(this.transactionId!, store)
                this.from.subscription = store.subscribe(target!)
            }
            else {
                this.from = {
                    element: fromElement,
                    value: fromElement.props.of
                }
            }
        }
        else {
            if (fromElement.type === 'constant') {
                this.from = {
                    element: fromElement,
                    value: fromElement.props.of
                }
            }
            else if (fromElement.type !== 'subscribe') {
                this.from.store!.setProps(fromElement.props)
            }
        }
    }

    registerStoreTransaction(transactionId: string, store: Store<FromValue>) {
        let arr = this.externalTransactions.get(transactionId)
        if (!arr) {
            this.externalTransactions.set(transactionId, [store])
        }
        else {
            arr.push(store)
        }
    }

    closeRegisteredTransactions() {
        // Unsubscribe first, as we don't want to pick up any new events that
        // are caused by ending transactions.
        for (let i = 0; i < this.childrenAwaitingUnsubscribe.length; i++) {
            this.childrenAwaitingUnsubscribe[i].subscription!.unsubscribe()
        }
        this.childrenAwaitingUnsubscribe.length = 0

        let transactions = Array.from(this.externalTransactions.entries())
        for (let i = 0; i < transactions.length; i++) {
            let [transactionId, stores] = transactions[i]
            for (let j = 0; j < stores.length; j++) {
                stores[j].transactionEnd(transactionId)
            }
            stores.length = 0
        }
        this.externalTransactions.clear()
        this.childTransactions.clear()
    }

    handleFromChange = (fromValue: FromValue) => {
        this.from.value = fromValue

        if (this.impl.store && !this.impl.isReceivingProps) {
            this.impl.connect()
            this.impl.publish()
        }
    }

    handleFromTransactionStart = (transactionId: string) => {
        // Record that this transaction originated from the `from` element.
        // This allows us to keep track of whether we can unsubscribe, and
        // whether we need to emit events with this id to the `from` store.
        if (!this.externalTransactions.has(transactionId)) {
            this.childTransactions.add(transactionId)
        }

        this.impl.transactionStart(transactionId, undefined)
    }
}




// Use a custom Target class for parent components without the sanity checks.
// This cleans up a number of transactionStart/transactionEnd/next calls from
// stack traces, and also prevents significant unnecessary work.
export class FlatMapTarget<T> extends Target<T> {
    constructor(flatMap: FlatMap<any, any>) {
        super()
        
        this.next = flatMap.handleFromChange
        this.error = flatMap.impl.handleChildError
        this.complete = flatMap.impl.handleChildComplete
        this.transactionStart = flatMap.handleFromTransactionStart
        this.transactionEnd = flatMap.impl.transactionEnd
    }

    start(subscription: Subscription): void {}

    // These will be replaced in the constructor. Unfortuantely it still needs
    // to be provided to satisfy typescript's types.
    next(value: T, dispatch: (runner: () => void) => void): void {}
    error(err?: any): void {}
    complete(): void {}
    transactionStart(transactionId: string): void {}
    transactionEnd(transactionId: string): void {}
}