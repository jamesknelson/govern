import { ComponentSubject } from './ComponentSubject'
import { ChildSubscription } from './ComponentImplementation'
import { Target } from './Target'

export class ComponentTransaction {
    awaitingEndCount: number
    hasPropagatedToChildren: boolean
    id: string
    level: number
    sourceTarget?: Target<any>
    
    protected childSubscriptions: ChildSubscription[]
    protected idLevels: { [name: string]: number }
    protected subject: ComponentSubject<any>
    protected originatedFromChild?: ChildSubscription
    protected wasOriginRemoved: boolean = false

    constructor(id: string, sourceTarget: Target<any> | undefined, originChildSubscription: ChildSubscription | undefined, childSubscriptions: ChildSubscription[], subject: ComponentSubject<any>) {
        this.awaitingEndCount = 1
        this.idLevels = { [id]: 1 }
        this.level = 1
        this.id = id
        this.childSubscriptions = childSubscriptions
        this.subject = subject
        this.sourceTarget = sourceTarget

        if (originChildSubscription) {
            this.originatedFromChild = originChildSubscription
            this.hasPropagatedToChildren = false
        }

        if (__DEV__) {
            setTimeout(() => {
                if (this.level !== 0) {
                    throw new Error('Govern Error: a transaction did not end within the same tick. Please file an issue.')
                }
            })
            setTimeout(() => {
                if (this.awaitingEndCount !== 0) {
                    throw new Error('Govern Error: a transaction did not complete successfully. Please file an issue.')
                }
            })
        }
    }

    enterTransaction() {
        if (!this.originatedFromChild) {
            this.propagateTransactionToChildren()
        }

        this.subject.transactionStart(this.id, this.sourceTarget)
    }

    addChildToCleanupList(childStore: ChildSubscription) {
        if (!this.hasPropagatedToChildren) {
            throw new Error('Govern Error: a child was added to cleanup list before transaction propagated to children')
        }

        this.childSubscriptions.push(childStore)
    }

    unsubscribeChildWhenReady(childStore: ChildSubscription) {
        if (childStore === this.originatedFromChild) {
            childStore.target.preventFurtherChangeEvents()
            this.wasOriginRemoved = true
        }
        else {
            childStore.target.unsubscribe()
        }
    }
    
    propagateTransactionToChildren() {
        if (!this.hasPropagatedToChildren) {
            this.hasPropagatedToChildren = true
            let children = this.childSubscriptions
            for (let i = 0; i < children.length; i++) {
                let child = children[i]
                child.store.transactionStart(this.id, child.target)
            }
        }
    }

    increaseTransactionLevel(id: string) {
        let idLevel = this.idLevels[id] || 0
        this.idLevels[id] = idLevel + 1
        this.level += 1
        this.awaitingEndCount += 1
        
        // Only parents can increase the transaction level above one; they do
        // so when they want to make changes in response to a transaction
        // initiated elsewhere.
        // 
        // As the parents increase the level in preparation for changes, we'll
        // need to increase the level on children too.
        if (!this.hasPropagatedToChildren) {
            this.propagateTransactionToChildren()
        }
    }

    decreaseTransactionLevel(id: string) {
        let level: number = this.idLevels[id]

        if (level === undefined) {
            throw new Error("Unknown transaction id")
        }

        // It is important to consider the transaction closed on the first
        // completion notification, otherwise we can get circular dependencies
        // that never close.
        //
        // We only keep track of thet total number of closes to emit an
        // error if it doesn't match up.
        
        this.awaitingEndCount -= 1

        if (level) {
            this.idLevels[id] = 0
            this.level -= level
        }

        if (this.level < 0) {
            throw new Error('Tried to lower transaction level below 0')
        }
    }

    leaveTransaction() {
        // The child which originated the transaction has been removed, but
        // we haven't unsubscribed yet, as we were waiting for it to end
        // the transaction. Now that the transaction has ended, we can
        // finish unsubscribing.
        if (this.wasOriginRemoved) {
            this.originatedFromChild!.target!.unsubscribe()
        }

        // End transaction internally before publishing transactionEnd, so
        // that any `transactionStart` calls caused by `transactionEnd`
        // will result in new transactions.
        if (this.hasPropagatedToChildren) {
            let children = this.childSubscriptions
            for (let i = 0; i < children.length; i++) {
                children[i].store.transactionEnd(this.id)
            }

        }

        this.subject.transactionEnd(this.id)

        this.childSubscriptions.length = 0
        delete this.sourceTarget
        delete this.originatedFromChild
    }
}