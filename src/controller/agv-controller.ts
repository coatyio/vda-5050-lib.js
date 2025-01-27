/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import {
    Action,
    ActionState,
    ActionStatus,
    AgvClient,
    AgvId,
    AgvPosition,
    BatteryState,
    BlockingType,
    ClientOptions,
    Edge,
    EdgeState,
    Error,
    ErrorLevel,
    ErrorReference,
    ErrorType,
    EStop,
    Factsheet,
    Headerless,
    InstantActions,
    isPlainObject,
    Node,
    NodeState,
    OperatingMode,
    Optional,
    Order,
    SafetyStatus,
    State,
    Topic,
    Trajectory,
    Velocity,
    Visualization,
} from "..";

/**
 * Represents context information needed to perform initializations on an AGV
 * adapter when it is attached.
 *
 * @category AGV Controller
 */
export interface AttachContext {

    /**
     * Callback to be invoked by the AGV adapter when initialization has
     * completed and the adapter is ready to process any of the other handler
     * functions defined in the `AgvAdapter` interface.
     *
     * @param initialState initial partial state to be reported on attachment
     */
    attached(initialState: Partial<Headerless<State>>): void;
}

/**
 * Represents context information needed to perform deinitializations on an AGV
 * adapter when it is detached.
 *
 * @category AGV Controller
 */
export interface DetachContext {

    /**
     * Callback to be invoked by the AGV adapter when deinitialization has
     * completed and the adapter has terminated its operations.
     *
     * @param detachState partial state to be reported on detachment
     */
    detached(detachState: Partial<Headerless<State>>): void;
}

/**
 * Represents change information about action status, including result
 * description, error description, and linked state (if applicable).
 *
 * @category AGV Controller
 */
export interface ActionStatusChangeInfo {

    /**
     * The changed action status.
     */
    readonly actionStatus: ActionStatus;

    /**
     * A result reported if action status is FINISHED (optional).
     */
    readonly resultDescription?: string;

    /**
     * An additional error state is reported with the given error description if action
     * fails and status is FAILED (optional).
     */
    readonly errorDescription?: string;

    /**
     * Specifies a partial state that must be updated together with the action
     * status change (optional).
     */
    readonly linkedState?: Partial<Headerless<State>>;
}

/**
 * Defines the scope of an action, either `"instant"`, `"node"`, or `"edge"`.
 *
 * @category AGV Controller
 */
export type ActionScope = "instant" | "node" | "edge";

/**
 * Represents context information of a node, edge, or instant action to be
 * processed by an `executeAction`, `finishEdgeAction`, or `cancelAction`
 * handler.
 *
 * @category AGV Controller
 */
export interface ActionContext {

    /**
     * The context's action.
     */
    readonly action: Action;

    /**
     * Defines whether the context's action is an instant, node, or edge action.
     */
    readonly scope: ActionScope;

    /**
     * Determines whether the AGV must stop driving before executing the action
     * (optional, only specified in the context of an `executeAction` handler).
     *
     * If specified as `true` driving must be stopped; if `false` the AGV must
     * keep its current driving state.
     *
     * @remarks This parameter is not specified for `finishEdgeAction`,
     * `isActionExecutable`, and `cancelAction` handlers.
     */
    readonly stopDriving?: boolean;

    /**
     * Specifies the node if the context's action is a node action; otherwise
     * this property is not defined.
     */
    readonly node?: Node;

    /**
     * Specifies the edge if the context's action is an edge action; otherwise
     * this property is not defined.
     */
    readonly edge?: Edge;

    /**
     * Specifies the start node of the edge if the context's action is an edge
     * action; otherwise this property is not defined.
     */
    readonly edgeStartNode?: Node;

    /**
     * Specifies the end node of the edge if the context's action is an edge
     * action; otherwise this property is not defined.
     */
    readonly edgeEndNode?: Node;

    /**
     * Specifies the `orderId` of an order's node or edge action; the active
     * `orderId` for instant actions if one is currently active; otherwise this
     * property is not defined.
     */
    readonly activeOrderId?: string;

    /**
     * Callback to be invoked by the AGV adapter whenever the action transitions
     * to a new action status.
     *
     * This method should be invoked according to the progress of the action,
     * passing in an updated action status together with the result description,
     * error description, and linked partial state (if applicable).
     *
     * @remarks
     * This parameter is not defined for the `isActionExecutable` handler.
     *
     * When the action transitions into status FAILED an additional error state
     * can be reported by specifying an error description.
     *
     * @param status new action status with optional result description, error
     * description, and linked state
     */
    updateActionStatus(statusChange: ActionStatusChangeInfo): void;
}

/**
 * Represents context information to check whether a route can be traversed by
 * the AGV.
 *
 * @category AGV Controller
 */
export interface RouteTraversableContext {

    /**
     * The nodes to be traversed.
     */
    readonly nodes: Node[];

    /**
     * The edges to be traversed.
     */
    readonly edges: Edge[];
}

/**
 * Represents context information of a `stopTraverse` operation handler.
 *
 * @category AGV Controller
 */
export interface StopTraverseContext {

    /**
     * Callback to be invoked once by the AGV adapter if, due to AGV's
     * capabilities, it couldn't stop immediately on the current node or in
     * between nodes but has to drive to the next node.
     *
     * After reaching the next node, the AGV must stop and the callback
     * `stopped` defined by this interface must be invoked.
     *
     * @remarks When invoked the parameter `nextNode` can be easily retrieved by
     * the AGV adapter from the edge context currently being traversed, as
     * defined by `TraverseContext.endNode`.
     */
    drivingToNextNode(nextNode: Node): void;

    /**
     * Callback to be invoked once by the AGV adapter when the AGV has stopped
     * driving in response to the invocation of the `stopTraverse`
     * operation handler.
     *
     * If the AGV has to drive to the next node upon order cancelation, this
     * handler must be invoked on arrival instead of the
     * `TraverseContext.edgeTraversed` handler.
     */
    stopped(): void;
}

/**
 * Represents context information of an edge traversal.
 *
 * @category AGV Controller
 */
export interface TraverseEdgeContext {

    /**
     * The edge to be traversed.
     */
    readonly edge: Edge;

    /**
     * The start node of the edge to be traversed.
     */
    readonly startNode: Node;

    /**
     * The end node of the edge to be traversed.
     */
    readonly endNode: Node;

    /**
     * Defines the edge trajectory path calculated by the AGV or master control
     * (optional).
     *
     * If not specified or `undefined`, the AGV cannot process trajectories or
     * calculates the route on the fly when the `traverse` handler is invoked.
     */
    readonly trajectory?: Trajectory;

    /**
     * Callback to be invoked once by the AGV adapter when the edge of this
     * context has been completely traversed.
     */
    edgeTraversed(): void;
}

/**
 * Represents context information of a trajectory, including its edge, and its
 * edge's start and end nodes.
 *
 * @category AGV Controller
 */
export interface TrajectoryContext {

    /**
     * The trajectory edge.
     */
    readonly edge: Edge;

    /**
     * The start node of the trajectory edge.
     */
    readonly startNode: Node;

    /**
     * The end node of the trajectory edge.
     */
    readonly endNode: Node;
}

/**
 * Defines a plug-in commanding interface for performing AGV specific operations
 * to be registered with an AGV controller.
 *
 * The adapter's functions provide an abstract interface that maps generic
 * operations to an AGV specific navigation and control interface. These
 * operations include executing or canceling a node action, an edge action, or
 * an instant action, traversing/navigating an edge, and calculating trajectory
 * paths.
 *
 * Concrete implementations of AGV adapters are usually provided by an
 * integrator or by the vendor designing the vehicle control interface.
 *
 * @remarks An AGV adapter and its logic is realized as a class that implements
 * this interface. This class must provide a constructor that conforms to the
 * interface `AgvAdapterConstructor`. Using dependeny injection, this class type
 * is passed as a configuration option to the AGV controller (see
 * `AgvControllerOptions.agvAdapterType`) which creates an instance of the
 * adapter class with appropriate constructor parameters.
 *
 * @category AGV Controller
 */
export interface AgvAdapter {

    /**
     * The AGV controller this adapter is associated with.
     *
     * Used to invoke state update methods defined by the AGV controller.
     */
    readonly controller: AgvController;

    /**
     * Defines the name of this adapter used for identification and display
     * purposes.
     */
    readonly name: string;

    /**
     * Defines the protocol version number of this adapter, a positive integer.
     *
     * Increment this version whenever you make changes to the adapter protocol.
     *
     * @remarks The API version of this adapter must match (i.e. equal) the API
     * version of the associated AGV controller. If both versions differ, an
     * error is thrown when the adapter is instantiated.
     */
    readonly apiVersion: number;

    /**
     * Registers a handler that is invoked once by the associated controller
     * when the adapter should perform initializations and connect to the AGV
     * navigation & control interface.
     *
     * The handler function should compute initial vehicles states and report
     * them back to the controller after initialization is complete through the
     * callback `AttachContext.attached`. Until this callback is invoked, the
     * controller won't invoke any of the other handler functions defined in
     * this interface.
     *
     * @param context context information for attachment
     */
    attach(context: AttachContext): void;

    /**
     * Registers a handler that is invoked once by the associated controller
     * when the adapter should perform deinitializations and disconnect from the
     * AGV navigation & control interface.
     *
     * The handler function may compute final vehicles states and report them
     * back to the controller after deinitialization is complete through the
     * callback `DetachContext.detached`. After this callback is invoked, the
     * controller won't invoke any of the other handler functions defined in
     * this interface.
     *
     * @param context context information for detachment
     */
    detach(context: DetachContext): void;

    /**
     * Registers a handler that is invoked by the associated controller to check
     * synchronously whether a given node, edge, or instant action can be
     * executed principally.
     *
     * The handler function should return a non-empty array of error references
     * if the action cannot be executed and must be rejected. For example, if an
     * action cannot be completed because of external factors (e.g. no load at
     * expected position), or if an action conflicts with the AGV's currently
     * active order (e.g. instant action says to lower fork while order says to
     * raise fork), or if the order contains actions the vehicle cannot perform
     * (e.g. lifting height higher than maximum lifting height, or lifting
     * actions although no stroke is installed).
     *
     * If the action can be executed, the handler should return an empty array
     * or `undefined`.
     *
     * @remarks
     * You should not include the `actionId` and the `actionType` as error
     * references as these are added automatically by the controller. If the
     * error was caused by erroneous action parameters, include a list of
     * parameters in the reference.
     *
     * If an instant action is not executable in principle it will be rejected
     * with an error by the AGV controller. If a node or edge action is not
     * executable in principle, the order will be rejected by the AGV
     * controller. In the latter case all order node and edge actions are
     * checked for executability _before_ the order is carried out.
     *
     * @param context context information of a node, edge, or instant action to
     * be checked for execution
     * @returns an array of error references if action cannot be executed; an
     * empty array or `undefined` if action can be executed
     */
    isActionExecutable(context: ActionContext): ErrorReference[];

    /**
     * Registers a handler that is invoked by the associated controller whenever
     * an instant, node, or edge action is to be executed.
     *
     * While the action is executed, the callback `context.updateActionStatus`
     * must be invoked whenever the action transitions to a new status, passing
     * in the new action status together with result description and linked
     * partial state (if applicable).
     *
     * If the action context of an action specifies `true` on the `stopDriving`
     * property the AGV must stop driving and eventually invoke
     * `controller.updateDrivingState` before executing the action; otherwise
     * the current driving state must be kept.
     *
     * @remarks
     * For a node or edge action, the initial action status WAITING is already
     * preset on the controller's current state. For an instant action, no
     * action status is preset on the current state. In both cases, the action
     * handler must initially transition to the action's initial state, either
     * INITIALIZING or RUNNING (or PAUSED if pause mode is activated), FINISHED,
     * or FAILED.
     *
     * If pause mode is active, the action to be executed should transition to
     * PAUSED state (immediately or after initializing/running, if needed). If
     * pause mode is deactivated, the action should transition to the previous
     * status again.
     *
     * For instant actions 'startPause' and 'stopPause' this handler must
     * pause/resume all other actions, and update their action status and linked
     * state `paused` accordingly. Node processing of an active order is
     * suspended and resumed automatically by the AGV controller. Edge traversal
     * must be suspended and resumed by the AGV adapter.
     *
     * Note that the instant actions 'stateRequest' and 'cancelOrder' are never
     * dispatched to this handler as they are handled by the AGV controller
     * itself.
     *
     * @param context context information of a node, edge, or instant action to
     * be executed
     */
    executeAction(context: ActionContext): void;

    /**
     * Registers a handler that is invoked by the associated controller whenever
     * a not yet finished or failed node or edge action of an active order is to
     * be canceled.
     *
     * If the action cannot be interrupted it should continue running until
     * finished or failed. If the action can be interrupted it should be
     * canceled and action status FAILED should be reported via
     * `context.updateActionStatus`.
     *
     * @remarks This handler function is only invoked for node and edge actions
     * previously scheduled by the `executeAction` handler and not yet finished
     * or failed, i.e. for actions that are either in status INITIALIZING,
     * RUNNING, or PAUSED.
     *
     * @param context context information of a node or edge action to be
     * canceled
     */
    cancelAction(context: ActionContext): void;

    /**
     * Registers a handler that is invoked by the associated controller whenever
     * an active edge action (i.e. one with status unequal FINISHED or FAILED)
     * must be terminated.
     *
     * @remarks The registered handler is invoked whenever a node is traversed
     * and any active actions on the edge leading up to that node must be
     * terminated. The handler should finish or cancel the action and report an
     * updated action status FINISHED or FAILED via
     * `context.updateActionStatus`.
     *
     * @param context context information of an edge action to be finished
     */
    finishEdgeAction(context: ActionContext): void;

    /**
     * Registers a handler that is invoked by the associated controller whenever
     * it needs to check whether a given node's position is within the allowed
     * deviation range of the current AGV position.
     *
     * The handler function should return an array of error references if the
     * node is not within the deviation range by checking the node properties x,
     * y, theta, mapId, allowedDeviationTheta, and allowedDeviationXy against
     * the current AGV position. Otherwise, the handler should return an empty
     * array or `undefined`.
     *
     * @remarks You should not include the `nodeId` as error reference as it is
     * added automatically by the controller. Instead, include all node
     * property-value pairs that fail the check.
     *
     * @param node a Node object
     * @returns an array of error references if node is not within deviation
     * range; an empty array or `undefined` otherwise
     */
    isNodeWithinDeviationRange(node: Node): ErrorReference[];

    /**
     * Registers a handler that is invoked by the associated controller to check
     * synchronously whether AGV can traverse a given route with regard to
     * vehicle-specific constraints on node/edge properties that must be
     * validated by the AGV adapter as the AGV controller is not aware of them.
     *
     * The nodes and edges passed to this handler are guaranteed to be
     * well-formed and valid with respect to the proper sequence of base/horizon
     * nodes and edges.
     *
     * Node and edge actions must not be checked by this handler; they are
     * checked individually by the handler `isActionExecutable`.
     *
     * The handler function should return an array of error references if the
     * route cannot be traversed. For example, if an edge has fields that the
     * vehicle cannot use (e.g. trajectory) or misses fields it requires (e.g.
     * nodePosition with mapId for free navigation) or fields it doesn't support
     * (e.g. rotationAllowed). Otherwise, the handler should return an empty
     * array or `undefined`.
     *
     * @param context context information with the route
     * @returns an array of error references if route cannot be traversed; an
     * empty array or `undefined` otherwise
     */
    isRouteTraversable(context: RouteTraversableContext): ErrorReference[];

    /**
     * Registers a handler that is invoked by the associated controller to
     * traverse a given edge with a given start and end node using an (optional)
     * trajectory.
     *
     * When the handler function is invoked the AGV should drive along the given
     * trajectory (if specified) or by free navigation (if not specified),
     * invoking `controller.updateDrivingState` if needed. However, if pause
     * mode is activated the AGV has to postpone traversal until pause mode is
     * deactivated by instant action 'stopPause'.
     *
     * When the given edge has been traversed completely, the callback
     * `context.edgeTraversed` must be invoked. Until this callback has been
     * called it is guaranteed that no other invocation of this handler occurs.
     *
     * @remarks
     * While traversing an edge the AGV adapter must handle activation and
     * deactivation of pause mode (triggered either by instant actions
     * 'startPause/stopPause' or by a hardware button) that affects driving
     * state and update it accordingly.
     *
     * This handler must take edge and end node orientation changes into account
     * if supported by the AGV. If an edge orientation is required and rotation
     * is disallowed on the edge, rotate the vehicle before entering the edge,
     * otherwise rotate the vehicle on the edge to the desired ortientation.
     * Upon traversal and if required, the vehicle must be rotated on the end
     * node according to node's theta angle.
     *
     * @param context context information of an edge traversal
     */
    traverseEdge(context: TraverseEdgeContext): void;

    /**
     * Registers a handler that is invoked by the associated controller whenever
     * the AGV should stop driving while the active order is being canceled and
     * after all node/edge actions of this order have already been canceled.
     *
     * If the AGV is on a node or can stop if in between nodes, it should stop
     * gracefully; otherwise it should continue driving to the next node, and
     * automatically stop on arrival. In all these cases the `traverse`
     * handler's callback `context.edgeTraversed` should not be invoked any more
     * (even if you do invoke it, it is ignored by the AGV controller).
     *
     * The handler function must invoke the callback `context.stopped` once as
     * soon as the AGV has stopped driving, even if the vehicle is already
     * stopped for another reason. After reporting this state the AGV should be
     * able to receive a new order. Until this callback has been called it is
     * guaranteed that no other invocation of this handler occurs.
     *
     * If the AGV's capabilities require it to drive to the next node before
     * stopping, the adapter must invoke both the callback
     * `context.drivingToNextNode` immediately and the callback
     * `context.stopped` after stopping on arrival.
     *
     * @remarks It is guaranteed that whenever this function is called all
     * scheduled node and edge actions of the order to be canceled have ended,
     * i.e. are either in status FINISHED or FAILED.
     *
     * @param context context information for reporting when AGV has stopped
     * driving.
     */
    stopTraverse(context: StopTraverseContext): void;

    /**
     * Registers a handler that is invoked by the associated controller to
     * synchronously calculate the trajectory for a given edge (optional).
     *
     * @remarks This handler is only required if the AGV should precalculate the
     * trajectory path of all order edges by itself whenever an order arrives.
     * The handler is invoked on all order edges (including horizon edges) in
     * the given edges order in series. Do not specify a handler function if the
     * AGV should determine the route on the fly when an edge is being traversed
     * by invoking the `traverse` handler.
     *
     * @param context context information of a trajectory
     * @returns the calculated trajectory object
     */
    trajectory?(context: TrajectoryContext): Trajectory;
}

/**
 * Defines configuration options common to all AGV adapter implementations.
 *
 * This base interface may be extended by concrete adapter implementations to
 * provide adapter specific options.
 *
 * @category AGV Controller
 */
// tslint:disable-next-line: no-empty-interface
export interface AgvAdapterOptions {
}

/**
 * A debugger function associated with an AGV adapter.
 *
 * Used to log informational, debug, and error messages. The first argument
 * is a formatter string with printf-style formatting supporting the
 * following directives: `%O` (object multi-line), `%o` (object
 * single-line), `%s` (string), `%d` (number), `%j` (JSON), `%%` (escape).
 *
 * @category AGV Controller
 */
export type AgvAdapterDebugger = (formatter: any, ...args: any[]) => void;

/**
 * Defines the constructor signature for classes that implement the interface
 * `AgvAdapter`.
 *
 * @category AGV Controller
 */
export type AgvAdapterConstructor = new (
    controller: AgvController,
    adapterOptions: AgvAdapterOptions,
    debug: AgvAdapterDebugger) => AgvAdapter;

/**
 * Defines configuration options of an AGV controller.
 *
 * @category AGV Controller
 */
export interface AgvControllerOptions {

    /**
     * Type of the AGV adapter class that should be associated with an AGV
     * controller.
     *
     * @remarks When the AGV controller is created, the given class is
     * automatically instantiated and associated with it.
     */
    agvAdapterType: AgvAdapterConstructor;

    /**
     * Periodic interval in milliseconds the State message should be published
     * at the latest (optional).
     *
     * If not specified, the value defaults to 30000ms.
     */
    publishStateInterval?: number;

    /**
     * Periodic interval in milliseconds the Visualization message should be
     * published (optional).
     *
     * If not specified, the value defaults to 1000ms. If specified as 0 (zero),
     * visualization messages are suppressed, i.e. not published at all.
     */
    publishVisualizationInterval?: number;

    /**
     * Number of `State` messages to be published for an instant action that has
     * ended or errored (optional).
     *
     * This option determines how many times the action state of an instant
     * action that has ended (i.e is either finished or failed) or errored (i.e.
     * is not executable right from the start) should be reported in the
     * `actionStates` array of a published AGV state message.
     *
     * This feature is important to ensure that a published State object is not
     * cluttered with outdated instant action states. The VDA 5050 specification
     * itself doesn't specify when to clean up these action states.
     *
     * If not specified, the value defaults to 5. If value is less than 1
     * exactly one State message is published.
     */
    finalInstantActionStateChangePublishCount?: number;
}

/**
 * Implements the common control logic and interaction flows on the vehicle
 * plane (automated guided vehicle, AGV) as defined by the VDA 5050
 * specification. This includes processing of received orders and instant
 * actions, management of order state and AGV state, as well as providing
 * updated state and visualization data to the master control.
 *
 * Together with its counterpart, the master control controller class
 * `MasterController`, it builds a high-level abstraction layer of the complex
 * business logic defined in the VDA 5050 specification.
 *
 * To keep the VDA 5050 business logic generic and independent of specific types
 * of AGVs, the AGV controller uses plug-ins to adapt to their diverse
 * navigation and control interfaces. A so-called AGV adapter is registered with
 * an AGV controller providing an abstract interface that maps generic
 * controller operations to the concrete control interface of an AGV. These
 * operations include, among others, executing or canceling a node action, an
 * edge action, or an instant action, traversing/navigating an edge, and
 * calculating trajectory paths.
 *
 * This class builds on top of the communication abstraction layer provided by
 * the `AgvClient` class which it extends. This class also provides extension
 * points by protected methods through which behavior can be customized if
 * needed.
 *
 * @remarks
 * Regarding errors reported in state messages, the following conventions are
 * used (see enum `ErrorTypes`):
 * - Order related errors always include the errorReferences "headerId:
 *   order.headerid", "topic: order", "orderId" (and "orderUpdateId" if
 *   applicable) and specify an errorType of "orderError", "orderUpdateError",
 *   "noRouteError", or "validationError".
 * - Order/instant action related errors always include the error reference
 *   "actionId" along with optional references such as "actionParameters".
 * - Order action errors (on failure) always include an errorReference "topic:
 *   order" and the generic errorType "orderActionError".
 * - Instant action errors always include an errorReference "topic:
 *   instantAction" and either an action-specify errorType such as
 *   "noOrderToCancel" or the generic errorType "instantActionError".
 *
 * The AGV controller always overrides the value of the client option
 * `topicObjectValidation.inbound` to `false` so that it can respond with an
 * error state to invalid incoming messages. This means that subclasses of
 * `AgvController` must also validate extension topics explicitely using method
 * `validateTopicObject`.
 *
 * If the AGV controller receives a topic with an invalid object payload, it
 * reports an error state with `errorType: "validationError"` containing the
 * error reference key `topic` (value is `"order"` for orders,
 * `"instantActions"` for instant actions, etc.). If a property `headerId` is
 * present on the received object, it is also included in the error references.
 * Additionally, if present for an order validation error, `"orderId"` is added
 * as error reference.
 *
 * @category AGV Controller
 */
export class AgvController extends AgvClient {

    /**
     * Special error reference key used to append detail information to an
     * `Error.errorDescription`.
     */
    static readonly REF_KEY_ERROR_DESCRIPTION_DETAIL = "errorDescriptionDetail";

    /**
     * The currently active order (update), the latest completed order, or
     * undefined if no order has been received yet.
     *
     * @remarks
     * Use `hasActiveOrder` to determine whether any current order is active.
     *
     * Use `hasCancelingOrder` to determine whether any current order is being
     * canceled.
     */
    protected currentOrder: Order;

    private _currentState: Headerless<State>;
    private _currentPausedNode: Node;
    private _currentInstantActions: Action[];
    private _instantActionsEndedPublishCount: Map<string, number>;
    private _instantActionsErroredPublishCount: Map<Error, number>;
    private _cancelOrderContext: ActionContext;
    private _publishStateTimerId: any;
    private _publishVisualizationIntervalId: any;
    private readonly _agvAdapter: AgvAdapter;
    private readonly _controllerOptions: Required<AgvControllerOptions>;
    private _currentFactsheet: Headerless<Factsheet>;

    /**
     * Creates an instance of `AgvController`, a subclass of `AgvClient`.
     *
     * @param agvId the identity of the AGV this controller represents
     * @param clientOptions configuration options for the `AgvClient`
     * @param controllerOptions configuration options for the `AgvController`
     * @param adapterOptions configurations options for the `AgvAdapter`
     */
    constructor(
        public agvId: AgvId,
        clientOptions: ClientOptions,
        controllerOptions: AgvControllerOptions,
        adapterOptions: AgvAdapterOptions) {
        super(agvId, {
            ...clientOptions,

            // Inbound topic objects must not be validated by client (and
            // dropped if invalid) as they are validated later when processing
            // Order and InstantAction topics, responding with corresponding VDA
            // 5050 error objects in State object (see _processOrder,
            // _processInstantActions).
            topicObjectValidation: { inbound: false, outbound: clientOptions.topicObjectValidation?.outbound },
        });
        this._controllerOptions = this._controllerOptionsWithDefaults(controllerOptions);
        this._currentInstantActions = [];
        this._instantActionsEndedPublishCount = new Map();
        this._instantActionsErroredPublishCount = new Map();
        this.currentOrder = undefined;
        this._cancelOrderContext = undefined;
        this._currentState = {
            actionStates: [],
            batteryState: { batteryCharge: 0.8, charging: false },
            driving: false,
            edgeStates: [],
            errors: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: OperatingMode.Manual,
            orderId: "",
            orderUpdateId: 0,
            safetyState: { eStop: EStop.None, fieldViolation: false },
        };
        this._agvAdapter = new this.controllerOptions.agvAdapterType(
            this,
            adapterOptions,
            this.debug.extend(this.controllerOptions.agvAdapterType.name));
        this._currentFactsheet = {};

        if (this._agvAdapter.apiVersion !== this.adapterApiVersion) {
            throw new Error(`${this._agvAdapter.name}@${this._agvAdapter.apiVersion} not compatible with adapter protocol ${this.adapterApiVersion} used by ${this.constructor.name}`);
        }
        this.debug("Created instance with controllerOptions %o", this.controllerOptions);
    }

    /**
     * Gets the AGV controller configuration options as a readonly object with
     * default values filled in for options not specified.
     */
    get controllerOptions(): Readonly<Required<AgvControllerOptions>> {
        return this._controllerOptions;
    }

    /**
     * Gets the protocol version of the AGV adapter API used by this controller,
     * a positive integer.
     *
     * @remarks The API version of this controller must match (i.e. equal) the
     * API version of the associated adapter. If both versions differ, an error
     * is thrown when the adapter is instantiated.
     */
    get adapterApiVersion() {
        return 2;
    }

    /**
     * Gets current state of AGV controller as an immutable object.
     *
     * @remarks
     * The returned state object is immutable, i.e. it is guaranteed to not be
     * changed by this controller. To modify the state maintained by this
     * controller, adapters and subclasses must invoke one of the provided state
     * update functions.
     *
     * The returned state object always includes a timestamp property that
     * corresponds to its latest update time.
     *
     * @returns the current state as an immutable object with latest update
     * timestamp
     */
    get currentState(): Headerless<State> {
        return this._cloneState(this._currentState) as Headerless<State>;
    }

    /**
     * Indicates whether the AGV controller has an active order.
     *
     * @remarks An order is considered active if at least one base/horizon node
     * or edge has not yet been traversed or if at least one node/edge action
     * has not yet terminated, i.e. not finished or failed.
     *
     * @returns true if the `currentOrder` is defined and active; false if the
     * latest order has been completed or no order has been received yet.
     */
    get hasActiveOrder() {
        return this._currentState.nodeStates.length > 0 ||
            this._currentState.edgeStates.length > 0 ||
            this._currentState.actionStates.some(s =>
                !this.isInstantActionState(s) &&
                s.actionStatus !== ActionStatus.Failed &&
                s.actionStatus !== ActionStatus.Finished);
    }

    /**
     * Indicates whether the AGV controller is currently canceling the active
     * order.
     */
    get hasCancelingOrder() {
        return this._cancelOrderContext !== undefined;
    }

    /**
     * Determines whether the given action state represents an instant action.
     *
     * @param state an action state
     * @returns `true` if action state represents an instant action; `false`
     * otherwise
     */
    isInstantActionState(state: ActionState) {
        return this._instantActionsEndedPublishCount.has(state.actionId);
    }

    /**
     * To be invoked by the AGV adapter whenever a new AGV position and/or
     * velocity is available.
     *
     * @remarks The update rate should correspond with the option
     * `publishVisualizationInterval` configured for this AGV controller.
     *
     * @param agvPosition new AGV position (optional)
     * @param velocity new velocity (optional)
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateAgvPositionVelocity(agvPosition?: AgvPosition, velocity?: Velocity, reportImmediately = false) {
        this._updateState(this._cloneState({ agvPosition, velocity }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever a new battery state is
     * available.
     *
     * @param batteryState new battery state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateBatteryState(batteryState: BatteryState, reportImmediately = false) {
        this._updateState(this._cloneState({ batteryState }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever the driving/rotating state of
     * the AGV changes.
     *
     * @remarks Other movements of the AGV (e.g. lift movements) are not
     * included here.
     *
     * @param driving new driving state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateDrivingState(driving: boolean, reportImmediately = false) {
        this._updateState(this._cloneState({ driving }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever the paused state changes,
     * either because of the push of a physical button on the AGV or because of
     * an instant action ('startPause' or 'stopPause').
     *
     * @param paused new paused state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updatePausedState(paused: boolean, reportImmediately = false) {
        this._updateState(this._cloneState({ paused }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever a new base request should be
     * published.
     *
     * This is useful if the AGV is almost at the end of the base and needs to
     * reduce speed if no new base is transmitted. It acts as a trigger for
     * master control to send a new base to prevent unnecessary braking.
     *
     * @param newBaseRequest new newBaseRequest state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to true)
     */
    updateNewBaseRequest(newBaseRequest: boolean, reportImmediately = true) {
        this._updateState(this._cloneState({ newBaseRequest }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever a new safety status is
     * available.
     *
     * @param safetyStatus new safety status
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to true)
     */
    updateSafetyStatus(safetyStatus: SafetyStatus, reportImmediately = true) {
        this._updateState(this._cloneState({ safetyState: safetyStatus }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever a new operation mode is
     * available.
     *
     * @param operatingMode new operating mode
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to true)
     */
    updateOperatingMode(operatingMode: OperatingMode, reportImmediately = true) {
        this._updateState(this._cloneState({ operatingMode }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever a new factsheet  is
     * available.
     *
     * @param factsheet new factsheet
     */
    updateFactsheet(factsheet: Headerless<Factsheet>) {
        const f = factsheet === undefined ? {} : JSON.parse(JSON.stringify(factsheet));
        this._currentFactsheet = f;
    }

    /**
     * To be invoked by the AGV adapter whenever an error should be added to
     * or removed from state.
     *
     * @param error an Error object
     * @param mode whether to add or remove the given error from state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updateErrors(error: Error, mode: "add" | "remove", reportImmediately = false) {
        const index = this._findErrorIndex(error);
        let newErrors: Error[];
        if (index !== -1) {
            if (mode === "add") {
                return;
            }
            newErrors = [...this._currentState.errors];
            newErrors.splice(index, 1);
        } else {
            if (mode === "remove") {
                return;
            }
            newErrors = [...this._currentState.errors, error];
        }
        this._updateState(this._cloneState({ errors: newErrors }), reportImmediately);
    }

    /**
     * To be invoked by the AGV adapter whenever a new partial state is
     * available.
     *
     * @remarks
     * This function should only be used in case none of the other more specific
     * state update functions is applicable; e.g. to update an optional state
     * property such as `loads`, `distanceSinceLastNode`, `information`, etc.
     *
     * If the optional parameter `reportImmediately` is passed as `true`, a new
     * State message is published immediately after updating the state;
     * otherwise the message is published on the next periodic or immediate
     * state update.
     *
     * @param newState new partial state
     * @param reportImmediately whether to publish a State message immediately
     * afterwards (optional, defaults to false)
     */
    updatePartialState(newState: Partial<Headerless<State>>, reportImmediately = false) {
        this._updateState(this._cloneState(newState), reportImmediately);
    }

    protected async onStarted() {
        await super.onStarted();
        this._attachAdapter();
    }

    protected async onStopping() {
        await this._detachAdapter();
        await super.onStopping();
    }

    /**
     * Invoked whenever the current state of the AGV changes.
     *
     * @remarks To be extended by AgvController subclasses, for example to log
     * state changes. The base method does nothing. A deep copy of the changed
     * state can be retrieved within this method using the `currentState`
     * getter.
     *
     * @param changes partial state properties that have changed
     */
    protected onStateChanged(changes: Partial<Headerless<State>>) {
        // To be implemented by subclasses.
    }

    /**
     * Invoked by this AGV controller to trigger execution of the given instant
     * action.
     *
     * The default implementation of this method just invokes the
     * `executeAction` handler function of the registered AGV adapter passing in
     * the given instant action context.
     *
     * @remarks This method provides an extension point for AGV controller
     * subclasses that want to perform additional side effects on the controller
     * side before executing the given instant action.
     *
     * @param context the action context of the instant action
     */
    protected executeInstantAction(context: ActionContext) {
        this.debug("Invoking instant executeAction handler with context %o", context);
        this._agvAdapter.executeAction(context);
    }

    private _controllerOptionsWithDefaults(options: AgvControllerOptions): Required<AgvControllerOptions> {
        const optionalDefaults: Required<Optional<AgvControllerOptions>> = {
            publishStateInterval: 30000,
            publishVisualizationInterval: 1000,
            finalInstantActionStateChangePublishCount: 5,
        };
        const opts = Object.assign(optionalDefaults, options);
        opts.finalInstantActionStateChangePublishCount = Math.max(1, opts.finalInstantActionStateChangePublishCount);
        return opts;
    }

    private _attachAdapter() {
        this.debug("Invoking attach handler");
        this._agvAdapter.attach({
            attached: async initialState => {
                // Ensure subscriptions on orders and instant actions are
                // registered with the broker before publishing the initial
                // state. A Master Control may observe this state to immediately
                // trigger initial instant actions or orders.
                this.updatePartialState(initialState, false);
                await this._subscribeOnStarted();
                this._publishCurrentState();
            },
        });
    }

    private _detachAdapter() {
        return new Promise<void>(resolve => {
            this.debug("Invoking detach handler");
            this._agvAdapter.detach({
                detached: detachState => {
                    this.updatePartialState(detachState, true);
                    clearTimeout(this._publishStateTimerId);
                    clearInterval(this._publishVisualizationIntervalId);
                    resolve();
                },
            });
        });
    }

    private async _subscribeOnStarted() {
        // First, subscribe to orders and instant actions.
        await this.subscribe(Topic.Order, order => this._processOrder(order));
        await this.subscribe(Topic.InstantActions, actions => this._processInstantActions(actions));

        // Ensure State is reported immediately once after client is online again.
        this.registerConnectionStateChange((currentState, prevState) => {
            if (currentState === "online" && prevState !== "online") {
                this._publishCurrentState();
            }
        });

        this._setupPublishVisualizationInterval();
    }

    private _resetPublishStateTimer() {
        clearTimeout(this._publishStateTimerId);
        this._publishStateTimerId = setTimeout(() => this._publishCurrentState(), this.controllerOptions.publishStateInterval);
    }

    private _setupPublishVisualizationInterval() {
        clearInterval(this._publishVisualizationIntervalId);
        if (this.controllerOptions.publishVisualizationInterval <= 0) {
            return;
        }
        this._publishVisualizationIntervalId = setInterval(() => this._publishVisualization(),
            this.controllerOptions.publishVisualizationInterval);
    }

    private async _publishVisualization() {
        try {
            const vis: Headerless<Visualization> = {};
            if (this._currentState.agvPosition !== undefined) {
                vis.agvPosition = this._currentState.agvPosition;
            }
            if (this._currentState.velocity !== undefined) {
                vis.velocity = this._currentState.velocity;
            }
            await this.publish(Topic.Visualization, vis, { dropIfOffline: true });
        } catch (error) {
            this.debug("Couldn't publish visualization: %s", error);
        }
    }

    private async _publishCurrentState() {
        this._resetPublishStateTimer();
        const publishedState = await this.publish(Topic.State, this._currentState, { dropIfOffline: true });
        if (publishedState !== undefined) {
            delete this._currentState.timestamp;
            this._cleanupInstantActionStates();
        }
    }

    private async _publishFactsheet(context: ActionContext) {
        await this.publish(Topic.Factsheet, this._currentFactsheet, { dropIfOffline: true, retainMessage: true });

        context.updateActionStatus({
            actionStatus: ActionStatus.Finished,
            resultDescription: "Reported new factsheet",
        });
    }

    private _updateState(newPartialState: Partial<Headerless<State>>, publishImmediately = false) {
        this._mergeState(newPartialState);
        if (publishImmediately) {
            this._publishCurrentState();
        }
        this.onStateChanged(newPartialState);
    }

    private _mergeState(newPartialState: Partial<Headerless<State>>) {
        for (const [key, value] of Object.entries(newPartialState)) {
            if (value !== undefined) {
                this._currentState[key] = value;
            } else {
                delete this._currentState[key];
            }
        }

        if (!newPartialState.timestamp) {
            // Use publish date if timestamp is not given.
            delete this._currentState.timestamp;
        }
    }

    private _cloneState(state: Partial<Headerless<State>>): Partial<Headerless<State>> {
        return state === undefined ? {} : JSON.parse(JSON.stringify(state));
    }

    private _findErrorIndex(error: Error) {
        return this._currentState.errors.findIndex(e =>
            e.errorDescription === error.errorDescription &&
            e.errorLevel === error.errorLevel &&
            e.errorType === error.errorType &&
            this._areErrorReferencesEqual(e.errorReferences, error.errorReferences));
    }

    private _areErrorReferencesEqual(refs1: ErrorReference[], refs2: ErrorReference[]) {
        if (refs1.length !== refs2.length) {
            return false;
        }
        for (const { referenceKey, referenceValue } of refs1) {
            if (!refs2.find(r => r.referenceKey === referenceKey && r.referenceValue === referenceValue)) {
                return false;
            }
        }
        return true;
    }

    /* Order processing */

    /**
     * Process order according to VDA 5050 specification.
     *
     * @param order an incoming order
     */
    private _processOrder(order: Order) {
        this.debug("Processing order %o", order);

        // Check whether order is well-formed.
        try {
            this.validateTopicObject(Topic.Order, order, this.clientOptions.vdaVersion);
            this._validateOrderConstraints(order);
        } catch (err) {
            const error = this._createOrderError(order, ErrorType.OrderValidation, `invalid order: ${err}`);
            this.debug("Invalid order: %j", error);
            this._rejectOrder(error);
            return;
        }

        if (this.hasCancelingOrder) {
            const error = this._createOrderError(order, ErrorType.Order, "active order is being canceled");
            this.debug("Order rejected as an active order is being canceled: %j", error);
            this._rejectOrder(error);
            return;
        }

        // Check whether AGV adapter can traverse the order's nodes and edges.
        if (!this._checkRouteTraversable(order)) {
            return;
        }

        // Check whether AGV adapter can execute the order's actions.
        if (!this._checkOrderActionsExecutable(order)) {
            return;
        }

        // Check whether important vehicle state currently prohibits order execution. In
        // these cases, it is better to reject the order immediately so that the master
        // control can reschedule the order at a later time or on another AGV.

        if (this._currentState.batteryState.charging) {
            const error = this._createOrderError(order, ErrorType.Order, "order is not executable while charging",
                { referenceKey: "batteryState.charging", referenceValue: "true" });
            this.debug("Order rejected as charging is in progress: %j", error);
            this._rejectOrder(error);
            return;
        }

        if (this._currentState.safetyState.eStop !== EStop.None) {
            const error = this._createOrderError(order, ErrorType.Order, "order is not executable as emergency stop is active",
                { referenceKey: "safetyState.eStop", referenceValue: this._currentState.safetyState.eStop });
            this.debug("Order rejected as emergency stop is active: %j", error);
            this._rejectOrder(error);
            return;
        }

        if (this._currentState.safetyState.fieldViolation) {
            const error = this._createOrderError(order, ErrorType.Order, "order is not executable due to protective field violation",
                { referenceKey: "safetyState.fieldViolation", referenceValue: this._currentState.safetyState.fieldViolation.toString() });
            this.debug("Order rejected as protective field is violated: %j", error);
            this._rejectOrder(error);
            return;
        }

        if (this._currentState.operatingMode !== OperatingMode.Automatic &&
            this._currentState.operatingMode !== OperatingMode.Semiautomatic) {
            const error = this._createOrderError(order, ErrorType.Order, "order is not executable due to operating mode",
                { referenceKey: "operatingMode", referenceValue: this._currentState.operatingMode });
            this.debug("Order rejected due to operating mode: %j", error);
            this._rejectOrder(error);
            return;
        }

        if (order.orderId === this.currentOrder?.orderId) {
            // Received an order update (new horizon) or a stitching order (extended base, new horizon).
            if (order.orderUpdateId < this.currentOrder.orderUpdateId) {
                const error = this._createOrderError(order, ErrorType.OrderUpdate, "invalid orderUpdateId");
                this.debug("Order update rejected as orderUpdateId is invalid: %j", error);
                this._rejectOrder(error);
            } else if (order.orderUpdateId === this.currentOrder.orderUpdateId) {
                // Discard order update and publish current state again immediately.
                this.debug("Order update discarded as orderUpdateId is already assigned");
                this._updateState({}, true);
            } else {
                if (this.hasActiveOrder) {
                    if (!this._isOrderBaseStitching(order)) {
                        const error = this._createOrderError(order, ErrorType.OrderUpdate, "stitching order base not extending active order base");
                        this.debug("Stitching order rejected as it doesn't extend the active order base: %j", error);
                        this._rejectOrder(error);
                    } else {
                        // Received a new order with stitching base. Note that
                        // contents of the stitching base node must not be changed.
                        this._acceptOrder(order, "stitch");
                    }
                } else {
                    // Received an order update.
                    if (!this._isOrderUpdateBaseStitching(order)) {
                        const error = this._createOrderError(order, ErrorType.OrderUpdate, "order update base not extending current order base");
                        this.debug("Order update rejected as it doesn't extend the current order base: %j", error);
                        this._rejectOrder(error);
                    } else {
                        // Received an order update with stitching base. Note that
                        // contents of the stitching base node must not be changed.
                        this._acceptOrder(order, "update");
                    }
                }
            }
        } else {
            if (this.hasActiveOrder) {
                if (!this._isOrderBaseStitching(order)) {
                    const error = this._createOrderError(order, ErrorType.OrderUpdate, "stitching order base not extending active order base");
                    this.debug("Stitching order rejected as it doesn't extend the active order base: %j", error);
                    this._rejectOrder(error);
                } else {
                    // Received a new order with stitching (extended) base. Note
                    // that contents of the stitching base node must not be changed.
                    this._acceptOrder(order, "stitch");
                }
            } else {
                // Received a new order.
                if (this._checkNodeWithinDeviationRange(order)) {
                    this._acceptOrder(order, "new");
                }
            }
        }
    }

    private _validateOrderConstraints(order: Order) {
        // Check if all base nodes are specified before horizon nodes.
        const nodeLen = order.nodes.length;
        if (nodeLen === 0 || !order.nodes[0].released) {
            throw new Error("Order must contain at least one base node");
        }
        let isBase = true;
        let firstHorizonIndex = -1;
        for (let i = 0; i < nodeLen; i++) {
            const node = order.nodes[i];
            // For stitching/update orders the first sequenceId is not necessarily 0.
            if ((i === 0 && node.sequenceId % 2 !== 0) ||
                (i > 0 && node.sequenceId !== order.nodes[i - 1].sequenceId + 2)) {
                throw new Error("Order contains node with invalid sequenceId");
            }
            if (isBase) {
                isBase = node.released;
                if (!isBase) {
                    firstHorizonIndex = i;
                }
            } else {
                if (node.released) {
                    throw new Error("Incorrect sequence of base-horizon nodes");
                }
            }
        }

        // Check if all base edges are specified before horizon edges and match
        // the given nodes order.
        const edgeLen = order.edges.length;
        isBase = true;
        if (edgeLen + 1 !== nodeLen) {
            throw new Error("Incompatible sequence of nodes and edges");
        }
        // TODO End node of a released edge must also be released (see issue #34).
        for (let i = 0; i < edgeLen; i++) {
            const edge = order.edges[i];
            if (edge.sequenceId !== order.nodes[i].sequenceId + 1) {
                throw new Error("Order contains edge with invalid sequenceId");
            }
            if (isBase) {
                isBase = edge.released;
                if (!isBase && firstHorizonIndex !== i + 1) {
                    throw new Error("Incorrect sequence of base-horizon edges");
                } else if (isBase && !order.nodes[i + 1].released) {
                    throw new Error("EndNode of last base edge is not released");
                }
            } else {
                if (edge.released) {
                    throw new Error("Incorrect sequence of base-horizon edges");
                }
            }
            if (edge.startNodeId !== order.nodes[i].nodeId || edge.endNodeId !== order.nodes[i + 1].nodeId) {
                throw new Error("An edge doesn't have proper start and/or end nodes");
            }
        }
    }

    /**
     * Determines whether the start of the given order's new base is the end of
     * the current order's base.
     *
     * @param order a stitching order
     * @returns true, if the stitching order is valid; false otherwise
     */
    private _isOrderBaseStitching(order: Order) {
        if (!this.currentOrder) {
            return false;
        }
        const currentHorizonStartIndex = this.currentOrder.nodes.findIndex(n => !n.released);
        const currentBaseEnd = this.currentOrder.nodes[currentHorizonStartIndex === -1 ?
            this.currentOrder.nodes.length - 1 : currentHorizonStartIndex - 1];
        // Order is validated to contain at least one base node.
        const newBaseStart = order.nodes[0];
        return currentBaseEnd.nodeId === newBaseStart.nodeId &&
            currentBaseEnd.sequenceId === newBaseStart.sequenceId;
    }

    /**
     * Determines whether the start of the given order update base is matching
     * the lastNode and lastNodeSequenceId of the current state.
     *
     * @param order an order update
     * @returns true, if the order update is valid; false otherwise
     */
    private _isOrderUpdateBaseStitching(order: Order) {
        const newBaseStart = order.nodes[0];
        return newBaseStart.nodeId === this._currentState.lastNodeId &&
            newBaseStart.sequenceId === this._currentState.lastNodeSequenceId;
    }

    private _acceptOrder(order: Order, mode: "new" | "stitch" | "update") {
        this.debug("Order accepted with mode '%s'", mode);

        switch (mode) {
            case "new": {
                this.currentOrder = order;

                // Delete action states of previous order, keep instant action states.
                this._updateState({
                    orderId: order.orderId,
                    orderUpdateId: order.orderUpdateId,
                    // Keep and do not reset lastNodeId/lastNodeSequenceId as it should still
                    // represent the last node of the previous order, if any. If necessary, the
                    // values are adjusted in the next state change event triggered by the
                    // _processNode invocation below.
                    errors: this._getNonOrderRejectionErrors(false),
                    nodeStates: this._getNodeStates(order),
                    edgeStates: this._getEdgeStates(order),
                    actionStates: this._getInstantActionStates().concat(this._getActionStates(order)),
                }, true);
                this._processNode(this.currentOrder.nodes[0]);
                break;
            }
            case "update": {
                this.currentOrder = order;

                // Delete action states of previous order, keep instant action states.
                this._updateState({
                    orderUpdateId: order.orderUpdateId,
                    errors: this._getNonOrderRejectionErrors(false),
                    nodeStates: this._getNodeStates(order),
                    edgeStates: this._getEdgeStates(order),
                    actionStates: this._getInstantActionStates().concat(this._getActionStates(order)),
                }, true);
                this._processNode(this.currentOrder.nodes[0]);
                break;
            }
            case "stitch": {
                // An order is already active, use and update it.
                this.currentOrder.orderId = order.orderId;
                this.currentOrder.orderUpdateId = order.orderUpdateId;
                this.currentOrder.zoneSetId = order.zoneSetId;

                // Clear current horizon nodes, append new base and horizon nodes, keeping
                // end node of current base (might be processing currently). Actions of
                // first new base node are appended to end node of current base.
                let currentHorizonStartIndex = this.currentOrder.nodes.findIndex(n => !n.released);
                const currentBaseEnd = this.currentOrder.nodes[currentHorizonStartIndex === -1 ?
                    this.currentOrder.nodes.length - 1 : currentHorizonStartIndex - 1];
                this.currentOrder.nodes = this.currentOrder.nodes
                    .slice(0, currentHorizonStartIndex === -1 ? undefined : currentHorizonStartIndex)
                    .concat(order.nodes.slice(1));

                // Append actions of first new base node to current base end node.
                currentBaseEnd.actions = currentBaseEnd.actions.concat(order.nodes[0].actions);

                // Clear current horizon edges, append new base and horizon edges.
                currentHorizonStartIndex = this.currentOrder.edges.findIndex(n => !n.released);
                this.currentOrder.edges = this.currentOrder.edges
                    .slice(0, currentHorizonStartIndex === -1 ? undefined : currentHorizonStartIndex)
                    .concat(order.edges);

                // Even if the previous order is currently active all its actions (if
                // any) may have completed already so in this case we need to trigger
                // processing of the first stitched edge explicitly.
                const isLastBaseNodeProcessed = !this._currentState.nodeStates.some(s =>
                    s.nodeId === currentBaseEnd.nodeId && s.sequenceId === currentBaseEnd.sequenceId);
                const allLastBaseNodeActionsEnded = currentBaseEnd.actions.every(a => this._isActionEnded(a));

                this._updateState({
                    orderId: order.orderId,
                    orderUpdateId: order.orderUpdateId,
                    errors: this._getNonOrderRejectionErrors(true),
                    nodeStates: this._currentState.nodeStates.filter(s => s.released).concat(this._getNodeStates(order, true)),
                    edgeStates: this._currentState.edgeStates.filter(s => s.released).concat(this._getEdgeStates(order)),
                    // Also include action states of first new base node.
                    actionStates: this._currentState.actionStates.concat(this._getActionStates(order, false)),
                }, true);

                if (isLastBaseNodeProcessed && allLastBaseNodeActionsEnded) {
                    // If all triggered last base node actions have already finished/failed;
                    // processing of the next edge must be triggered explicitely.
                    this._processEdge(currentBaseEnd);
                }
                break;
            }
        }
    }

    private _rejectOrder(error: Error) {
        // Order rejection errors must be reported until a new order has been accepted.
        this._updateState({ errors: [...this._currentState.errors, error] }, true);
    }

    /**
     * Cancel the currently active order.
     *
     * Used in the event of an unplanned change in the base nodes, the order
     * must be canceled by the master control using the instant action
     * 'cancelOrder'.
     *
     * AGV stops as soon as possible. This could be immediately or on the next
     * node depending on the AGV's capabilities. Then the order is deleted. All
     * scheduled actions are canceled.
     *
     * @param context context information of the instant action 'cancelOrder'
     */
    private _cancelOrder(context: ActionContext) {
        // Asserted: AGV has active order (by _checkInstantActionExecutable).
        this._cancelOrderContext = context;

        // All WAITING node and edge actions can be safely set to FAILED as no
        // executeAction handler has yet been invoked. Do not use
        // _updateActionStatus as not yet scheduled HARD blocking actions would
        // be triggered.
        this._currentState.actionStates.forEach(s => {
            if (!this.isInstantActionState(s) && s.actionStatus === ActionStatus.Waiting) {
                s.actionStatus = ActionStatus.Failed;
            }
        });

        // This action is set to status RUNNING and reported immediately
        // together with the not yet scheduled actions with status FAILED.
        this._updateActionStatus(context, {
            actionStatus: ActionStatus.Running,
        });

        // Next, trigger cancelation of all scheduled, but not yet ended node
        // and edge actions of the current order.
        let hasActionsToBeCanceled = false;
        this._currentState.actionStates.forEach(s => {
            if (!this.isInstantActionState(s) &&
                // Asserted: s.actionStatus !== ActionStatus.Waiting
                s.actionStatus !== ActionStatus.Finished && s.actionStatus !== ActionStatus.Failed) {
                let actionContext: ActionContext;
                for (const node of this.currentOrder.nodes) {
                    if (!node.released) {
                        break;
                    }
                    const action = node.actions.find(a => a.actionId === s.actionId);
                    if (action) {
                        actionContext = {
                            action,
                            scope: "node",
                            updateActionStatus: change => this._updateActionStatus(actionContext, change),
                            node,
                            activeOrderId: this.currentOrder.orderId,
                        };
                        break;
                    }
                }
                if (!actionContext) {
                    for (const edge of this.currentOrder.edges) {
                        if (!edge.released) {
                            break;
                        }
                        const action = edge.actions.find(a => a.actionId === s.actionId);
                        if (action) {
                            actionContext = {
                                action,
                                scope: "edge",
                                updateActionStatus: change => this._updateActionStatus(actionContext, change),
                                edge,
                                edgeStartNode: this._getEdgeStartNode(this.currentOrder, edge),
                                edgeEndNode: this._getEdgeEndNode(this.currentOrder, edge),
                                activeOrderId: this.currentOrder.orderId,
                            };
                            break;
                        }
                    }
                }
                hasActionsToBeCanceled = true;
                this.debug("Invoking cancelAction handler with context %o", actionContext);
                this._agvAdapter.cancelAction(actionContext);
            }
        });

        if (!hasActionsToBeCanceled) {
            this._onOrderActionsCanceled();
        }
    }

    private _areAllOrderActionsCanceled() {
        // Asserted: this.hasCancelingOrder
        for (const node of this.currentOrder.nodes) {
            if (!node.released) {
                break;
            }
            if (!node.actions.every(a => this._isActionEnded(a))) {
                return false;
            }
        }
        for (const edge of this.currentOrder.edges) {
            if (!edge.released) {
                break;
            }
            if (!edge.actions.every(a => this._isActionEnded(a))) {
                return false;
            }
        }
        return true;
    }

    /**
     * As soon as all cancelable and non-cancelable actions have been ended,
     * continue order cancelation process by stopping AGV immediately or on next
     * node, depending on its capabilities.
     */
    private _onOrderActionsCanceled() {
        this.debug("Invoking stopTraverse handler");
        this._agvAdapter.stopTraverse({
            drivingToNextNode: (nextNode: Node) => {
                // If AGV is traversing an edge and cannot stop in between nodes keep end node
                // state of traversed edge and remove all other node and edge states
                // immediately. The end node state must be kept so that the order is still
                // considered active until the callback `stopped` is invoked.
                this.debug("Invoked drivingToNextNode callback with next node %o", nextNode);
                this._updateState({
                    nodeStates: this._currentState.nodeStates.filter(s =>
                        s.nodeId === nextNode.nodeId && s.sequenceId === nextNode.sequenceId),
                    edgeStates: [],
                }, true);
            },
            stopped: () => {
                this.debug("Invoked stopped callback");
                const cancelOrderContext = this._cancelOrderContext;
                this._cancelOrderContext = undefined;

                // Remove all (remaining) node and edge states. Keep action states. Keep orderId
                // and orderUpdateId for new or update orders with stitching base.
                this._updateState({
                    nodeStates: [],
                    edgeStates: [],
                }, false);

                // Finally, finish cancelOrder action and publish modified state.
                this._updateActionStatus(cancelOrderContext, {
                    actionStatus: ActionStatus.Finished,
                });
            },
        });
    }

    private _checkRouteTraversable(order: Order) {
        const context: RouteTraversableContext = { nodes: order.nodes, edges: order.edges };
        this.debug("Invoking isRouteTraversable handler on context %o", context);
        const errorRefs = this._agvAdapter.isRouteTraversable(context) || [];
        if (errorRefs.length !== 0) {
            const error = this._createOrderError(order, ErrorType.OrderNoRoute, "order route is not traversable", ...errorRefs);
            this.debug("Order rejected as route is not traversable: %j", error);
            this._rejectOrder(error);
            return false;
        }
        return true;
    }

    private _checkOrderActionsExecutable(order: Order) {
        const reportError = (context: ActionContext, errorRefs: ErrorReference[]) => {
            const error = this._createOrderError(order, ErrorType.Order, "order action is not executable",
                { referenceKey: "actionId", referenceValue: context.action.actionId },
                { referenceKey: "actionType", referenceValue: context.action.actionType },
                ...errorRefs);
            this.debug("Order rejected as an action is not executable: %j", error);
            this._rejectOrder(error);
        };

        // Check if all node and edge actions of the order are executable.
        // Report an error on the first action that is not executable.
        for (const node of order.nodes) {
            for (const action of node.actions) {
                const context: ActionContext = {
                    action,
                    scope: "node",
                    updateActionStatus: undefined,
                    node,
                    activeOrderId: order.orderId,
                };
                this.debug("Invoking isActionExecutable handler on context %o", context);
                const errorRefs = this._agvAdapter.isActionExecutable(context);
                if (errorRefs?.length > 0) {
                    reportError(context, errorRefs);
                    return false;
                }
            }
        }

        for (const edge of order.edges) {
            for (const action of edge.actions) {
                const context: ActionContext = {
                    action,
                    scope: "edge",
                    updateActionStatus: undefined,
                    edge,
                    edgeStartNode: this._getEdgeStartNode(order, edge),
                    edgeEndNode: this._getEdgeEndNode(order, edge),
                    activeOrderId: order.orderId,
                };
                this.debug("Invoking isActionExecutable handler on context %o", context);
                const errorRefs = this._agvAdapter.isActionExecutable(context);
                if (errorRefs?.length > 0) {
                    reportError(context, errorRefs);
                    return false;
                }
            }
        }

        return true;
    }

    private _checkNodeWithinDeviationRange(order: Order): boolean {
        const firstNode = order.nodes[0];
        this.debug("Invoking isNodeWithinDeviationRange handler with node %o", firstNode);
        const errorRefs = this._agvAdapter.isNodeWithinDeviationRange(firstNode) || [];
        if (errorRefs.length !== 0) {
            const error = this._createOrderError(order, ErrorType.OrderNoRoute, "first node of new order not within deviation range",
                { referenceKey: "nodeId", referenceValue: firstNode.nodeId }, ...errorRefs);
            this.debug("Order rejected as first node is not within deviation range: %j", error);
            this._rejectOrder(error);
            return false;
        }
        return true;
    }

    private _getNodeStates(order: Order, excludeFirstNode = false): NodeState[] {
        return (excludeFirstNode ? order.nodes.slice(1) : order.nodes)
            .map(n => {
                const state: NodeState = {
                    nodeId: n.nodeId,
                    released: n.released,
                    sequenceId: n.sequenceId,
                };
                if (n.nodeDescription !== undefined) {
                    state.nodeDescription = n.nodeDescription;
                }
                if (n.nodePosition !== undefined) {
                    state.nodePosition = n.nodePosition;
                }
                return state;
            });
    }

    private _getEdgeStates(order: Order): EdgeState[] {
        return order.edges
            .map(e => {
                let trajectory: Trajectory;
                if (!this._agvAdapter.trajectory) {
                    trajectory = e.trajectory;
                } else {
                    // Let AGV calculate its own trajectory.
                    trajectory = this._agvAdapter.trajectory({
                        edge: e,
                        startNode: this._getEdgeStartNode(order, e),
                        endNode: this._getEdgeEndNode(order, e),
                    });
                    this.debug("Invoking trajectory calculation handler on edge %o with result %o", e, trajectory);
                }
                const state: EdgeState = {
                    edgeId: e.edgeId,
                    released: e.released,
                    sequenceId: e.sequenceId,
                };
                if (e.edgeDescription !== undefined) {
                    state.edgeDescription = e.edgeDescription;
                }
                if (trajectory !== undefined) {
                    state.trajectory = trajectory;
                }
                return state;
            });
    }

    private _getActionStates(order: Order, excludeFirstNode = false): ActionState[] {
        const actionStateFrom = (a: Action) => {
            const s: ActionState = {
                actionId: a.actionId,
                actionStatus: ActionStatus.Waiting,
                actionType: a.actionType,
            };
            if (a.actionDescription !== undefined) {
                s.actionDescription = a.actionDescription;
            }
            return s;
        };
        return (excludeFirstNode ? order.nodes.slice(1) : order.nodes)
            .filter(n => n.released)
            .flatMap(n => n.actions.map(a => actionStateFrom(a)))
            .concat(order.edges
                .filter(e => e.released)
                .flatMap(e => e.actions.map(a => actionStateFrom(a))));
    }

    private _getInstantActionStates() {
        return this._currentState.actionStates.filter(s => this.isInstantActionState(s));
    }

    private _getNonOrderRejectionErrors(shouldKeepOrderActionErrors: boolean) {
        // Keep instant action errors and order action errors related to a
        // stitching order; discard all previous order rejection errors to
        // ensure that master control doesn't erroneously reject a valid order
        // update or stitching order with the same orderId and orderSequenceId
        // as a previously rejected one.
        return this._currentState.errors.filter(e =>
            this._instantActionsErroredPublishCount.has(e) ||
            (shouldKeepOrderActionErrors && e.errorReferences && e.errorReferences.some(r => r.referenceKey === "actionId")));
    }

    private _cleanupInstantActionStates() {
        // Remove errors related to errored instant actions.
        const errorsToRemove = new Set<Error>();
        this._instantActionsErroredPublishCount.forEach((count, err, map) => {
            if (!this._currentState.errors.includes(err)) {
                return;
            }
            count++;
            if (count >= this.controllerOptions.finalInstantActionStateChangePublishCount) {
                map.delete(err);
                errorsToRemove.add(err);
            } else {
                map.set(err, count);
            }
        });

        // Remove actionStates related to ended instant actions.
        const actionIdsToRemove = new Set<string>();
        this._instantActionsEndedPublishCount.forEach((count, id, map) => {
            const state = this._currentState.actionStates.find(s => s.actionId === id);
            if (!state || (state.actionStatus !== ActionStatus.Finished && state.actionStatus !== ActionStatus.Failed)) {
                return;
            }
            count++;
            if (count >= this.controllerOptions.finalInstantActionStateChangePublishCount) {
                map.delete(id);
                actionIdsToRemove.add(id);
            } else {
                map.set(id, count);
            }
        });

        const newState: Partial<Headerless<State>> = {};
        if (errorsToRemove.size > 0) {
            newState.errors = this._currentState.errors.filter(e => !errorsToRemove.has(e));
        }
        if (actionIdsToRemove.size > 0) {
            newState.actionStates = this._currentState.actionStates.filter(s => !actionIdsToRemove.has(s.actionId));
        }
        if (newState.errors !== undefined || newState.actionStates !== undefined) {
            this._updateState(newState, false);
        }
    }

    private _getEdgeStartNode(order: Order, edge: Edge) {
        return order.nodes.find(n => n.nodeId === edge.startNodeId && n.sequenceId === edge.sequenceId - 1);
    }

    private _getEdgeEndNode(order: Order, edge: Edge) {
        return order.nodes.find(n => n.nodeId === edge.endNodeId && n.sequenceId === edge.sequenceId + 1);
    }

    private _getTrailingEdge(node: Node) {
        return this.currentOrder.edges.find(e => e.startNodeId === node.nodeId && e.sequenceId === node.sequenceId + 1);
    }

    /* Node and edge processing */

    private _processNode(node: Node, traversedEdge?: Edge) {
        this.debug("Processing node %s (sequenceId %d)", node.nodeId, node.sequenceId);
        if (!node.released) {
            this.debug("Stop node processing because node is not released");
            return;
        }
        if (this._currentState.paused) {
            this.debug("Stop node processing because AGV is in a paused state");
            // Node processing will be resumed when the instant action 'stopPause' is invoked.
            this._currentPausedNode = node;
            return;
        }

        // Terminate actions on the edge leading up to the node and report traversal of
        // the edge.
        let edgeStates: EdgeState[];
        if (traversedEdge) {
            this._finishEdgeActions(traversedEdge);
            edgeStates = this._currentState.edgeStates.filter(s =>
                !(s.edgeId === traversedEdge.edgeId && s.sequenceId === traversedEdge.sequenceId));
        }

        // Report the traversal of this node.
        this._updateState({
            nodeStates: this._currentState.nodeStates
                .filter(s => !(s.nodeId === node.nodeId && s.sequenceId === node.sequenceId)),
            ...(edgeStates ? { edgeStates } : {}),
            lastNodeId: node.nodeId,
            lastNodeSequenceId: node.sequenceId,
        }, true);

        // Node actions (if any) must be executed in parallel or sequentially depending
        // on their blocking type. Afterwards, the trailing edge can be processed.
        this._processNodeActions(node);
    }

    private _processEdge(node: Node) {
        // Asserted: AGV is NOT in a paused state.
        const edge = this._getTrailingEdge(node);

        if (edge === undefined || !edge.released) {
            this.debug("Stop processing of node %s (sequenceId %d) because no trailing released edge is existing",
                node.nodeId, node.sequenceId);
            return;
        }

        this.debug("Processing edge %s (sequenceId %d)", edge.edgeId, edge.sequenceId);
        this._processEdgeActions(edge);
    }

    private _traverseEdge(edge: Edge) {
        const context: TraverseEdgeContext = {
            edge,
            startNode: this._getEdgeStartNode(this.currentOrder, edge),
            endNode: this._getEdgeEndNode(this.currentOrder, edge),
            trajectory: this._currentState.edgeStates.find(s => s.edgeId === edge.edgeId && s.sequenceId === edge.sequenceId)?.trajectory,
            edgeTraversed: () => this._updateEdgeTraversed(context),
        };
        this.debug("Invoking traverse handler on edgeId %s (sequenceId %d) with context %o", edge.edgeId, edge.sequenceId, context);
        this._agvAdapter.traverseEdge(context);
    }

    private _updateEdgeTraversed(context: TraverseEdgeContext) {
        this.debug("Edge %s (sequenceId %d) has been traversed", context.edge.edgeId, context.edge.sequenceId);
        if (this.hasCancelingOrder) {
            this.debug("Skip processing node %s (sequenceId %d) as active order is canceled", context.endNode, context.edge);
            return;
        }
        this._processNode(context.endNode, context.edge);
    }

    /* Action processing */

    private _isActionEnded(action: Action) {
        const as = this._currentState.actionStates.find(s => s.actionId === action.actionId);
        return as !== undefined && (as.actionStatus === ActionStatus.Finished || as.actionStatus === ActionStatus.Failed);
    }

    /**
     * Returns the next HARD blocking action after the given action or
     * `undefined` if such a one doesn't exist.
     *
     * @param actions an array of Action objects
     * @param action a NONE or SOFT blocking action
     */
    private _getHardBlockingActionAfterParallelActions(actions: Action[], action: Action) {
        const actionIndex = actions.findIndex(a => a.actionId === action.actionId);
        return actions.find((a, i) => i > actionIndex && a.blockingType === BlockingType.Hard);
    }

    /**
     * Determines whether all NONE and/or SOFT blocking actions which have been
     * executed in parallel with the given ended action have also been
     * ended, i.e. are in action status FINISHED or FAILED.
     */
    private _areParallelActionsEnded(actions: Action[], endedAction: Action, softOnly: boolean) {
        const actionIndex = actions.findIndex(a => a.actionId === endedAction.actionId);
        for (let i = actionIndex - 1; i >= 0; i--) {
            const action = actions[i];
            if (action.blockingType === BlockingType.Hard) {
                break;
            } else {
                const ended = this._isActionEnded(action);
                if (softOnly) {
                    if (action.blockingType === BlockingType.Soft && !ended) {
                        return false;
                    }
                } else {
                    if (!ended) {
                        return false;
                    }
                }
            }
        }
        const len = actions.length;
        for (let i = actionIndex + 1; i < len; i++) {
            const action = actions[i];
            if (action.blockingType === BlockingType.Hard) {
                return true;
            } else {
                const ended = this._isActionEnded(action);
                if (softOnly) {
                    if (action.blockingType === BlockingType.Soft && !ended) {
                        return false;
                    }
                } else {
                    if (!ended) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private _updateActionStatus(context: ActionContext, change: ActionStatusChangeInfo) {
        const { action, scope } = context;
        const { actionStatus, resultDescription, errorDescription, linkedState } = change;
        this.debug("Updated action %o change: %o", action, change);

        // Update action state.
        const newActionState: ActionState = {
            actionId: action.actionId,
            actionStatus: actionStatus,
            actionType: action.actionType,
        };
        if (action.actionDescription !== undefined) {
            newActionState.actionDescription = action.actionDescription;
        }
        if (resultDescription !== undefined) {
            newActionState.resultDescription = resultDescription;
        }
        const newActionStates = [...this._currentState.actionStates];
        const i = this._currentState.actionStates.findIndex(s => s.actionId === action.actionId);
        if (i === -1) {
            newActionStates.push(newActionState);
        } else {
            newActionStates[i] = newActionState;
        }

        // Additionally report an error state if action fails and specifies an error description.
        const errors: Partial<Headerless<State>> = {};
        if (actionStatus === ActionStatus.Failed && errorDescription) {
            const error = this._createActionError(context,
                scope === "instant" ? ErrorType.InstantAction : ErrorType.OrderAction, errorDescription, []);
            errors.errors = [...this._currentState.errors, error];
        }

        this._updateState(Object.assign({ actionStates: newActionStates }, errors, this._cloneState(linkedState)), true);

        // Continue processing actions and edge traversal.
        if (actionStatus === ActionStatus.Failed || actionStatus === ActionStatus.Finished) {
            switch (scope) {
                case "node": {
                    if (this.hasCancelingOrder) {
                        if (this._areAllOrderActionsCanceled()) {
                            this._onOrderActionsCanceled();
                        }
                    } else {
                        if (action.blockingType === BlockingType.Hard) {
                            this._processNodeActions(context.node, action);
                        } else {
                            const nextHardAction = this._getHardBlockingActionAfterParallelActions(context.node.actions, action);
                            if (nextHardAction) {
                                if (this._areParallelActionsEnded(context.node.actions, action, false)) {
                                    this._processNodeAction(context.node, nextHardAction, true);
                                }
                            } else {
                                if (this._areParallelActionsEnded(context.node.actions, action, true)) {
                                    this._processEdge(context.node);
                                }
                            }
                        }
                    }
                    break;
                }
                case "edge": {
                    if (this.hasCancelingOrder) {
                        if (this._areAllOrderActionsCanceled()) {
                            this._onOrderActionsCanceled();
                        }
                    } else {
                        if (action.blockingType === BlockingType.Hard) {
                            this._processEdgeActions(context.edge, action);
                        } else {
                            const nextHardAction = this._getHardBlockingActionAfterParallelActions(context.edge.actions, action);
                            if (nextHardAction) {
                                if (this._areParallelActionsEnded(context.edge.actions, action, false)) {
                                    this._processEdgeAction(context.edge, nextHardAction, true);
                                }
                            } else {
                                if (this._areParallelActionsEnded(context.edge.actions, action, true)) {
                                    this._traverseEdge(context.edge);
                                }
                            }
                        }
                    }
                    break;
                }
                case "instant": {
                    const actionIndex = this._currentInstantActions.findIndex(a => a.actionId === action.actionId);
                    if (action.blockingType === BlockingType.Hard) {
                        this._currentInstantActions.splice(actionIndex, 1);
                        this._processInstantActionChunk(undefined);
                    } else {
                        const nextHardAction = this._getHardBlockingActionAfterParallelActions(this._currentInstantActions, action);
                        if (nextHardAction && this._areParallelActionsEnded(this._currentInstantActions, action, false)) {
                            this._currentInstantActions.splice(actionIndex, 1);
                            this._processInstantAction(nextHardAction, true);
                        } else {
                            this._currentInstantActions.splice(actionIndex, 1);
                        }
                    }
                    break;
                }
            }
        }
    }

    /**
     * Execute remaining NONE or SOFT blocking actions up to next HARD blocking
     * action in parallel.
     *
     * Actions that are triggered on nodes can run as long as they need to run.
     * Actions on nodes should be self-terminating (e.g. an audio signal that
     * lasts for five seconds, or a pick action that is finished after picking
     * up a load) or should be formulated pairwise (e.g. activateWarningLights
     * and deactivateWarningLights), although there may be exceptions.
     *
     * Node actions are processed as follows: if at least one action with
     * blocking type SOFT or HARD exists the AGV stops driving, otherwise it
     * continues driving if not currently being stopped by other means. Then,
     * all NONE or SOFT blocking actions are executed in parallel, up to the
     * next HARD blocking action in the list. Once all the actions have
     * transitioned into status FINISHED or FAILED the following HARD blocking
     * action is executed. Once it has transitioned into status FINISHED or
     * FAILED iteration on node actions continues up to the next HARD blocking
     * action. If no (more) HARD blocking action exist all executing SOFT
     * blocking actions must have transitioned into status FINISHED or FAILED
     * before order processing can continue.
     *
     * @param node a Node
     * @param afterAction only process actions after this one (optional)
     */
    private _processNodeActions(node: Node, afterAction?: Action) {
        const afterIndex = afterAction === undefined ? -1 : node.actions.findIndex(a => a.actionId === afterAction.actionId);
        const hardIndex = node.actions.findIndex((a, i) => i > afterIndex && a.blockingType === BlockingType.Hard);
        const softIndex = node.actions.findIndex((a, i) => i > afterIndex && a.blockingType === BlockingType.Soft);
        const stopIndex = hardIndex === -1 ? node.actions.length : hardIndex;
        const stopDriving = softIndex !== -1 && softIndex < stopIndex;
        if (stopIndex === afterIndex + 1) {
            if (hardIndex === -1) {
                // All actions (if any) have been processed. Continue processing of next edge.
                this._processEdge(node);
            } else {
                // Execute HARD blocking action immediately following the given afterAction.
                this._processNodeAction(node, node.actions[stopIndex], true);
            }
        } else {
            // Execute NONE or SOFT blocking actions in parallel following the given afterAction.
            for (let i = afterIndex + 1; i < stopIndex; i++) {
                this._processNodeAction(node, node.actions[i], stopDriving);
            }
        }
    }

    private _processNodeAction(node: Node, action: Action, stopDriving: boolean) {
        const context: ActionContext = {
            action,
            scope: "node",
            stopDriving,
            updateActionStatus: change => this._updateActionStatus(context, change),
            node,
            activeOrderId: this.currentOrder.orderId,
        };
        this.debug("Invoking node executeAction handler with context %o", context);
        // For a node action, the initial action status WAITING is already preset on current state.
        this._agvAdapter.executeAction(context);
    }

    private _processEdgeActions(edge: Edge, afterAction?: Action) {
        const afterIndex = afterAction === undefined ? -1 : edge.actions.findIndex(a => a.actionId === afterAction.actionId);
        const hardIndex = edge.actions.findIndex((a, i) => i > afterIndex && a.blockingType === BlockingType.Hard);
        const softIndex = edge.actions.findIndex((a, i) => i > afterIndex && a.blockingType === BlockingType.Soft);
        const stopIndex = hardIndex === -1 ? edge.actions.length : hardIndex;
        const stopDriving = softIndex !== -1 && softIndex < stopIndex;
        if (stopIndex === afterIndex + 1) {
            if (hardIndex === -1) {
                // All actions (if any) have been processed. Continue traversal of edge.
                this._traverseEdge(edge);
            } else {
                // Execute HARD blocking action immediately following the given afterAction.
                this._processEdgeAction(edge, edge.actions[stopIndex], true);
            }
        } else {
            // Execute NONE or SOFT blocking actions in parallel following the given afterAction.
            for (let i = afterIndex + 1; i < stopIndex; i++) {
                this._processEdgeAction(edge, edge.actions[i], stopDriving);
            }
        }
    }

    private _processEdgeAction(edge: Edge, action: Action, stopDriving: boolean) {
        const context: ActionContext = {
            action,
            scope: "edge",
            stopDriving,
            updateActionStatus: change => this._updateActionStatus(context, change),
            edge,
            edgeStartNode: this._getEdgeStartNode(this.currentOrder, edge),
            edgeEndNode: this._getEdgeEndNode(this.currentOrder, edge),
            activeOrderId: this.currentOrder.orderId,
        };
        this.debug("Invoking edge executeAction handler with context %o", context);
        // For an edge action, the initial action status WAITING is already preset on current state.
        this._agvAdapter.executeAction(context);
    }

    /**
     * Edge actions that are not in status FINISHED or FAILED must be
     * explicitely terminated when the edge end node is traversed.
     *
     * @remarks An action triggered by an edge will only be active for the time
     * that the AGV is traversing the edge which triggered the action. When the
     * AGV leaves the edge, the action will stop and the state before entering
     * the edge will be restored.
     *
     * @param edge an edge to be left when end node is traversed
     */
    private _finishEdgeActions(edge: Edge) {
        for (const action of edge.actions) {
            if (!this._isActionEnded(action)) {
                const context: ActionContext = {
                    action,
                    scope: "edge",
                    updateActionStatus: change => this._updateActionStatus(context, change),
                    edge,
                    edgeStartNode: this._getEdgeStartNode(this.currentOrder, edge),
                    edgeEndNode: this._getEdgeEndNode(this.currentOrder, edge),
                    activeOrderId: this.currentOrder.orderId,
                };
                this.debug("Invoking finishEdgeAction handler with context %o", context);
                this._agvAdapter.finishEdgeAction(context);
            }
        }
    }

    private _processInstantActions(actions: InstantActions) {
        // Check whether InstantActions object is well-formed.
        try {
            this.validateTopicObject(Topic.InstantActions, actions, this.clientOptions.vdaVersion);
        } catch (err) {
            const error = this._createInstantActionsValidationError(actions, `invalid instant actions: ${err}`);
            this.debug("Invalid instant actions: %j", error);
            this._instantActionsErroredPublishCount.set(error, 0);
            this._updateState({
                errors: [...this._currentState.errors, error],
            }, true);
            return;
        }

        const afterAction = this._currentInstantActions[this._currentInstantActions.length - 1];
        const hasPendingHardAction = this._currentInstantActions.some(a => a.blockingType === BlockingType.Hard);

        if (this.clientOptions.vdaVersion === "1.1.0") {
            this._currentInstantActions.push(...actions.instantActions.filter(a => this._checkInstantActionExecutable(a)));
        } else {
            this._currentInstantActions.push(...actions.actions.filter(a => this._checkInstantActionExecutable(a)));
        }

        if (!hasPendingHardAction) {
            // Trigger all newly added NONE and SOFT actions up to but not including the
            // first new HARD blocking action. If no more old actions are pending at all,
            // trigger any initial new HARD blocking action.
            this._processInstantActionChunk(afterAction, afterAction !== undefined);
        }
    }

    private _processInstantActionChunk(afterAction: Action, skipInitialHard = false) {
        const actions = this._currentInstantActions;
        const afterIndex = afterAction === undefined ? -1 : actions.findIndex(a => a.actionId === afterAction.actionId);
        const hardIndex = actions.findIndex((a, i) => i > afterIndex && a.blockingType === BlockingType.Hard);
        const softIndex = actions.findIndex((a, i) => i > afterIndex && a.blockingType === BlockingType.Soft);
        const stopIndex = hardIndex === -1 ? actions.length : hardIndex;
        const stopDriving = softIndex !== -1 && softIndex < stopIndex;
        if (stopIndex === afterIndex + 1) {
            if (hardIndex !== -1 && !skipInitialHard) {
                // Execute HARD blocking action immediately following the given afterAction.
                this._processInstantAction(actions[stopIndex], true);
            }
        } else {
            // Execute NONE or SOFT blocking actions in parallel following the given afterAction.
            for (let i = afterIndex + 1; i < stopIndex; i++) {
                this._processInstantAction(actions[i], stopDriving);
            }
        }
    }

    private _processInstantAction(action: Action, stopDriving: boolean) {
        const context: ActionContext = {
            action,
            scope: "instant",
            stopDriving,
            updateActionStatus: change => this._updateActionStatus(context, change),
            activeOrderId: this.hasActiveOrder ? this.currentOrder.orderId : undefined,
        };
        this._instantActionsEndedPublishCount.set(action.actionId, 0);

        // Some instant actions require special handling by or with side effects on controller.
        switch (action.actionType) {
            case "stateRequest": {
                // Requests the AGV to send a new state report. This action is executed
                // by the controller and never dispatched to an AGV adapter.
                this.debug("Processing instant action 'stateRequest' with context %o", context);
                context.updateActionStatus({
                    actionStatus: ActionStatus.Finished,
                    resultDescription: "Reported new state",
                });
                break;
            }
            case "cancelOrder": {
                this.debug("Processing instant action 'cancelOrder' with context %o", context);
                this._cancelOrder(context);
                break;
            }
            case "factsheetRequest": {
                this.debug("Processing instant action 'factsheetRequest' with context %o", context);
                if (this.clientOptions.vdaVersion === "2.0.0" || this.clientOptions.vdaVersion === "2.1.0") {
                    this._publishFactsheet(context);
                } else {
                    context.updateActionStatus({
                        actionStatus: ActionStatus.Failed,
                        errorDescription: `Requesting factsheet with VDA Version ${this.clientOptions.vdaVersion} is not supported`,
                    });
                }
                break;
            }
            case "stopPause": {
                context.updateActionStatus = change => {
                    this._updateActionStatus(context, change);
                    if (change.actionStatus === ActionStatus.Finished) {
                        // Resume processing of paused node (see _processNode).
                        const pausedNode = this._currentPausedNode;
                        if (pausedNode) {
                            this._currentPausedNode = undefined;
                            if (!this.hasCancelingOrder) {
                                this._processNode(pausedNode);
                            }
                        }
                    }
                };
                this.executeInstantAction(context);
                break;
            }
            case "startPause": {
                // An active order doesn't need to be paused explicitely as (1) ongoing edge
                // traversal will be paused by traverse handler, (2) node processing will be
                // suspended by checking paused state, and (3) all order and instant actions
                // will be paused by the startPause action.
                this.executeInstantAction(context);
                break;
            }
            default: {
                // For an instant action, the action handler must initially invoke the action
                // callback with status INITIALIZING or RUNNING (followed by PAUSED if pause
                // mode is active), or FINISHED.
                this.executeInstantAction(context);
                break;
            }
        }
    }

    /**
     * Check whether the given instant action is executable.
     *
     * @remarks An instant action that is not executable (e.g. no load at
     * expected position) must be rejected with an error; the action must not be
     * reported as failed.
     *
     * @param action an instant action
     * @returns `true` if action is executable; `false` otherwise
     */
    private _checkInstantActionExecutable(action: Action) {
        const context: ActionContext = {
            action,
            scope: "instant",
            updateActionStatus: undefined,
            activeOrderId: this.hasActiveOrder ? this.currentOrder.orderId : undefined,
        };
        let errorRefs: ErrorReference[] = [];
        let errorType = ErrorType.InstantAction;
        if (action.actionType === "cancelOrder") {
            this.debug("Checking instant action cancelOrder %o", context);
            errorType = ErrorType.InstantActionNoOrderToCancel;
            if (!this.hasActiveOrder) {
                errorRefs.push({ referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "no active order to be canceled" });
            } else if (this.hasCancelingOrder) {
                errorRefs.push({ referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "cancel order already pending" });
            }
        } else if (action.actionType === "stateRequest") {
            this.debug("Checking instant action stateRequest %o", context);
        } else if (action.actionType === "factsheetRequest") {
            this.debug("Checking instant action factsheetRequest %o", context);
        } else {
            this.debug("Invoking isActionExecutable handler on context %o", context);
            errorRefs = this._agvAdapter.isActionExecutable(context);
        }
        if (errorRefs?.length > 0) {
            const error = this._createActionError(context, errorType, "instant action is not executable", errorRefs);
            this.debug("Instant action rejected as it is not executable: %j", error);
            this._instantActionsErroredPublishCount.set(error, 0);
            this._updateState({
                errors: [...this._currentState.errors, error],
            }, true);
            return false;
        }
        return true;
    }

    /* Error Creation */

    private _createOrderError(order: Order, errorType: ErrorType, errorDescription: string, ...errorRefs: ErrorReference[]): Error {
        if (errorType === ErrorType.OrderValidation && !isPlainObject(order)) {
            order = undefined;
        }
        const errorDescriptionDetail = errorRefs.find(r =>
            r.referenceKey === AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL)?.referenceValue;
        const errorReferences: ErrorReference[] = [];
        errorReferences.push({ referenceKey: "topic", referenceValue: Topic.Order });
        if (order?.headerId !== undefined) {
            errorReferences.push({ referenceKey: "headerId", referenceValue: order.headerId.toString() });
        }
        if (order?.orderId !== undefined) {
            errorReferences.push({ referenceKey: "orderId", referenceValue: order.orderId });
        }
        if (order?.orderUpdateId !== undefined) {
            errorReferences.push({ referenceKey: "orderUpdateId", referenceValue: order.orderUpdateId.toString() });
        }
        errorReferences.push(...errorRefs.filter(r => r.referenceKey !== AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL));
        return {
            errorDescription: errorDescriptionDetail ? errorDescription + ": " + errorDescriptionDetail : errorDescription,
            errorLevel: ErrorLevel.Warning,
            errorType,
            errorReferences,
        };
    }

    private _createActionError(context: ActionContext, errorType: ErrorType, errorDescription: string, errorRefs: ErrorReference[]): Error {
        const { action, scope } = context;
        const errorDescriptionDetail = errorRefs.find(r =>
            r.referenceKey === AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL)?.referenceValue;
        // Do not specify "orderId" as error reference even if
        // context.activeOrderId is defined. It is not required by VDA 5050
        // specification and may conflict with an order error reported by
        // createOrderError. Another way to distinguish these two kind of errors
        // is to use of the error type: for order actions it is always
        // ErrorType.OrderAction, as opposed to the error types used in
        // createOrderError.
        errorRefs = [
            { referenceKey: "topic", referenceValue: scope === "instant" ? Topic.InstantActions : Topic.Order },
            { referenceKey: "actionId", referenceValue: action.actionId },
            { referenceKey: "actionType", referenceValue: action.actionType },
            ...errorRefs.filter(r => r.referenceKey !== AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL),
        ];
        return {
            errorDescription: errorDescriptionDetail ? errorDescription + ": " + errorDescriptionDetail : errorDescription,
            errorLevel: ErrorLevel.Warning,
            errorType,
            errorReferences: errorRefs,
        };
    }

    private _createInstantActionsValidationError(instantActions: InstantActions, errorDescription: string): Error {
        if (!isPlainObject(instantActions)) {
            instantActions = undefined;
        }
        const errorReferences: ErrorReference[] = [{ referenceKey: "topic", referenceValue: Topic.InstantActions }];
        if (instantActions?.headerId !== undefined) {
            errorReferences.push({ referenceKey: "headerId", referenceValue: instantActions.headerId.toString() });
        }
        return {
            errorDescription,
            errorLevel: ErrorLevel.Warning,
            errorType: ErrorType.InstantActionValidation,
            errorReferences,
        };
    }
}
