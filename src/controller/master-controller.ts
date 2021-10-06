/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import {
    Action,
    ActionState,
    ActionStatus,
    AgvId,
    AgvIdMap,
    BlockingType,
    ClientOptions,
    Edge,
    Error,
    ErrorType,
    Headerless,
    InstantActions,
    MasterControlClient,
    Node,
    Optional,
    Order,
    State,
    Topic,
} from "..";

/**
 * Represents context information of an order event.
 * 
 * @category Master Controller
 */
export interface OrderContext {

    /**
     * The assigned order.
     */
    readonly order: Order;

    /**
     * Identifies the AGV this state originates from.
     */
    readonly agvId: AgvId;

    /**
     * The associated raw State object as published by the AGV.
     */
    readonly state: State;
}

/** 
 * A subset of `State` properties for which changes are reported while an edge
 * is being traversed (used by callback `OrderEventHandler.edgeTraversing`).
 */
export type EdgeStateChanges = Partial<Pick<State,
    "distanceSinceLastNode" |
    "driving" |
    "newBaseRequest" |
    "operatingMode" |
    "paused" |
    "safetyState">>;

/**
 * Defines distinct callback functions invoked by the master controller whenever
 * the state of an assigned order changes.
 * 
 * @category Master Controller
 */
export interface OrderEventHandler {

    /**
     * Invoked once when the assigned order has been processed successfully,
     * canceled successfully (by instant action "cancelOrder"), or rejected with
     * an error in the first place because the order is not executable by the
     * AGV.
     *
     * @remarks An order is processed if all the order's base nodes/edges have
     * been traversed and all base node/edge actions have been finished or
     * failed. Yet, the order may still be active if it contains horizon
     * nodes/edges. In such a case, you can then assign an order update or
     * cancel the order.
     *
     * @remarks After this callback has been invoked, no more callbacks related
     * to the assigned order are invoked afterwards. Events on a subsequent
     * order update are emitted on the event handlers of the newly assigned
     * order update.
     *
     * @param withError an Error object if order has been rejected in the first
     * place because it is not executable; otherwise `undefined`
     * @param byCancelation `true` if executing order has been canceled before
     * this callback is invoked; otherwise `false`
     * @param active `true` if order is still active after processing, otherwise
     * `false`
     * @param context context information of the order event
     */
    onOrderProcessed(withError: Error, byCancelation: boolean, active: boolean, context: OrderContext): void;

    /**
     * Invoked whenever an order's node has been traversed (optional).
     *
     * An order (base) node is traversed when the AGV has reached the node's
     * target position and the node's actions are being triggered.
     *
     * @remarks This callback is only triggered for base nodes, not for horizon
     * nodes.
     *
     * @param node the target node
     * @param nextEdge the released or unreleased edge following the traversed
     * node or `undefined` if no such edge exists.
     * @param nextNode the released or unreleased end node of the edge following
     * the traversed node or `undefined` if no such node exists.
     * @param context context information of the order event
     */
    onNodeTraversed?(node: Node, nextEdge: Edge, nextNode: Node, context: OrderContext): void;

    /**
     * Invoked to report changes in certain State properties while an order's
     * edge is being traversed (optional).
     *
     * Changes are being reported for the following State properties:
     * - `distanceSinceLastNode`
     * - `driving`
     * - `newBaseRequest`
     * - `operatingMode`
     * - `paused`
     * - `safetyState`
     *
     * Note that only the delta changes are reported relative to the previous
     * edgeTraversing event. On the first event, the current values of all State
     * properties as defined above are reported.
     *
     * @param edge the traversing edge
     * @param startNode the start node of the traversing edge
     * @param endNode the end node of the traversing edge
     * @param stateChanges edge-related State properties that have changed
     * @param invocationCount the number of invocations of this callback for the
     * current traversing edge (starts with 1 for the first invocation)
     * @param context context information of the order event
     */
    onEdgeTraversing?(
        edge: Edge,
        startNode: Node,
        endNode: Node,
        stateChanges: EdgeStateChanges,
        invocationCount: number,
        context: OrderContext): void;

    /**
     * Invoked whenever an order's edge has been traversed (optional).
     *
     * An order (base) edge is traversed when the AGV has reached the edge's end
     * node target position and all the edge's active actions are being
     * terminated.
     *
     * @remarks This callback is only triggered for base edges, not for horizon
     * edges.
     *
     * @param edge the traversed edge
     * @param startNode the start node of the traversed edge
     * @param endNode the end node of the traversed edge
     * @param context context information of the order event
     */
    onEdgeTraversed?(edge: Edge, startNode: Node, endNode: Node, context: OrderContext): void;

    /**
     * Invoked whenever an order's node or edge action state has changed
     * (optional).
     *
     * @remarks If action state changes to FAILED, an accompanying error object
     * may be reported by the AGV. However, if an order is rejected because an
     * order action is not executable in the first place, this error is reported
     * by the `onOrderProcessed` callback.
     *
     * @remarks To check whether the action is on a node or on an edge and to
     * use the `target` parameter in a type-safe way, discriminate by `("nodeId"
     * in target)` or `("edgeId" in target)`, respectively.
     *
     * @param actionState the new action state
     * @param withError an Error object in case a failed action reports an
     * error; otherwise undefined
     * @param action the related action
     * @param target the node or edge related to the action
     * @param context context information of the order event
     */
    onActionStateChanged?(actionState: ActionState, withError: Error, action: Action, target: Node | Edge, context: OrderContext): void;
}

/**
 * Defines distinct callback functions invoked by the master controller whenever
 * the state of an initiated instant action changes.
 * 
 * @category Master Controller
 */
export interface InstantActionEventHandler {

    /**
     * Invoked whenever an instant action state has changed.
     *
     * If action state changes to FAILED, an accompanying error object may be
     * reported by the AGV.
     *
     * @param actionState the new action state
     * @param withError an Error object in case a failed action reports an
     * error; otherwise undefined
     * @param action the related instant action
     * @param agvId identifies the AGV this state change originates from
     * @param state the associated raw State object as published by the AGV
     */
    onActionStateChanged(actionState: ActionState, withError: Error, action: Action, agvId: AgvId, state: State): void;

    /**
     * Invoked whenever an error is reported for an instant action that is
     * rejected because it cannot be executed by the AGV in the first place.
     *
     * @remarks If the action starts executing and eventually fails with an
     * error, such an error is reported by the handler `onActionStateChanged`.
     *
     * @param error the Error object
     * @param action the related instant action
     * @param agvId identifies the AGV this error originates from
     * @param state the associated raw State object as published by the AGV
     */
    onActionError(error: Error, action: Action, agvId: AgvId, state: State): void;
}

/**
 * Defines configuration options of a master controller.
 * 
 * @category Master Controller
 */
export interface MasterControllerOptions {

    /**
     * Identity of the AGV(s) which should be controlled by this master
     * controller (optional).
     *
     * If not specified, the value defaults to `{}`, i.e. to all AGVs within the
     * common communication namespace as defined by
     * `ClientOptions.interfaceName`.
     */
    targetAgvs?: Partial<AgvId>;
}

/**
 * Implements the common control logic and interaction flows on the coordination
 * plane (master control) as defined by the VDA 5050 specification. This
 * includes assigning orders and initiating instant actions, as well as
 * reporting back their execution state.
 *
 * Together with its counterpart on the vehicle plane, it builds a high-level
 * abstraction layer of the complex control logic defined in the VDA 5050
 * specification.
 *
 * @remarks This VDA 5050 implementation requires Node, Edge, and Action objects
 * to specify unique IDs. You should always use the `createUuid` function to
 * create such an ID as it generates globally unique IDs.
 *
 * @remarks This VDA 5050 implementation requires order rejection errors related
 * to non-supported or non-executable node or edge actions to report an error
 * with `errorType: "orderError"`, whereas order action errors reported for
 * failed actions must specify a different error type (e.g. `errorType:
 * "orderActionError"`) to make them distinguishable.
 *
 * @category Master Controller
 */
export class MasterController extends MasterControlClient {

    // Order state caches mapped by agvId, orderId, orderUpdateId.
    private readonly _currentOrders: AgvIdMap<Map<string, Map<number, OrderStateCache>>> = new AgvIdMap();
    private _lastAssignedOrderCache: OrderStateCache;

    // Instant action state caches mapped by agvId, actionId.
    private readonly _currentInstantActions: AgvIdMap<Map<string, InstantActionStateCache>> = new AgvIdMap();

    // Managing instant actions validation errors.
    private _currentInstantActionsRef: number;
    private _currentInstantActionsValidationErrors: Array<[number, Error]> = [];

    private readonly _controllerOptions: Required<MasterControllerOptions>;

    /**
     * Creates an instance of `MasterController`, a subclass of
     * `MasterControlClient`.
     *
     * @param clientOptions configuration options for the `MasterControlClient`
     * @param controllerOptions configuration options for the `MasterController`
     */
    constructor(clientOptions: ClientOptions, controllerOptions: MasterControllerOptions) {
        super(clientOptions);
        this._controllerOptions = this._controllerOptionsWithDefaults(controllerOptions);
    }

    /**
     * Gets the master controller configuration options as a readonly object
     * with default values filled in for options not specified.
     */
    get controllerOptions(): Readonly<Required<MasterControllerOptions>> {
        return this._controllerOptions;
    }

    /**
     * Assign an order (including an order update or a stitching order) to be
     * executed by an AGV and report back changes in the order's execution
     * state.
     *
     * An assigned order must fulfil the following characteristics to be
     * executable by an AGV:
     * - New order: Previously assigned order (if any) has terminated and new
     *   order has different orderId.
     * - Order update: Previously assigned order has terminated and order update
     *   has same orderId, a greater orderUpdateId, and a first base node
     *   matching lastNodeId/lastNodeSequenceId of current State followed by
     *   other base/horizon nodes.
     * - Stitching order: Previously assigned order has not yet terminated and
     *   the stitching order extends the base of it thereby specifying either a
     *   new orderId or reusing the previous orderId with a greater
     *   orderUpdateId.
     *
     * @remarks If a stitching order is assigned, the event handler callbacks of
     * the previously assigned order are no longer invoked. Instead, any
     * order-related events are emitted on the callbacks of the newly assigned
     * stitching order.
     *
     * @remarks Any order that has the same AGV target and the same orderId and
     * orderUpdateId as a currently active order will be discarded, resolving
     * `undefined`. The given event handler callbacks will never be invoked.
     * Instead, the previously registered callbacks continue to be invoked.
     *
     * @remarks All Node, Edge, Action, and Order objects passed to order event
     * handler callbacks are guaranteed to be reference equal to the original
     * objects passed to this method. However, AgvId objects passed are never
     * reference equal, but value equal.
     *
     * @param agvId identifies the target AGV
     * @param order the headerless order to be executed
     * @param eventHandler callbacks that report order-related events
     * @returns a promise that resolves the order object with header when
     * published successfully or `undefined` when order has been discarded, and
     * rejects if order is not valid or controller has not been started
     */
    async assignOrder(agvId: AgvId, order: Headerless<Order>, eventHandler: OrderEventHandler) {
        this.debug("Assigning order %o to AGV %o", order, agvId);
        const cache = this._getOrderStateCache(agvId, order.orderId, order.orderUpdateId);
        if (cache !== undefined) {
            this.debug("Discarded order %o for agvId %o", order, agvId);
            return undefined;
        }
        const orderWithHeader = await this.publish(Topic.Order, agvId, order);
        if (this._lastAssignedOrderCache) {
            this._removeOrderStateCache(this._lastAssignedOrderCache);
        }
        this._lastAssignedOrderCache = this._addOrderStateCache({ agvId, order: orderWithHeader, eventHandler });
        this.debug("Assigned order with header %o to agvId %o", orderWithHeader, agvId);
        return orderWithHeader;
    }

    /**
     * Initiate instant actions to be executed by an AGV and report back changes
     * in the actions' execution state.
     *
     * @remarks All Action and AgvId objects passed to instant action event
     * handler callbacks are guaranteed to be reference equal to the original
     * objects passed to this method.
     *
     * @param agvId identifies the target AGV
     * @param instantActions a headerless instant actions object
     * @param eventHandler callback that reports instant action related events
     * @returns a promise that resolves the instant actions object with header
     * when published successfully and rejects if instant actions object is not
     * valid or controller has not been started
     */
    async initiateInstantActions(
        agvId: AgvId,
        instantActions: Headerless<InstantActions>,
        eventHandler: InstantActionEventHandler) {
        this.debug("Initiating instant actions %o on AGV %o", instantActions, agvId);
        const actionsWithHeader = await this.publish(Topic.InstantActions, agvId, instantActions);
        let actionStateCaches = this._currentInstantActions.get(agvId);
        if (!actionStateCaches) {
            this._currentInstantActions.set(agvId, actionStateCaches = new Map());
        }
        if (this._currentInstantActionsRef === undefined) {
            this._currentInstantActionsRef = 1;
        } else {
            this._currentInstantActionsRef++;
        }
        actionsWithHeader.instantActions.forEach(action => actionStateCaches.set(action.actionId,
            { agvId, action, eventHandler, instantActionsRef: this._currentInstantActionsRef }));
        this.debug("Initiated instant actions %o on AGV %o", actionsWithHeader, agvId);
        return actionsWithHeader;
    }

    /**
     * Whenever master controller starts up it subscribes to State topics of the
     * target AGVs configured in controller options.
     */
    protected async onStarted() {
        await super.onStarted();
        await this.subscribe(Topic.State, this.controllerOptions.targetAgvs, (state, agvId) => this._dispatchState(state, agvId));
    }

    private _controllerOptionsWithDefaults(options: MasterControllerOptions): Required<MasterControllerOptions> {
        const optionalDefaults: Required<Optional<MasterControllerOptions>> = {
            targetAgvs: {},
        };
        return Object.assign(optionalDefaults, options);
    }

    private _dispatchState(state: State, agvId: AgvId) {
        // First, check if an assigned order has been rejected with an error in the
        // first place. Note that in this case, the order is not executed and
        // state.orderId still refers to the previous order (if any). We have to
        // scan all state errors for error type and references that match an
        // assigned order.
        for (const error of state.errors) {
            let topic: string;
            let orderId: string;
            let orderUpdateId: number;
            let hasActionIdRef = false;
            let cache: OrderStateCache;
            for (const errorRef of error.errorReferences) {
                if (errorRef.referenceKey === "actionId") {
                    hasActionIdRef = true;
                }
                if (errorRef.referenceKey === "topic") {
                    topic = errorRef.referenceValue;
                }
                if (errorRef.referenceKey === "orderId") {
                    orderId = errorRef.referenceValue;
                }
                if (errorRef.referenceKey === "orderUpdateId") {
                    orderUpdateId = parseInt(errorRef.referenceValue, 10);
                }
            }
            if (topic !== undefined && topic !== Topic.Order) {
                continue;
            }
            if (hasActionIdRef && error.errorType !== ErrorType.Order) {
                // Error is an order-related action error caused by a failed
                // action (with ErrorType.OrderAction).
                continue;
            }
            if (orderId !== undefined) {
                if (orderUpdateId !== undefined) {
                    cache = this._getOrderStateCache(agvId, orderId, orderUpdateId);
                } else {
                    cache = this._getLastOrderStateCache(agvId, orderId);
                }
            } else if (topic === Topic.Order && error.errorType === ErrorType.OrderValidation) {
                // We must check topic reference to distinguish between order and
                // instant action validation errors as both have the same value. If
                // no reference on orderId is given, assume the error refers to the
                // lastest assigned order for the given agvId.
                cache = this._getLastOrderStateCache(agvId);
            }
            if (cache !== undefined) {
                // Clear cache entry to support follow-up assignment of an order with
                // same orderId and orderUpdateId.
                this._removeOrderStateCache(cache);
                this._lastAssignedOrderCache = undefined;
                this.debug("onOrderProcessed with error %o for cache %o with state %j", error, cache, state);
                cache.eventHandler.onOrderProcessed(error, false, false, { order: cache.order, agvId, state });
            }
        }

        // Then, try to dispatch active order/action state and errors. Do it before
        // dispatching instant action states so that instant action state related to
        // this order is still present (cp. cancelOrder).
        const orderStateCache = this._getOrderStateCache(agvId, state.orderId, state.orderUpdateId);
        if (orderStateCache && !orderStateCache.orderProcessed) {
            this._dispatchOrderState(state, orderStateCache);
        }

        // Finally, try to dispatch instant action states and errors.
        this._updateInstantActionsValidationError(state.errors);
        const actionStateCaches = this._currentInstantActions.get(agvId);
        if (actionStateCaches) {
            for (const [actionId, actionStateCache] of actionStateCaches) {
                const actionState = state.actionStates.find(s => s.actionId === actionId);
                if (actionState) {
                    this._dispatchInstantActionState(actionState, actionStateCache, state);
                } else {
                    // Try to find a rejection error for a single instant action with given actionId.
                    const actionError = this._getActionError(state.errors, actionId, true);
                    if (actionError) {
                        this._dispatchInstantActionError(actionError, actionStateCache, state);
                    } else {
                        // If the associated initiated instant actions message has been rejected
                        // with an error because validation failed (i.e. no actionId given in error
                        // references), dispatch this error to all contained actions.
                        const validationError = this._getInstantActionsValidationError(actionStateCache.instantActionsRef);
                        if (validationError) {
                            this._dispatchInstantActionError(validationError, actionStateCache, state);
                        }
                    }
                }
            }
        }
    }

    /* Order processing */

    private _dispatchOrderState(state: State, cache: OrderStateCache) {
        this.debug("Dispatching order state for cache %o with state %j", cache, state);

        // Check if any node or edge action has changed its action status. Note that
        // order actions change state asynchronously, not necessarily in sync with
        // the onNodeTraversed/onEdgeTraversing/onEdgeTraversed callbacks.
        for (const actionState of state.actionStates) {
            const { actionId, actionStatus } = actionState;
            const actionTarget = cache.mappedActions.get(actionId);
            if (actionTarget) {
                const [action, target] = actionTarget;
                const lastActionState = cache.lastActionStates.get(actionId);
                if (lastActionState?.actionStatus !== actionStatus) {
                    cache.lastActionStates.set(actionId, actionState);

                    // @todo We assume that a failed action reports an associated error in the same
                    // State message. Otherwise, cleaning up the cache has to be postponed until the
                    // next State message is received (using a postponeCleanup flag).
                    const error = actionStatus === ActionStatus.Failed ? this._getActionError(state.errors, actionId, false) : undefined;
                    if (error) {
                        this.debug("onActionStateChanged %o with error %o for action %s on target %o for cache %o with state %j",
                            actionState, error, action, target, cache, state);
                    } else {
                        this.debug("onActionStateChanged %o for action %s on target %o for cache %o with state %j",
                            actionState, action, target, cache, state);
                    }
                    if (cache.eventHandler.onActionStateChanged) {
                        cache.eventHandler.onActionStateChanged(actionState, error, action, target,
                            { order: cache.order, agvId: cache.agvId, state });
                    }
                }
            }
        }

        // Check if trailing edge of last traversed node is being traversed or has been
        // traversed.
        if (cache.lastNodeTraversed) {
            const nextEdge = this._getNextReleasedEdge(cache.order, cache.lastNodeTraversed);
            if (nextEdge) {
                const startNode = this._getEdgeStartNode(cache.order, nextEdge);
                const endNode = this._getEdgeEndNode(cache.order, nextEdge);
                const edgeState = state.edgeStates.find(s => s.edgeId === nextEdge.edgeId && s.sequenceId === nextEdge.sequenceId);
                if (!edgeState) {
                    this._updateEdgeStateChanges(nextEdge, startNode, endNode, cache, state);
                    cache.lastEdgeStateChanges = undefined;
                    cache.edgeStateChangeInvocations = 0;

                    this.debug("onEdgeTraversed %o for cache %o with state %j", nextEdge, cache, state);
                    if (cache.eventHandler.onEdgeTraversed) {
                        cache.eventHandler.onEdgeTraversed(nextEdge, startNode, endNode, { order: cache.order, agvId: cache.agvId, state });
                    }
                } else {
                    // Start reporting edge state changes not until all node's blocking
                    // actions have ended so that the AGV can start driving on the edge.
                    if (cache.lastEdgeStateChanges !== undefined || this._areAllBlockingActionsEnded(cache.lastNodeTraversed, state)) {
                        this._updateEdgeStateChanges(nextEdge, startNode, endNode, cache, state);
                    }
                }
            }
        }

        // Check if next node has been traversed/reached. 
        let nextNode: Node;
        if (cache.lastNodeTraversed === undefined) {
            const firstNode = cache.order.nodes[0];
            if (!state.nodeStates.find(n => n.nodeId === firstNode.nodeId && n.sequenceId === firstNode.sequenceId)) {
                nextNode = firstNode;
            }
        } else {
            if (cache.lastNodeTraversed.nodeId !== state.lastNodeId || cache.lastNodeTraversed.sequenceId !== state.lastNodeSequenceId) {
                nextNode = this._getNode(cache.order, state.lastNodeId, state.lastNodeSequenceId);
            }
        }
        if (nextNode !== undefined) {
            cache.lastNodeTraversed = nextNode;
            const nextEdge = this._getNextEdge(cache.order, nextNode);
            const edgeEndNode = nextEdge ? this._getEdgeEndNode(cache.order, nextEdge) : undefined;
            this.debug("onNodeTraversed %o for cache %o with state %j", nextNode, cache, state);
            if (cache.eventHandler.onNodeTraversed) {
                cache.eventHandler.onNodeTraversed(nextNode, nextEdge, edgeEndNode, { order: cache.order, agvId: cache.agvId, state });
            }
        }

        // Check if order has been processed successfully or has been canceled
        // by instant action "cancelOrder".
        const result = this._isOrderProcessed(cache, state);
        if (result !== false) {
            const isActive = result === undefined;
            const byCancelation = this._isOrderCanceled(cache, state);
            // Keep cache to support discarding new orders with same orderId and orderUpdateId
            // but disable further lookup.
            cache.orderProcessed = true;
            if (byCancelation) {
                this.debug("onOrderProcessed by cancelation being active: %s for cache %o with state %j", isActive, cache, state);
            } else {
                this.debug("onOrderProcessed being active: %s for cache %o with state %j", isActive, cache, state);
            }
            cache.eventHandler.onOrderProcessed(undefined, byCancelation, isActive, { order: cache.order, agvId: cache.agvId, state });
            return;
        }
    }

    private _addOrderStateCache(cache: OrderStateCache) {
        let orderIds = this._currentOrders.get(cache.agvId);
        if (!orderIds) {
            orderIds = new Map();
            this._currentOrders.set(cache.agvId, orderIds);
        }
        let orderUpdateIds = orderIds.get(cache.order.orderId);
        if (!orderUpdateIds) {
            orderUpdateIds = new Map();
            orderIds.set(cache.order.orderId, orderUpdateIds);
        }
        this._initCachedActions(cache);
        orderUpdateIds.set(cache.order.orderUpdateId, cache);
        return cache;
    }

    private _removeOrderStateCache(cache: OrderStateCache) {
        const orderIds = this._currentOrders.get(cache.agvId);
        if (!orderIds) {
            return;
        }
        const orderUpdateIds = orderIds.get(cache.order.orderId);
        if (!orderUpdateIds) {
            return;
        }
        orderUpdateIds.delete(cache.order.orderUpdateId);
        if (orderUpdateIds.size === 0) {
            orderIds.delete(cache.order.orderId);
            if (orderIds.size === 0) {
                this._currentOrders.delete(cache.agvId);
            }
        }
    }

    private _getOrderStateCache(agvId: AgvId, orderId: string, orderUpdateId: number): OrderStateCache {
        const orderIds = this._currentOrders.get(agvId);
        if (!orderIds) {
            return undefined;
        }
        const orderUpdateIds = orderIds.get(orderId);
        if (!orderUpdateIds) {
            return undefined;
        }
        return orderUpdateIds.get(orderUpdateId);
    }

    private _getLastOrderStateCache(agvId: AgvId, orderId?: string): OrderStateCache {
        const orderIds = this._currentOrders.get(agvId);
        if (!orderIds) {
            return undefined;
        }
        if (!orderId) {
            let lastValue1: [string, Map<number, OrderStateCache>];
            // tslint:disable-next-line: no-empty
            for (lastValue1 of orderIds) { }
            if (!lastValue1) {
                return undefined;
            }
            let lastValue2: [number, OrderStateCache];
            // tslint:disable-next-line: no-empty
            for (lastValue2 of lastValue1[1]) { }
            return lastValue2?.[1];
        }
        const orderUpdateIds = orderIds.get(orderId);
        if (!orderUpdateIds) {
            return undefined;
        }
        let lastValue: [number, OrderStateCache];
        // tslint:disable-next-line: no-empty
        for (lastValue of orderUpdateIds) { }
        return lastValue?.[1];
    }

    private _initCachedActions(cache: OrderStateCache) {
        if (!cache.mappedActions) {
            cache.mappedActions = new Map();
            for (const node of cache.order.nodes) {
                if (!node.released) {
                    break;
                }
                for (const action of node.actions) {
                    cache.mappedActions.set(action.actionId, [action, node]);
                }
            }
            for (const edge of cache.order.edges) {
                if (!edge.released) {
                    break;
                }
                for (const action of edge.actions) {
                    cache.mappedActions.set(action.actionId, [action, edge]);
                }
            }
        }

        if (!cache.lastActionStates) {
            cache.lastActionStates = new Map();
        }
    }

    private _isOrderProcessed(cache: OrderStateCache, state: State): boolean | undefined {
        let isProcessed = false;
        if (state.nodeStates.length === 0 && state.edgeStates.length === 0) {
            // Order is processed and completed.
            isProcessed = true;
        } else if (state.nodeStates.every(s => !s.released) && state.edgeStates.every(s => !s.released)) {
            // Order is processed but still active.
            isProcessed = undefined;
        } else {
            return false;
        }
        for (const [, [action]] of cache.mappedActions) {
            const as = cache.lastActionStates.get(action.actionId);
            if (as === undefined || (as.actionStatus !== ActionStatus.Finished && as.actionStatus !== ActionStatus.Failed)) {
                return false;
            }
        }
        return isProcessed;
    }

    private _isOrderCanceled(cache: OrderStateCache, state: State) {
        // Note: Do not perform look up by ActionState.actionType directly as it is optional.
        const actionStateCaches = this._currentInstantActions.get(cache.agvId);
        if (actionStateCaches) {
            for (const [actionId, actionStateCache] of actionStateCaches) {
                if (actionStateCache.action.actionType === "cancelOrder") {
                    const as = state.actionStates.find(s => s.actionId === actionId);
                    return as !== undefined && as.actionStatus === ActionStatus.Finished;
                }
            }
        }
        return false;
    }

    private _getNode(order: Order, nodeId: string, sequenceId: number) {
        return order.nodes.find(n => n.nodeId === nodeId && n.sequenceId === sequenceId);
    }

    private _getNextEdge(order: Order, node: Node) {
        return order.edges.find(e => e.startNodeId === node.nodeId && e.sequenceId === node.sequenceId + 1);
    }

    private _getNextReleasedEdge(order: Order, node: Node) {
        return order.edges.find(e => e.released && e.startNodeId === node.nodeId && e.sequenceId === node.sequenceId + 1);
    }

    private _getEdgeStartNode(order: Order, edge: Edge) {
        return order.nodes.find(n => n.nodeId === edge.startNodeId && n.sequenceId === edge.sequenceId - 1);
    }

    private _getEdgeEndNode(order: Order, edge: Edge) {
        return order.nodes.find(n => n.nodeId === edge.endNodeId && n.sequenceId === edge.sequenceId + 1);
    }

    private _areAllBlockingActionsEnded(node: Node, state: State) {
        const isActionEnded = (action) => {
            const as = state.actionStates.find(s => s.actionId === action.actionId);
            return as !== undefined && (as.actionStatus === ActionStatus.Finished || as.actionStatus === ActionStatus.Failed);
        };
        return node.actions.every(a => a.blockingType === BlockingType.None || isActionEnded(a));
    }

    private _updateEdgeStateChanges(edge: Edge, startNode: Node, endNode: Node, cache: OrderStateCache, state: State) {
        const reportChanges = (changes: EdgeStateChanges) => {
            this.debug("onEdgeTraversing %o for cache %o with changes %o with state %j", edge, cache, changes, state);
            if (cache.eventHandler.onEdgeTraversing) {
                if (cache.edgeStateChangeInvocations === undefined) {
                    cache.edgeStateChangeInvocations = 0;
                }
                cache.edgeStateChangeInvocations++;
                cache.eventHandler.onEdgeTraversing(edge, startNode, endNode, changes, cache.edgeStateChangeInvocations,
                    { order: cache.order, agvId: cache.agvId, state });
            }
        };

        if (cache.lastEdgeStateChanges === undefined) {
            cache.lastEdgeStateChanges = {
                distanceSinceLastNode: state.distanceSinceLastNode,
                driving: state.driving,
                newBaseRequest: state.newBaseRequest,
                operatingMode: state.operatingMode,
                paused: state.paused,
                safetyState: state.safetyState,
            };
            reportChanges(cache.lastEdgeStateChanges);
            return;
        }

        const currentChanges = cache.lastEdgeStateChanges;
        const newDeltas: EdgeStateChanges = {};
        let hasChanges = false;
        if (currentChanges.distanceSinceLastNode !== state.distanceSinceLastNode) {
            currentChanges.distanceSinceLastNode = newDeltas.distanceSinceLastNode = state.distanceSinceLastNode;
            hasChanges = true;
        }
        if (currentChanges.driving !== state.driving) {
            currentChanges.driving = newDeltas.driving = state.driving;
            hasChanges = true;
        }
        if (currentChanges.newBaseRequest !== state.newBaseRequest) {
            currentChanges.newBaseRequest = newDeltas.newBaseRequest = state.newBaseRequest;
            hasChanges = true;
        }
        if (currentChanges.operatingMode !== state.operatingMode) {
            currentChanges.operatingMode = newDeltas.operatingMode = state.operatingMode;
            hasChanges = true;
        }
        if (currentChanges.paused !== state.paused) {
            currentChanges.paused = newDeltas.paused = state.paused;
            hasChanges = true;
        }
        if (currentChanges.safetyState.eStop !== state.safetyState.eStop ||
            currentChanges.safetyState.fieldViolation !== state.safetyState.fieldViolation) {
            currentChanges.safetyState = newDeltas.safetyState = state.safetyState;
            hasChanges = true;
        }

        if (hasChanges) {
            reportChanges(newDeltas);
        }
    }

    /* Instant action processing */

    private _dispatchInstantActionState(actionState: ActionState, cache: InstantActionStateCache, state: State) {
        this.debug("Dispatching instant action state %o for cache %o with state %j", actionState, cache, state);
        if (actionState.actionStatus !== cache.lastActionState?.actionStatus) {
            cache.lastActionState = actionState;
            if (actionState.actionStatus === ActionStatus.Finished || actionState.actionStatus === ActionStatus.Failed) {
                this._removeInstantActionStateCache(cache);
            }

            // @todo We assume that a failed action reports an associated error in the same
            // State message. Otherwise, cleaning up the cache has to be postponed until the
            // next State message is received (using a postponeCleanup flag).
            const error = actionState.actionStatus === ActionStatus.Failed ?
                this._getActionError(state.errors, cache.action.actionId, true) :
                undefined;
            this.debug("onActionStateChanged for instant action state %o with error %o for cache %o with state %j",
                actionState, error, cache, state);
            cache.eventHandler.onActionStateChanged(actionState, error, cache.action, cache.agvId, state);
        }
    }

    private _dispatchInstantActionError(actionError: Error, cache: InstantActionStateCache, state: State) {
        this._removeInstantActionStateCache(cache);
        this.debug("onActionError %o for instant action cache %o with state %j", actionError, cache, state);
        cache.eventHandler.onActionError(actionError, cache.action, cache.agvId, state);
    }

    private _removeInstantActionStateCache(cache: InstantActionStateCache) {
        const actionStateCaches = this._currentInstantActions.get(cache.agvId);
        actionStateCaches.delete(cache.action.actionId);
        if (actionStateCaches.size === 0) {
            this._currentInstantActions.delete(cache.agvId);
        }
    }

    private _getInstantActionsValidationError(instanceActionsRef: number) {
        const ref = this._currentInstantActionsValidationErrors.find(r => r[0] === instanceActionsRef);
        return ref ? ref[1] : undefined;
    }

    private _updateInstantActionsValidationError(errors: Error[]) {
        if (this._currentInstantActionsRef === undefined) {
            // Validation error cannot be associated with this master controller
            // as it has not yet issued any instant actions.
            return;
        }

        // Note: If multiple master controllers are concurrently issuing instant
        // actions on the same agvId, it cannot be determined uniquely which
        // controller issued the actions which caused a validation error. This
        // can cause validation errors to be erroneously reported to unaffected
        // controllers.
        const validationErrors = errors.filter(error =>
            // We must check topic reference to distinguish between order and instant action
            // validation errors as both have the same value.
            error.errorType === ErrorType.InstantActionValidation &&
            error.errorReferences.some(r => r.referenceKey === "topic" && r.referenceValue === Topic.InstantActions) &&
            !error.errorReferences.some(r => r.referenceKey === "orderId") &&
            !error.errorReferences.some(r => r.referenceKey === "actionId"));
        const delta = validationErrors.length - this._currentInstantActionsValidationErrors.length;
        if (delta > 0) {
            this._currentInstantActionsValidationErrors.push(
                ...validationErrors.slice(validationErrors.length - delta)
                    .map((e, i) => [this._currentInstantActionsRef - i, e] as [number, Error]));
        } else if (delta < 0) {
            this._currentInstantActionsValidationErrors.splice(0, -delta);
        }
    }

    private _getActionError(errors: Error[], actionId: string, asInstantAction: boolean) {
        return errors.find(e =>
            e.errorReferences.some(r => r.referenceKey === "actionId" && r.referenceValue === actionId) &&
            e.errorReferences.some(r => r.referenceKey === "topic" &&
                r.referenceValue === (asInstantAction ? Topic.InstantActions : Topic.Order)));
    }
}

interface OrderStateCache {
    readonly agvId: AgvId;
    readonly order: Order;
    readonly eventHandler: OrderEventHandler;

    lastNodeTraversed?: Node;
    lastEdgeStateChanges?: EdgeStateChanges;
    edgeStateChangeInvocations?: number;
    lastActionStates?: Map<string, ActionState>;
    mappedActions?: Map<string, [Action, Node | Edge]>;
    orderProcessed?: boolean;
}

interface InstantActionStateCache {
    readonly agvId: AgvId;
    readonly action: Action;
    readonly eventHandler: InstantActionEventHandler;

    instantActionsRef: number;
    lastActionState?: ActionState;
}
