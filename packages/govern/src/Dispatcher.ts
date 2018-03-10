import { closedSubscription, Subscription } from './Subscription'
import { DispatcherEmitter } from './DispatcherEmitter'
import { StoreGovernor } from './StoreGovernor'


export class Dispatcher {
    isActing: boolean;
    isDispatching: boolean;
    isFlushing: boolean;

    emitterPriorities: Map<DispatcherEmitter, Set<string>>;

    priorityCounts: { [priority: string]: Map<DispatcherEmitter, number> };
    priorityQueue: string[];

    actionQueue: (() => void)[]
    reactionQueue: DispatcherEmitter[];
    flushQueue: Set<DispatcherEmitter>;
    postQueue: DispatcherEmitter[];

    inProgressReactions: Set<DispatcherEmitter>;
    inProgressPosts: Set<DispatcherEmitter>;

    constructor() {
        this.priorityCounts = {}
        this.priorityQueue = []
        this.actionQueue = []
        this.reactionQueue = []
        this.flushQueue = new Set()
        this.postQueue = []
        this.emitterPriorities = new Map()
        this.inProgressReactions = new Set()
        this.inProgressPosts = new Set()
    }

    createEmitter<T>(governor: StoreGovernor<T>, initialValue: T): DispatcherEmitter<T> {
        let emitter = new DispatcherEmitter<T>(this, governor, initialValue)
        this.emitterPriorities.set(emitter, new Set())
        return emitter
    }

    disposeEmitter(emitter: DispatcherEmitter) {
        if (!this.isActing) {
            throw new Error(`A source may only be disposed from within an action.`)
        }

        this.emitterPriorities.delete(emitter)
        this.flushQueue.delete(emitter)
    }

    registerPublish(emitter: DispatcherEmitter) {
        if (!this.isDispatching) {
            throw new Error(`A source cannot publish a value outside of a dispatch.`)
        }
        if (this.isFlushing) {
            throw new Error(`A source cannot publish a value during a flush.`)
        }

        this.reactionQueue.push(emitter)
        if (this.emitterPriorities.get(emitter)!.size > 0) {
            this.flushQueue.add(emitter)
        }
        if (this.postQueue.indexOf(emitter) === -1) {
            // For post, we want to work backwords from the deepest component
            // to the highest. As we probably added them in the opposite
            // direction, we'll unshift instead of push.
            this.postQueue.unshift(emitter)
        }
        
        // If we're publishing on an emitter with flush-targets, make sure
        // that a flush is scheduled for that priority.
        let priorities = Array.from(this.emitterPriorities.get(emitter) || [])
        let changed = false
        for (let i = 0; i < priorities.length; i++) {
            let priority = priorities[i]
            let queueIndex = this.priorityQueue.indexOf(priority)
            if (queueIndex === -1) {
                this.priorityQueue.push(priority)
                changed = true
            }
        }
        if (changed) {
            this.priorityQueue.sort()
        }
    }

    registerPriority(emitter: DispatcherEmitter, priority: string = "0") {
        let emitterCounts = this.priorityCounts[priority]
        if (!emitterCounts) {
            this.priorityCounts[priority] = new Map([[emitter, 1]])
        }
        else {
            let emitterCount = emitterCounts.get(emitter) || 0
            emitterCounts.set(emitter, emitterCount + 1)
        }

        this.emitterPriorities.get(emitter)!.add(priority)
    }

    // Occurs when a <Subscribe> is unmounted, or when a `.subscribe` is
    // unsubscribed.
    //
    // Can occur within a flush, or outside of a dispatch.
    //
    // If it occurs during a flush and causes the emitter's priority count
    // to drop to zero, we'll need to cancel the emitter's pending flushes.
    deregisterPriority(emitter: DispatcherEmitter, priority: string = "0") {
        let emitterCounts = this.priorityCounts[priority]
        let emitterCount = emitterCounts.get(emitter)
        if (emitterCount === 1) {
            emitterCounts.delete(emitter)
            if (emitterCounts.size === 0) {
                delete this.priorityCounts[priority]

                let priorityIndex = this.priorityQueue.indexOf(priority)
                if (priorityIndex !== -1) {
                    this.priorityQueue.splice(priorityIndex, 1)
                }
            }

            let emitterPriorities = this.emitterPriorities.get(emitter)!
            emitterPriorities.delete(priority)
            if (emitterPriorities.size === 0) {
                this.flushQueue.delete(emitter)
            }
        }
        else if (emitterCount) {
            emitterCounts.set(emitter, emitterCount - 1)
        }
    }

    enqueueAction = (action: () => void) => {
        this.actionQueue.push(action)
        
        if (!this.isDispatching) {
            this.dispatch()
        }
    }

    dispatch() {
        if (this.isDispatching) {
            throw new Error(`Cannot start a dispatch while already dispatching.`)
        }

        this.isDispatching = true

        // Notify subscribers of start of dispatch
        let emitters = Array.from(this.emitterPriorities.keys())
        for (let i = 0; i < emitters.length; i++) {
            emitters[i].transactionStart()
        }

        this.processActionQueue()

        let priority: string
        this.priorityQueue = Object.keys(this.priorityCounts).sort()
        while (this.flushQueue.size > 0) {
            while (priority = this.priorityQueue.shift()!) {
                // Flush all targets with this priority.
                this.isFlushing = true
                let emitters = Array.from(this.priorityCounts[priority].keys())
                for (let i = 0; i < emitters.length; i++) {
                    let emitter = emitters[i]
                    if (this.flushQueue.delete(emitter)) {
                        emitter.flush(priority)
                    }
                }
                this.isFlushing = false

                // If the flush has caused any actions to be queued, process them
                // before continuing to the next flush priority.
                this.processActionQueue()
            }

            // Just in case
            this.flushQueue.clear()

            this.processPostQueue()
        }

        // TODO: don't call this if this dispacher has been merged into another
        for (let i = 0; i < emitters.length; i++) {
            emitters[i].transactionEnd()
        }
        this.isDispatching = false
    }

    processActionQueue() {
        let action: () => void
        while (action = this.actionQueue.shift()!) {
            this.isActing = true
            action()
            this.isActing = false
            this.processReactionQueue()
        }
    }

    /**
     * If the given store is enqueued to have its reactions processed, and
     * it isn't already present, move it to the front of the queue and return
     * true. Otherwise return false.
     */
    moveReactionToFront(emitter: DispatcherEmitter): boolean {
        if (this.inProgressReactions.has(emitter)) {
            let index = this.reactionQueue.indexOf(emitter)
            if (index !== -1) {
                this.reactionQueue.splice(index, 1)
                this.reactionQueue.unshift(emitter)
                return true
            }
        }
        return false
    }

    processReactionQueue() {
        // Process this queue, going from the last flushed to first flushed.
        let emitter: DispatcherEmitter
        while (this.reactionQueue.length) {
            emitter = this.reactionQueue[0]
            this.inProgressReactions.add(emitter)
            this.isActing = true
            if (emitter.governor.performReaction()) {
                this.reactionQueue.shift()
                this.inProgressReactions.delete(emitter)
            }
            this.isActing = false
        }
    }

    /**
     * If the given store is enqueued to have its reactions processed, and
     * it isn't already present, move it to the front of the queue and return
     * true. Otherwise return false.
     */
    movePostToFront(emitter: DispatcherEmitter): boolean {
        if (this.inProgressPosts.has(emitter)) {
            let index = this.postQueue.indexOf(emitter)
            if (index !== -1) {
                this.postQueue.splice(index, 1)
                this.postQueue.unshift(emitter)
                return true
            }
        }
        return false
    }

    processPostQueue() {
        let emitter: DispatcherEmitter
        while (this.postQueue.length) {
            emitter = this.postQueue[0]
            this.inProgressPosts.add(emitter)
            this.isActing = true
            if (emitter.governor.performPost()) {
                this.postQueue.shift()
                this.inProgressPosts.delete(emitter)
            }
            this.isActing = false
        }
        
        this.processReactionQueue()
    }
}
