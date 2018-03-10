import { closedSubscription, Subscription } from './Subscription'
import { DispatcherEmitter } from './DispatcherEmitter'
import { StoreGovernor } from './StoreGovernor'


export class Dispatcher {
    isActing: boolean;
    isDispatching: boolean;
    isFlushing: boolean;

    mergedIntoParent: Dispatcher;

    emitterPriorities: Map<DispatcherEmitter, Set<string>>;

    priorityCounts: { [priority: string]: Map<DispatcherEmitter, number> };
    priorityQueue: string[];

    actionQueue: (() => void)[]
    reactionQueue: DispatcherEmitter[];
    flushQueue: Set<DispatcherEmitter>;
    postQueue: DispatcherEmitter[];

    inProgressReaction?: DispatcherEmitter;
    inProgressPost?: DispatcherEmitter;

    constructor() {
        this.priorityCounts = {}
        this.priorityQueue = []
        this.actionQueue = []
        this.reactionQueue = []
        this.flushQueue = new Set()
        this.postQueue = []
        this.emitterPriorities = new Map()
    }

    mergeChild(childDispatcher: Dispatcher) {
        // If this dispatcher isn't in the middle of a dispatch, our state
        // will be empty, so it is easier to merge the other way around.
        if (!this.isDispatching) {
            // As the dispatcher we're merging in to is mid-dispatch, it'll
            // close all merged emitters including our own, so let's start
            // a transaction in preparation.
            let emitters = Array.from(this.emitterPriorities.keys())
            for (let i = 0; i < emitters.length; i++) {
                emitters[i].startDispatch()
            }

            childDispatcher.mergeChild(this)
            return
        }

        // Mutatively set the child dispatcher's emitters' `dispatcher`
        // property to point to this dispatcher
        let childEmitters = Array.from(childDispatcher.emitterPriorities.keys())
        for (let i = 0; i < childEmitters.length; i++) {
            childEmitters[i].dispatcher = this
        }

        // Merge emitters and their subscribed priorities from the child
        // dispatcher
        let childEmitterPriorities = Array.from(childDispatcher.emitterPriorities.entries())
        for (let i = 0; i < childEmitterPriorities.length; i++) {
            let childEntry = childEmitterPriorities[i]
            this.emitterPriorities.set(childEntry[0], childEntry[1])
        }
        childDispatcher.emitterPriorities.clear()

        // Merge priority counts from child
        let childPriorities = Object.keys(childDispatcher.priorityCounts)
        for (let i = 0; i < childPriorities.length; i++) {
            let priority = childPriorities[i]
            let childCounts = childDispatcher.priorityCounts[priority]
            let ownCounts = this.priorityCounts[priority]
            if (ownCounts) {
                let childEmitters = Array.from(childCounts.entries())
                for (let j = 0; j < childEmitters.length; j++) {
                    let childEntry = childEmitters[j]
                    ownCounts.set(childEntry[0], childEntry[1])
                }
                childCounts.clear()
            }
            else {
                this.priorityCounts[priority] = childCounts
            }
            delete childDispatcher.priorityCounts[priority]
        }

        // Merge priority queue from child
        mergePriorityQueues(this.priorityQueue, childDispatcher.priorityQueue)
        childDispatcher.priorityQueue.length = 0

        // Merge other queues
        Array.prototype.push.apply(this.actionQueue, childDispatcher.actionQueue)
        childDispatcher.actionQueue.length = 0

        Array.prototype.push.apply(this.reactionQueue, childDispatcher.reactionQueue)
        childDispatcher.reactionQueue.length = 0

        Array.prototype.push.apply(this.postQueue, childDispatcher.postQueue)
        childDispatcher.postQueue.length = 0

        let childFlushQueue = Array.from(childDispatcher.flushQueue)
        for (let i = 0; i < childFlushQueue.length; i++) {
            this.flushQueue.add(childFlushQueue[i])
        }
        childDispatcher.flushQueue.clear()

        // Mark the child dispatcher as no longer in use
        childDispatcher.mergedIntoParent = this
        childDispatcher.enqueueAction = this.enqueueAction
    }

    createEmitter<T>(governor: StoreGovernor<T>): DispatcherEmitter<T> {
        let emitter = new DispatcherEmitter<T>(this, governor)
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

    registerPublish(emitter: DispatcherEmitter, hasNoListeners: boolean) {
        // If we're publishing on an emitter with flush-targets, make sure
        // that a flush is scheduled for that priority.
        let priorities = Array.from(this.emitterPriorities.get(emitter) || [])

        if (!this.isDispatching) {
            throw new Error(`A source cannot publish a value outside of a dispatch.`)
        }

        // Allow publishing of initial values, as they have no listeners.
        if (this.isFlushing && (!hasNoListeners || priorities.length !== 0)) {
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
        
        mergePriorityQueues(this.priorityQueue, priorities)
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
        if (this.mergedIntoParent) {
            throw new Error(`You cannot enqueue an action on a dispatcher that has been merged.`)
        }

        this.actionQueue.push(action)
        
        if (!this.isDispatching) {
            this.dispatch()
        }
    }

    protected dispatch() {
        if (this.isDispatching) {
            throw new Error(`Cannot start a dispatch while already dispatching.`)
        }

        this.isDispatching = true

        // Notify subscribers of start of dispatch
        let emitters = Array.from(this.emitterPriorities.keys())
        for (let i = 0; i < emitters.length; i++) {
            emitters[i].startDispatch()
        }

        this.processActionQueue()
        
        let priority: string
        this.priorityQueue = Object.keys(this.priorityCounts).sort()
        let allowableFlushLoops = this.flushQueue.size + 10
        while (this.flushQueue.size > 0) {
            if (--allowableFlushLoops < 0) {
                debugger

                if (allowableFlushLoops < -5) {
                    throw new Error('Too many flush loops')
                }
            }

            let allowablePriorityLoops = this.priorityQueue.length + 10
            while (priority = this.priorityQueue.shift()!) {
                if (--allowablePriorityLoops < 0) {
                    throw new Error('Too many priority loops')
                }

                // Create a list of flushes ahead of time, in case any of the
                // flushes results in this dispatcher being merged into a
                // parent.
                let emitters = Array.from(this.priorityCounts[priority].keys())
                let emittersToFlush = [] as DispatcherEmitter[]
                for (let i = 0; i < emitters.length; i++) {
                    let emitter = emitters[i]
                    if (this.flushQueue.delete(emitter)) {
                        emittersToFlush.push(emitter)
                    }
                }

                // Flush all targets with this priority.
                this.isFlushing = true
                for (let i = 0; i < emittersToFlush.length; i++) {
                    emittersToFlush[i].flush(priority)
                }
                this.isFlushing = false

                // If the flush has caused any actions to be queued, process them
                // before continuing to the next flush priority.
                this.processActionQueue()
            }

            this.processPostQueue()
        }

        // If this dispatcher has been merged into a parent, then the parent
        // dispatcher will take care of emitting endDispatch.
        if (!this.mergedIntoParent) {
            for (let i = 0; i < emitters.length; i++) {
                emitters[i].endDispatch()
            }
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
        if (this.inProgressReaction === emitter) {
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
            this.inProgressReaction = emitter
            this.isActing = true
            if (emitter.governor.performReaction()) {
                this.reactionQueue.shift()
                delete this.inProgressReaction
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
        if (this.inProgressPost === emitter) {
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
            this.inProgressPost = emitter
            this.isActing = true
            if (emitter.governor.performPost()) {
                this.postQueue.shift()
                delete this.inProgressPost
            }
            this.isActing = false
        }
        
        this.processReactionQueue()
    }
}

function mergePriorityQueues(target: string[], source: string[]) {
    let changed = false
    for (let i = 0; i < source.length; i++) {
        let priority = source[i]
        let queueIndex = target.indexOf(priority)
        if (queueIndex === -1) {
            target.push(priority)
            changed = true
        }
    }
    if (changed) {
        target.sort()
    }
}