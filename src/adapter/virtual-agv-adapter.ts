/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import {
    Action,
    ActionContext,
    ActionScope,
    ActionStatus,
    ActionStatusChangeInfo,
    AgvAdapter,
    AgvAdapterDebugger,
    AgvAdapterOptions,
    AgvController,
    AgvPosition,
    AttachContext,
    BatteryState,
    BlockingType,
    DetachContext,
    Edge,
    Error,
    ErrorLevel,
    ErrorReference,
    EStop,
    Headerless,
    Load,
    Node,
    NodePosition,
    OperatingMode,
    Optional,
    Order,
    RouteTraversableContext,
    SafetyStatus,
    State,
    StopTraverseContext,
    TraverseEdgeContext,
    Velocity,
} from "..";

/**
 * Represents the internal vehicle state of a virtual AGV.
 *
 * @category AGV Adapter
 */
export interface VirtualAgvState {
    isDriving: boolean;
    isPaused: boolean;
    position: AgvPosition;
    velocity: Velocity;
    batteryState: BatteryState;
    safetyState: SafetyStatus;
    operatingMode: OperatingMode;
    currentLoad: Load;
}

/**
 * Defines all possible states and state transitions of a node, edge, or
 * instant action supported by a virtual AGV.
 *
 * @category AGV Adapter
 */
export interface VirtualActionDefinition {

    /**
     * Type of action.
     */
    actionType: string;

    /**
     * Valid scopes of the action, any combination of `"instant"`, `"node"`, or
     * `"edge"`.
     */
    actionScopes: ActionScope | ActionScope[];

    /**
     * Defines constraint functions for action parameters (optional).
     *
     * To constraint the value of a specific action parameter key-value pair,
     * specify a function that returns `true` if the parameter's actual value is
     * valid; `false` otherwise. If the action parameter key is not specified,
     * `undefined` is passed as action parameter value to the constraint
     * function.
     *
     * An action is only executable if all the specified action parameter
     * constraints are satified.
     */
    actionParameterConstraints?: {
        [actionParameterKey: string]: (
            actionParameterValue: string | number | boolean | any[],
            scope: ActionScope,
            allActionParams: { [actionParameterKey: string]: string | number | boolean | any[] }) => boolean;
    };

    /**
     * Defines a function that is invoked to check whether a given action /
     * scope is executable in the context of an active order, if any (optional).
     *
     * Returns an error description string if action is not executable;
     * `undefined` or empty string otherwise.
     *
     * @remarks This check is performed immediately before the action is
     * executed by the adapter, so it can take the current vehicle state into
     * account.
     */
    actionExecutable?: (action: Action, scope: ActionScope, activeOrderId: string) => string;

    /**
     * Defines all possible states and transitions of an action.
     */
    transitions: VirtualActionTransitions;
}

/**
 * A specification format to define all possible states of an action, its
 * transitions, and side effects.
 *
 * @remarks The action state PAUSED is not part of the format. State transitions
 * from/to this state are handled internally by the adapter.
 *
 * @category AGV Adapter
 */
export type VirtualActionTransitions = {

    /**
     * Defines the initial state (mandatory for all actions).
     */
    ON_INIT: {
        /**
         * The initial status to transition to when the action is being
         * executed.
         *
         * @remarks This transition must always be present. Value must be
         * INITIALIZING or RUNNING for node and edge actions. Value must be
         * INITIALIZING, RUNNING, or FINISHED for instant actions.
         */
        next: ActionStatus.Initializing | ActionStatus.Running | ActionStatus.Finished,
    },

    /**
     * Define status change information for a node or edge action that can be
     * canceled by interrupting an initializing, running or paused action (for
     * interruptable node and edge actions only).
     *
     * After cancelation the action transitions to status FAILED automatically.
     */
    ON_CANCEL?: {
        /**
         * Specifies a function to return a partial state that must be updated
         * when the action is canceled (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    },

    /**
     * Define status change information for an edge action to be terminated (for
     * edge actions only, mandatory for edge actions).
     */
    ON_TERMINATE?: {
        /**
         * The next status to transition to after an edge action has been
         * terminated.
         */
        next: ActionStatus.Finished | ActionStatus.Failed,

        /**
         * Specifies a function to return a partial state that must be updated
         * when the edge action is terminated (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    },

    /**
     * Defines INITIALIZING action status (optional for node, edge, and instant
     * actions).
     */
    [ActionStatus.Initializing]?: {
        /**
         * Time in seconds to stay in this status.
         */
        durationTime: number,

        /**
         * The next status to transition to after the duration time elapses.
         */
        next: ActionStatus.Paused | ActionStatus.Running | ActionStatus.Failed,

        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    },

    /**
     * Defines RUNNING action status (mandatory for node and edge actions,
     * optional for instant actions).
     */
    [ActionStatus.Running]?: {
        /**
         * Time in seconds to stay in this status.
         */
        durationTime: number,

        /**
         * The next status to transition to after the duration time elapses.
         */
        next: ActionStatus.Paused | ActionStatus.Finished | ActionStatus.Failed,

        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    },

    /**
     * Defines FINISHED action status.
     */
    [ActionStatus.Finished]: {
        /**
         * A result reported by invoking the given function in FINISHED action
         * status.
         */
        resultDescription: (context: ActionContext) => string,

        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    },

    /**
     * Defines FAILED action status.
     */
    [ActionStatus.Failed]: {
        /**
         * A FAILED action may report a corresponding error state with an error
         * description reported by invoking the given function (optional).
         *
         * If not specified or if the function returns `undefined` or an empty
         * string, only the action state change is reported, but not an error
         * state.
         */
        errorDescription?: (context: ActionContext) => string,

        /**
         * Specifies a function to return a partial state to be updated when
         * this status is entered (optional).
         */
        linkedState?: (context: ActionContext) => Partial<Headerless<State>>;
    },
};

/**
 * Defines configuration options of the `VirtualAgvAdapter`.
 *
 * @category AGV Adapter
 */
export interface VirtualAgvAdapterOptions extends AgvAdapterOptions {

    /**
     * The initial position of the virtual AGV when it is instantiated.
     *
     * Position coordinates are relative to the world coordinate system using a
     * map with the given mapId. Theta defines the initial orientation in the
     * range [-Pi ... Pi].
     *
     * If not specified, the position defaults to `{ mapId: "local", x: 0, y: 0,
     * theta: 0 }`.
     */
    initialPosition?: { mapId: string, x: number, y: number, theta: number };

    /**
     * Specifies the AGV's normal deviation x/y tolerance (in meter) if no
     * deviation is allowed, i.e. if `NodePosition.allowedDeviationXy` is 0 or
     * not specified.
     *
     * If not specified, value defaults to 0.5 meter.
     */
    agvNormalDeviationXyTolerance?: number;

    /**
     * Specifies the AGV's normal deviation theta tolerance (in radian) if no
     * deviation is allowed, i.e. if `NodePosition.allowedDeviationTheta` is 0
     * or not specified.
     *
     * If not specified, value defaults to 0,349066 radians (20 degree).
     */
    agvNormalDeviationThetaTolerance?: number;

    /**
     * The target driving speed of the AGV measured in meter per second
     * (optional).
     *
     * If not specified, value defaults to 2 m/s.
     *
     * @remarks A virtual AGV is assumed to have the same forward and cornering
     * speed, as well as infinite acceleration and deceleration. If the
     * specified speed is greater than the maximum speed on a order's edge the
     * speed is adjusted accordingly.
     *
     * @remarks The options `vehicleSpeed`, `vehicleSpeedDistribution`, and
     * `vehicleTimeDistribution` are mutually exclusive. Specify at most one of
     * them. If none is specified, the default value of the option
     * `vehicleSpeed` is applied.
     */
    vehicleSpeed?: number;

    /**
     * The driving speed distribution function of the AGV returning a series of
     * independent, identically distributed random speed values (measured in
     * meter per second) from a given distribution (optional).
     *
     * The driving speed can follow a probabilistic distribution such as a
     * Normal (Gaussian) or Poisson distribution. The given function is invoked
     * once per edge to yield the target speed of the AGV while traversing the
     * edge.
     *
     * The first value of the returned tuple is the random target speed; the
     * second one is the constant mean value of the speed distribution.
     *
     * @remarks The options `vehicleSpeed`, `vehicleSpeedDistribution`, and
     * `vehicleTimeDistribution` are mutually exclusive. Specify at most one of
     * them. If none is specified, the default value of the option
     * `vehicleSpeed` is applied.
     */
    vehicleSpeedDistribution?: () => [number, number];

    /**
     * The driving time distribution function of the AGV returning a series of
     * independent, identically distributed random time values (measured in
     * second) from a given distribution (optional).
     *
     * The driving time can follow a probabilistic distribution such as a Normal
     * (Gaussian) or Poisson distribution. The given function is invoked once
     * per edge to yield the target time of the AGV for traversing the edge.
     *
     * The first value of the returned tuple is the random target time for
     * traversing an edge; the second one is the constant mean value of the
     * driving time distribution.
     *
     * @remarks The options `vehicleSpeed`, `vehicleSpeedDistribution`, and
     * `vehicleTimeDistribution` are mutually exclusive. Specify at most one of
     * them. If none is specified, the default value of the option
     * `vehicleSpeed` is applied.
     */
    vehicleTimeDistribution?: () => [number, number];

    /**
     * Capacity of the AGV's battery measured in ampere hours (Ah) (optional).
     *
     * If not specified, value defaults to 100 Ah.
     */
    batteryCapacity?: number;

    /**
     * Maximum reach in meter of an AGV with a fully charged battery with the
     * capacity specified by option `batteryCapacity` (optional).
     *
     * @remarks This option doesn't take the actual speed of the AGV into
     * account. To keep it simple it is just a rough approximation of the real
     * physics.
     *
     * If not specified, value defaults to 28800 meter (i.e. 4 hours travel time
     * at a speed of 2m/s).
     */
    batteryMaxReach?: number;

    /**
     * Initial battery state of charge as a percentage number between 0 and 100
     * (optional).
     *
     * If not specified, value defaults to 100 percent.
     */
    initialBatteryCharge?: number;

    /**
     * Time in hours to charge an empty battery to 100% (optional).
     *
     * If not specified, value defaults to 1 hour.
     */
    fullBatteryChargeTime?: number;

    /**
     * State of charge value in percent below which the AGV stops driving and
     * and reports a corresponding error state with error type
     * `"batteryLowError"` and error level FATAL.
     *
     * @remarks While charging `"batteryLowError"` is removed from state again
     * as soon as charge advances 10% above this threshold.
     *
     * If not specified, value defaults to 1 percent.
     */
    lowBatteryChargeThreshold?: number;

    /**
     * Rate in ticks per second at which periodic motion and state updates are
     * triggered internally (optional).
     *
     * If not specified, value defaults to 5 ticks/sec.
     */
    tickRate?: number;

    /**
     * Factor by which vehicle motion and execution of actions is speeded up
     * (optional).
     *
     * If not specified, the value defaults to 1, i.e. no time lapse mode is
     * active.
     *
     * @remarks Useful to speed up order execution in simulation and test
     * environments.
     */
    timeLapse?: number;
}

/**
 * An AGV adapter that implements a virtual AGV supporting free autonomous
 * navigation along edges, and a basic, yet extensible set of actions.
 *
 * This adapter is meant to be used as a template for realizing your own
 * adapter, for simulation purposes, integration testing, and in other kind of
 * environments where real AGVs are not available or must be mocked.
 *
 * The following actions are supported:
 * - pick/drop [node],
 * - initPosition [instant, node]
 * - startPause/stopPause [instant]
 * - startCharging/stopCharging [instant, node]
 * - cancelOrder [instant, supported by AgvController]
 * - stateRequest [instant, supported by AgvController]
 * - orderExecutionTime [instant (custom)]
 *
 * @remarks To be executable by the virtual AGV an order must specify
 * `nodePosition` for all nodes except for the first one as VDA 5050 requires
 * the vehicle to be already positioned on the first node (within a given
 * deviation range). The property `nodeId` alone is not usable as a symbolic
 * position.
 *
 * @remarks On initialization, the virtual AGV is positioned at `{ x: 0, y: 0,
 * theta: 0}` relative to a map with mapId `local`. You can override or reset
 * this pose using the instant or node action `initPosition`, specifying `x`,
 * `y`, `theta`, `mapId`, `lastNodeId`, and `lastNodeSequenceId` (optional,
 * defaults to
 * 0) as action parameters.
 *
 * @remarks The virtual AGV provides a constant safety state where no e-stop is
 * activated and where the protective field is never violated. The operating
 * mode of the virtual AGV is always automatic, i.e. it is fully controlled by
 * master control.
 *
 * @remarks The virtual AGV can only pick and carry one load at a time. Before
 * picking another load the current load must have been dropped.
 *
 * @remarks A charging action is executed on a charging spot while the vehicle
 * is standing, either as an instant action or as a node action. Charging mode
 * is either terminated explicitely by action stopCharging or automatically when
 * the battery is fully charged.
 *
 * @remarks The AGV's remaining battery reach is reported in the
 * `State.batteryState` property unless the vehicle time distribution mode is
 * active according to the option `vehicleTimeDistribution`. When the AGV's
 * battery runs low according to the option `lowBatteryChargeThreshold` it stops
 * driving and reports an error of type `"batteryLowError"`. The master control
 * must then initiate further actions, e.g. cancel any active order or start
 * charging. The battery low error is removed from State as soon as battery
 * charge advances 10% above the configured threshold.
 *
 * @remarks The custom action `orderExecutionTime` expects an action parameter
 * key `orders` with an array of VDA 5050 headerless Order objects as parameter
 * value. The action finishes immediately reporting the estimated order
 * execution times in seconds as values in a comma-separated string format via
 * the `resultDescription` of the corresponding action state. The calculated
 * estimates include the effective duration of action processing on the order's
 * nodes (taking action blocking types and concurrent actions into account) as
 * well as the travel time on the order's edges, including both base and horizon
 * nodes and edges.
 *
 * @remarks To support benchmarking and performance measurement based on
 * statistics the virtual AGV also supports probabilistic distribution of
 * driving speed or driving time by corresponding adapter options.
 *
 * @category AGV Adapter
 */
export class VirtualAgvAdapter implements AgvAdapter {

    private readonly _controller: AgvController;
    private readonly _options: Required<VirtualAgvAdapterOptions>;
    private readonly _actionStateMachines: VirtualActionStateMachine[];
    private _vehicleState: VirtualAgvState;
    private _tick: number;
    private _tickIntervalId: any;
    private _traverseContext: TraverseEdgeContext;
    private _batteryLowError: Error;

    constructor(
        controller: AgvController,
        adapterOptions: VirtualAgvAdapterOptions,
        public readonly debug: AgvAdapterDebugger) {
        this._controller = controller;
        this._options = this._optionsWithDefaults(adapterOptions);
        this._actionStateMachines = [];
        this.debug("Create instance for apiVersion %d with adapterOptions %o", this.apiVersion, this.options);
    }

    /**
     * Gets the Virtual AGV adapter configuration options as a readonly object
     * with default values filled in for options not specified in the
     * configuration.
     */
    get options(): Readonly<Required<VirtualAgvAdapterOptions>> {
        return this._options;
    }

    /* Interface AgvAdapter */

    get controller() {
        return this._controller;
    }

    get name() {
        return "VirtualAgvAdapter";
    }

    get apiVersion() {
        return 1;
    }

    attach(context: AttachContext) {
        if (this._vehicleState === undefined) {
            this._vehicleState = {
                isDriving: false,
                isPaused: false,
                position: { positionInitialized: true, ...this.options.initialPosition },
                velocity: { omega: 0, vx: 0, vy: 0 },
                batteryState: {
                    batteryCharge: this.options.initialBatteryCharge,
                    batteryVoltage: 24.0,
                    charging: false,
                    reach: this.getBatteryReach(this.options.initialBatteryCharge),
                },
                safetyState: { eStop: EStop.None, fieldViolation: false },
                operatingMode: OperatingMode.Automatic,
                currentLoad: undefined,
            };
        }

        this._tick = 0;
        const tickInterval = 1000 / this.options.tickRate;
        let realTime = Date.now();
        this._tickIntervalId = setInterval(() => {
            const now = Date.now();
            const realInterval = now - realTime;
            realTime = now;
            this._onTick(++this._tick, tickInterval * this.options.timeLapse, realInterval * this.options.timeLapse / 1000);
        }, tickInterval);

        context.attached({
            agvPosition: this._vehicleState.position,
            velocity: this._vehicleState.velocity,
            batteryState: this._vehicleState.batteryState,
            driving: this._vehicleState.isDriving,
            operatingMode: this._vehicleState.operatingMode,
            paused: this._vehicleState.isPaused,
            safetyState: this._vehicleState.safetyState,
        });
    }

    detach(context: DetachContext) {
        clearInterval(this._tickIntervalId);
        context.detached({});
    }

    executeAction(context: ActionContext) {
        const { action, scope, activeOrderId, stopDriving } = context;
        const actionDef = this._getActionDefinition(action, scope);
        if (actionDef.actionExecutable !== undefined) {
            const errorDescription = actionDef.actionExecutable(action, scope, activeOrderId);
            if (!!errorDescription) {
                context.updateActionStatus({
                    actionStatus: ActionStatus.Failed,
                    errorDescription,
                });
                return;
            }
        }
        if (stopDriving && this._vehicleState.isDriving) {
            this.stopDriving(true);
        }
        const asm = new VirtualActionStateMachine(
            context,
            actionDef,
            () => this._finalizeAction(asm),
            (formatter: any, ...args: any[]) => this.debug(formatter, ...args),
            action.actionType === "stopPause" || action.actionType === "startPause" ? false : this._vehicleState.isPaused);
        // Start action on next tick.
        this._actionStateMachines.push(asm);
    }

    finishEdgeAction(context: ActionContext) {
        const asm = this._actionStateMachines.find(sm => sm.matches(context.action.actionId, context.scope));
        if (asm) {
            // Finish edge action on next tick.
            asm.terminate();
        }
    }

    cancelAction(context: ActionContext) {
        const asm = this._actionStateMachines.find(sm => sm.matches(context.action.actionId, context.scope));
        if (asm) {
            // Cancel action on next tick.
            asm.cancel();
        }
    }

    isActionExecutable(context: ActionContext): ErrorReference[] {
        const { action, scope } = context;
        const errorRefs: ErrorReference[] = [];
        const actionDef = this._getActionDefinition(action, scope);
        if (!actionDef) {
            errorRefs.push({ referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "not supported" });
        } else if (actionDef.actionParameterConstraints !== undefined) {
            const allActionParams = Object.fromEntries(action.actionParameters?.map(p => ([p.key, p.value])) ?? []);
            Object.keys(actionDef.actionParameterConstraints).forEach(key => {
                const constraints = actionDef.actionParameterConstraints[key];
                const actionParam = action.actionParameters?.find(p => p.key === key);
                if (!constraints(actionParam?.value, scope, allActionParams)) {
                    errorRefs.push({ referenceKey: "actionParameter", referenceValue: key });
                }
            });
            if (errorRefs.length > 0) {
                errorRefs.push({ referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "invalid actionParameter" });
            }
        }
        return errorRefs;
    }

    isNodeWithinDeviationRange(node: Node): ErrorReference[] {
        const errorRefs: ErrorReference[] = [];
        if (!node.nodePosition) {
            // If no node or AGV position is given, assume the node is within
            // deviation range. This also ensures that an order issued without
            // knowing the current position of the AGV is accepted.
            return errorRefs;
        }
        const { allowedDeviationTheta, allowedDeviationXy, mapId, theta, x, y } = node.nodePosition;
        const { mapId: agvMapId, theta: agvTheta, x: agvX, y: agvY } = this._vehicleState.position;
        if (mapId !== agvMapId) {
            errorRefs.push({ referenceKey: "nodeId", referenceValue: node.nodeId });
            errorRefs.push({ referenceKey: "nodePosition.mapId", referenceValue: agvMapId });
        }
        const allowedXy = allowedDeviationXy || this.options.agvNormalDeviationXyTolerance;
        if ((agvX - x) ** 2 + (agvY - y) ** 2 > allowedXy ** 2) {
            errorRefs.push({ referenceKey: "nodePosition.allowedDeviationXy", referenceValue: allowedXy.toString() });
        }
        if (theta === undefined) {
            // Vehicle can plan the path by itself.
            return errorRefs;
        }
        const allowedTheta = allowedDeviationTheta || this.options.agvNormalDeviationThetaTolerance;
        if (Math.abs(agvTheta - theta) > allowedTheta) {
            errorRefs.push({ referenceKey: "nodePosition.allowedDeviationTheta", referenceValue: allowedTheta.toString() });
        }
        return errorRefs;
    }

    isRouteTraversable(context: RouteTraversableContext): ErrorReference[] {
        const errorRefs: ErrorReference[] = [];

        // Check if all node positions are specified except for the first node.
        // When executing the order or calculating the order execution time, the
        // controller ensures that the AGV is already positioned on the first
        // node (within a given deviation range).
        for (let i = 0; i < context.nodes.length; i++) {
            const node = context.nodes[i];
            if (node.nodePosition === undefined && i > 0) {
                errorRefs.push(
                    { referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "missing nodePosition" },
                    { referenceKey: "nodeId", referenceValue: node.nodeId },
                    { referenceKey: "nodePosition", referenceValue: "undefined" });
                break;
            } else if (node.nodePosition && node.nodePosition.mapId !== this._vehicleState.position.mapId) {
                errorRefs.push(
                    { referenceKey: AgvController.REF_KEY_ERROR_DESCRIPTION_DETAIL, referenceValue: "incorrect mapId" },
                    { referenceKey: "nodeId", referenceValue: node.nodeId },
                    { referenceKey: "nodePosition.mapId", referenceValue: this._vehicleState.position.mapId });
                break;
            }
        }

        return errorRefs;
    }

    /**
     * Traverses the given edge using a basic free navigation algorithm where the
     * AGV drives with constant speed on a straight line from the edge's start point
     * to the edge's end point. This algorithm ignores obstacle detection and
     * collision avoidance.
     */
    traverseEdge(context: TraverseEdgeContext) {
        this._traverseContext = context;
    }

    stopTraverse(context: StopTraverseContext) {
        this._traverseContext = undefined;
        this._vehicleState.isDriving && this.stopDriving(true);
        this._vehicleState.isPaused && this._stopPause();
        context.stopped();
    }

    /* Protected methods to be accessed and overwritten by subclasses */

    /**
     * Gets the vehicle state as a readonly object.
     */
    protected get vehicleState(): Readonly<VirtualAgvState> {
        return this._vehicleState;
    }

    /**
     * Gets the default set of action definitions supported by the virtual AGV.
     *
     * @remarks Can be overwritten or extended by subclasses.
     */
    protected get actionDefinitions(): VirtualActionDefinition[] {
        return [
            {
                actionType: "pick",
                actionScopes: "node",
                actionParameterConstraints: {
                    // Station is a floor location.
                    stationType: (value: string) => value && value.startsWith("floor"),

                    // Can only lift EUR/EPAL-pallets.
                    loadType: (value: string) => value === "EPAL",
                },
                // AGV can only pick and carry one load at a time.
                actionExecutable: () => this._vehicleState.currentLoad ? "load already picked" : "",
                transitions: {
                    ON_INIT: { next: ActionStatus.Initializing },
                    ON_CANCEL: {},

                    // Initializing of the pick process, e.g. outstanding lift operations.
                    [ActionStatus.Initializing]: { durationTime: 5, next: ActionStatus.Running },

                    // The pick process is running.
                    [ActionStatus.Running]: { durationTime: 5, next: ActionStatus.Finished },

                    // Pick is done. Load has entered the AGV and AGV reports new load state.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "pick action finished",
                        linkedState: () => this._loadAdded(),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "pick action failed",
                    },
                },
            },
            {
                actionType: "drop",
                actionScopes: "node",
                actionParameterConstraints: {
                    // Station is a floor location.
                    stationType: (value: string) => value && value.startsWith("floor"),

                    // Can only lift EUR/EPAL-pallets.
                    loadType: (value: string) => value === "EPAL",
                },
                actionExecutable: () => this._vehicleState.currentLoad ? "" : "no load to drop",
                transitions: {
                    ON_INIT: { next: ActionStatus.Initializing },
                    ON_CANCEL: {},

                    // Initializing of the drop process, e.g. outstanding lift operations.
                    [ActionStatus.Initializing]: { durationTime: 5, next: ActionStatus.Running },

                    // The drop process is running.
                    [ActionStatus.Running]: { durationTime: 5, next: ActionStatus.Finished },

                    // Drop is done. Load has left the AGV and AGV reports new load state.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "drop action finished",
                        linkedState: () => this._loadRemoved(),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "drop action failed",
                    },
                },
            },
            {
                // Initialize AGV position as instant action.
                // Change AVG position on node (elevator use case).
                actionType: "initPosition",
                actionScopes: ["instant", "node"],
                actionParameterConstraints: {
                    x: (value: number) => typeof value === "number",
                    y: (value: number) => typeof value === "number",
                    theta: (value: number) => typeof value === "number",
                    mapId: (value: string) => typeof value === "string",
                    lastNodeId: (value: string) => typeof value === "string",
                    lastNodeSequenceId: (value: number) => value === undefined ? true : typeof value === "number",
                },
                transitions: {
                    ON_INIT: { next: ActionStatus.Finished },
                    ON_CANCEL: {},

                    // Resets (overrides) the pose of the AGV with the given paramaters.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "Position initialized",
                        linkedState: context => this._initPosition(context.action),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "initPosition action failed",
                    },
                },
            },
            {
                // Activates the pause mode. No more AGV driving movements - reaching next
                // node is not necessary. Actions can continue lateron. Order is resumable.
                actionType: "startPause",
                actionScopes: "instant",
                actionExecutable: () => this._vehicleState.isPaused ? "already paused" : "",
                transitions: {
                    ON_INIT: { next: ActionStatus.Finished },

                    // Vehicle stands still. All actions will be paused. The pause mode is
                    // activated. The AGV reports paused state.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "Paused",
                        linkedState: context => this._startPause(context),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "startPause action failed",
                    },
                },
            },
            {
                // Deactivates the pause mode. Movement and all other actions will be
                // resumed (if any).
                actionType: "stopPause",
                actionScopes: "instant",
                actionExecutable: () => this._vehicleState.isPaused ? "" : "not yet paused",
                transitions: {
                    ON_INIT: { next: ActionStatus.Finished },

                    // All paused actions will be resumed. The pause mode is deactivated. The
                    // AGV reports unpaused state.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "Unpaused",
                        linkedState: context => this._stopPause(context),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "stopPause action failed",
                    },
                },
            },
            {
                // Activates the charging process on a node or at the current position.
                // Charging is done on a charging spot (vehicle standing). Protection
                // against overcharging is handled by the vehicle.
                actionType: "startCharging",
                actionScopes: ["instant", "node"],
                actionExecutable: (action, scope, activeOrderId) => this._vehicleState.batteryState.charging ?
                    "charging already in progress" :
                    activeOrderId && scope === "instant" ? "charging denied as order is in progress" : "",
                transitions: {
                    ON_INIT: { next: ActionStatus.Running },
                    ON_CANCEL: {},

                    // Activation of the charging process is in progress (communication with charger is running).
                    [ActionStatus.Running]: { durationTime: 5, next: ActionStatus.Finished },

                    // The charging process is started. The AGV reports active charging state.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "Started charging",
                        linkedState: () => this._startCharging(),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "startCharging action failed",
                    },
                },
            },
            {
                // Deactivates the charging process to send a new order. The charging process is
                // automatically stopped when the battery is full. Battery charging state is
                // only allowed to be "false" when AGV is ready to receive orders.
                actionType: "stopCharging",
                actionScopes: ["instant", "node"],
                actionExecutable: () => this._vehicleState.batteryState.charging ? "" : "charging not in progress",
                transitions: {
                    ON_INIT: { next: ActionStatus.Running },
                    ON_CANCEL: {},

                    // Deactivation of the charging process is in progress (communication with charger is running).
                    [ActionStatus.Running]: { durationTime: 5, next: ActionStatus.Finished },

                    // The charging process is stopped. The AGV reports inactive charging state.
                    [ActionStatus.Finished]: {
                        resultDescription: () => "Stopped charging",
                        linkedState: () => this._stopCharging(),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "startCharging action failed",
                    },
                },
            },
            {
                // Custom action to yield estimated order execution time.
                actionType: "orderExecutionTime",
                actionScopes: "instant",
                actionParameterConstraints: {
                    orders: (value: Array<Headerless<Order>>) => Array.isArray(value),
                },
                transitions: {
                    ON_INIT: { next: ActionStatus.Finished },

                    // Return calculated result for all the orders specified in action parameter "orders".
                    [ActionStatus.Finished]: {
                        resultDescription: context => this._calculateEstimatedOrderExecutionTimes(context.action),
                    },

                    [ActionStatus.Failed]: {
                        errorDescription: () => "orderExecutionTime action failed",
                    },
                },
            },
        ];
    }

    /**
     * Vehicle starts driving with the given velocity.
     *
     * @param vx velocity in x direction
     * @param vy velocity in y direction
     * @param reportImmediately true if velocity update should be reported
     * immediately; false otherwise
     */
    protected startDriving(vx: number, vy: number, reportImmediately = false) {
        this._vehicleState.isDriving = true;
        this._vehicleState.velocity.vx = vx;
        this._vehicleState.velocity.vy = vy;
        this.controller.updateDrivingState(true);
        this.controller.updateAgvPositionVelocity(undefined, this._vehicleState.velocity, reportImmediately);
        this.debug("start driving");
    }

    /**
     * Vehicle stops driving.
     *
     * @param reportImmediately true if velocity update should be reported
     * immediately; false otherwise
     */
    protected stopDriving(reportImmediately = false) {
        this._vehicleState.isDriving = false;
        this._vehicleState.velocity.vx = 0;
        this._vehicleState.velocity.vy = 0;
        this.controller.updateDrivingState(false);
        this.controller.updateAgvPositionVelocity(undefined, this._vehicleState.velocity, reportImmediately);
        this.debug("stop driving");
    }

    /**
     * Gets duration of given action in seconds.
     *
     * @param action an order action
     * @returns duration of action (in seconds)
     */
    protected getNodeActionDuration(action: Action) {
        const actionDef = this._getActionDefinition(action, "node");
        let duration = 0;
        let state = actionDef.transitions.ON_INIT.next as ActionStatus;
        while (state !== ActionStatus.Finished && state !== ActionStatus.Failed) {
            const transition = actionDef.transitions[state];
            if ("durationTime" in transition) {
                duration += transition.durationTime;
            }
            state = transition.next;
        }
        return duration;
    }

    /**
     * Gets target speed of vehicle depending on related adapter options.
     *
     * @param useMean whether to use the constant mean speed or the random speed
     * if a driving speed or time distribution has been specified in the adapter
     * options; otherwise this parameter is ignored
     * @param distance the target distance to travel; only used if driving time
     * distribution has been specified in the adapter options
     * @param maxSpeed a speed limit that must not be exceeded (optional, only
     * used if no driving distribution function has been specified in the
     * adapter options)
     * @returns target speed of vehicle depending on the given parameters and
     * adapter options
     */
    protected getTargetSpeed(useMean = false, distance: number, maxSpeed?: number) {
        if (this.options.vehicleSpeedDistribution) {
            return this.options.vehicleSpeedDistribution()[useMean ? 1 : 0];
        } else if (this.options.vehicleTimeDistribution) {
            return distance / this.options.vehicleTimeDistribution()[useMean ? 1 : 0];
        } else {
            return maxSpeed === undefined ? this.options.vehicleSpeed : Math.min(maxSpeed, this.options.vehicleSpeed);
        }
    }

    /**
     * Determines whether the given order could be executed potentially by
     * checking whether the order route is traversable and all node actions are
     * potentially executable.
     *
     * @param nodes nodes of order
     * @param edges edges of order
     * @returns true if order can be executed potentially; false otherwise
     */
    protected canExecuteOrder(nodes: Node[], edges: Edge[]) {
        let errorRefs = this.isRouteTraversable({ nodes, edges });
        if (errorRefs && errorRefs.length > 0) {
            return false;
        }

        for (const node of nodes) {
            for (const action of node.actions) {
                const context: ActionContext = {
                    action,
                    scope: "node",
                    updateActionStatus: undefined,
                    node,
                };
                errorRefs = this.isActionExecutable(context);
                if (errorRefs && errorRefs.length > 0) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Updates battery state of vehicle according to the given travel distance.
     *
     * @param dx distance travelled in x direction
     * @param dy distance travelled in y direction
     */
    protected updateBatteryState(dx: number, dy: number) {
        // Assume state of charge decreases linearly with distance travelled.
        const dist = Math.sqrt(dx * dx + dy * dy);
        const { batteryCharge } = this._vehicleState.batteryState;
        this._vehicleState.batteryState.batteryCharge = Math.max(0, batteryCharge - (dist * 100 / this.options.batteryMaxReach));
        this._vehicleState.batteryState.reach = this.getBatteryReach(this._vehicleState.batteryState.batteryCharge);
        this.controller.updateBatteryState(this._vehicleState.batteryState);
    }

    /**
     * Gets battery reach of vehicle for the given state of charge.
     *
     * @param charge battery state of charge (in percent)
     * @returns battery reach according to given state of charge
     */
    protected getBatteryReach(charge: number) {
        // Assuming battery reach and battery charge are proportional.
        return Math.floor(this.options.batteryMaxReach * charge / 100);
    }

    /* Private */

    private _optionsWithDefaults(options: VirtualAgvAdapterOptions): Required<VirtualAgvAdapterOptions> {
        const optionalDefaults: Required<Optional<VirtualAgvAdapterOptions>> = {
            initialPosition: { mapId: "local", x: 0, y: 0, theta: 0 },
            agvNormalDeviationXyTolerance: 0.5,
            agvNormalDeviationThetaTolerance: 0.349066,
            vehicleSpeed: 2,
            vehicleSpeedDistribution: undefined,
            vehicleTimeDistribution: undefined,
            batteryCapacity: 100,
            batteryMaxReach: 28800,
            initialBatteryCharge: 100,
            fullBatteryChargeTime: 1,
            lowBatteryChargeThreshold: 1,
            tickRate: 5,
            timeLapse: 1,
        };
        return Object.assign(optionalDefaults, options);
    }

    private _getActionDefinition(action: Action, scope: ActionScope) {
        return this.actionDefinitions.find(d =>
            d.actionType === action.actionType &&
            (d.actionScopes === scope || d.actionScopes.includes(scope)));
    }

    private _finalizeAction(asm: VirtualActionStateMachine) {
        this._actionStateMachines.splice(this._actionStateMachines.indexOf(asm), 1);
    }

    /* Tick-based execution of actions, motion */

    private _onTick(tick: number, tickInterval: number, realInterval: number) {
        // Advance all active action state machines, updating action state.
        for (const asm of this._actionStateMachines) {
            asm.tick(tick, tickInterval, realInterval);
        }

        // Advance edge traversal, updating vehicle state.
        this._advanceTraverse(realInterval);

        // Advance battery charging.
        this._advanceBatteryCharge(tick, tickInterval, realInterval);
    }

    private _advanceTraverse(realInterval: number) {
        if (!this._traverseContext || this._vehicleState.isPaused || this._vehicleState.batteryState.charging) {
            return;
        }

        const traverseContext = this._traverseContext;
        const endNodePosition = traverseContext.endNode.nodePosition;
        const tx = endNodePosition.x - this._vehicleState.position.x;
        const ty = endNodePosition.y - this._vehicleState.position.y;
        const alpha = Math.atan2(ty, tx);

        if (!this._vehicleState.isDriving) {
            if (this._vehicleState.batteryState.batteryCharge < this.options.lowBatteryChargeThreshold) {
                return;
            }
            const targetDistance = Math.sqrt(tx ** 2 + ty ** 2);
            const targetSpeed = this.getTargetSpeed(false, targetDistance, traverseContext.edge.maxSpeed);
            this.startDriving(Math.cos(alpha) * targetSpeed, Math.sin(alpha) * targetSpeed, true);
        } else {
            const dx = this._vehicleState.velocity.vx * realInterval;
            const dy = this._vehicleState.velocity.vy * realInterval;

            if (Math.abs(tx) <= Math.abs(dx) && Math.abs(ty) <= Math.abs(dy)) {
                this._vehicleState.position.x = endNodePosition.x;
                this._vehicleState.position.y = endNodePosition.y;
                this._vehicleState.position.theta = endNodePosition.theta ?? this._vehicleState.position.theta;
                this.updateBatteryState(tx, ty);
                this.controller.updateAgvPositionVelocity(this._vehicleState.position);
                this.stopDriving(true);
                this._traverseContext = undefined;
                traverseContext.edgeTraversed();
            } else {
                const isBatteryLow = this._vehicleState.batteryState.batteryCharge < this.options.lowBatteryChargeThreshold;
                this._vehicleState.position.x += dx;
                this._vehicleState.position.y += dy;
                this._vehicleState.position.theta = traverseContext.edge.orientation ?? alpha;
                this.updateBatteryState(dx, dy);
                this.controller.updateAgvPositionVelocity(this._vehicleState.position);

                if (isBatteryLow) {
                    this.debug("low battery charge %d", this._vehicleState.batteryState.batteryCharge);
                    this.stopDriving();
                    // Report an error that is reverted on charging (see _advanceBatteryCharge).
                    this._batteryLowError = {
                        errorDescription: "stop driving due to low battery",
                        errorLevel: ErrorLevel.Fatal,
                        errorType: "batteryLowError",
                        errorReferences: [
                            {
                                referenceKey: "batteryState.batteryCharge",
                                referenceValue: this._vehicleState.batteryState.batteryCharge.toString(),
                            },
                        ],
                    };
                    this.controller.updateErrors(this._batteryLowError, "add", true);
                }
            }
        }
    }

    private _advanceBatteryCharge(tick: number, tickInterval: number, realInterval: number) {
        if (!this._vehicleState.batteryState.charging || this._vehicleState.isPaused) {
            return;
        }

        // Assume state of charge increases linearly with charging time.
        const chargeRate = 100 / 3600 / this.options.fullBatteryChargeTime;
        const currentCharge = this._vehicleState.batteryState.batteryCharge;
        const deltaCharge = chargeRate * realInterval;
        const newCharge = Math.min(100, currentCharge + deltaCharge);
        const isFullyCharged = newCharge > 99;

        // Update charge and reach.
        this._vehicleState.batteryState.batteryCharge = newCharge;
        this._vehicleState.batteryState.reach = this.getBatteryReach(newCharge);

        // Remove batteryLowError from state as soon as charge is 10% above threshold.
        let batteryLowError: Error;
        if (this._batteryLowError && this._vehicleState.batteryState.batteryCharge >= this.options.lowBatteryChargeThreshold + 10) {
            batteryLowError = this._batteryLowError;
            this._batteryLowError = undefined;
        }

        // Report state of charge updates with low frequency (in steps of 1%).
        const updateTicks = Math.ceil(1000 / chargeRate / tickInterval);
        if (tick % updateTicks === 0) {
            batteryLowError && this.controller.updateErrors(batteryLowError, "remove");
            this.controller.updateBatteryState(this._vehicleState.batteryState, !isFullyCharged);
        }

        if (isFullyCharged) {
            this.controller.updatePartialState(this._stopCharging(), true);
        }
    }

    /* Action transition side effects */

    private _loadAdded(): Partial<Headerless<State>> {
        this._vehicleState.currentLoad = {
            loadId: "RFID_" + this.controller.createUuid(),
            loadType: "EPAL",
            loadDimensions: { width: 1, height: 1, length: 1 },
            weight: 10 + 10 * Math.random(),
        };
        this.debug("picked load", this._vehicleState.currentLoad);
        return {
            loads: [this._vehicleState.currentLoad],
        };
    }

    private _loadRemoved(): Partial<Headerless<State>> {
        this.debug("dropped load", this._vehicleState.currentLoad);
        this._vehicleState.currentLoad = undefined;
        return {
            loads: [],
        };
    }

    private _initPosition(action: Action): Partial<Headerless<State>> {
        this._vehicleState.position.x = action.actionParameters.find(p => p.key === "x").value as number;
        this._vehicleState.position.y = action.actionParameters.find(p => p.key === "y").value as number;
        this._vehicleState.position.theta = action.actionParameters.find(p => p.key === "theta").value as number;
        this._vehicleState.position.mapId = action.actionParameters.find(p => p.key === "mapId").value as string;
        const lastNodeId = action.actionParameters.find(p => p.key === "lastNodeId").value as string;
        const lastNodeSequenceId = action.actionParameters.find(p => p.key === "lastNodeSequenceId")?.value as number;

        this.debug("init position %o with lastNodeId %s and lastNodeSequenceId %d",
            this._vehicleState.position, lastNodeId, lastNodeSequenceId);

        return {
            agvPosition: this._vehicleState.position,
            lastNodeId,
            lastNodeSequenceId: lastNodeSequenceId ?? 0,
        };
    }

    private _startPause(context: ActionContext): Partial<Headerless<State>> {
        if (this._vehicleState.isPaused) {
            return undefined;
        }
        // Vehicle must stand still.
        if (this._vehicleState.isDriving) {
            this.stopDriving();
        }
        this.debug("start pause");
        this._vehicleState.isPaused = true;
        // Pause all actions except this one.
        for (const asm of this._actionStateMachines) {
            if (asm.actionContext !== context) {
                asm.pause();
            }
        }
        return { paused: true };
    }

    private _stopPause(context?: ActionContext): Partial<Headerless<State>> {
        if (!this._vehicleState.isPaused) {
            return undefined;
        }
        this.debug("stop pause");
        this._vehicleState.isPaused = false;

        if (context !== undefined) {
            // Unpause all actions except this one.
            for (const asm of this._actionStateMachines) {
                if (asm.actionContext !== context) {
                    asm.unpause();
                }
            }
            return { paused: false };
        } else {
            this.controller.updatePausedState(false, true);
        }
    }

    private _startCharging(): Partial<Headerless<State>> {
        if (this._vehicleState.batteryState.charging) {
            return undefined;
        }
        // Charging is done on a charging spot (vehicle standing).
        if (this._vehicleState.isDriving) {
            this.stopDriving();
        }
        this.debug("start charging");
        this._vehicleState.batteryState.charging = true;
        return { batteryState: this._vehicleState.batteryState };
    }

    private _stopCharging(): Partial<Headerless<State>> {
        if (!this._vehicleState.batteryState.charging) {
            return undefined;
        }
        this.debug("stop charging");
        this._vehicleState.batteryState.charging = false;
        return { batteryState: this._vehicleState.batteryState };
    }

    private _calculateEstimatedOrderExecutionTimes(action: Action) {
        const orders = action.actionParameters.find(p => p.key === "orders").value as Array<Headerless<Order>>;
        const results: string[] = [];
        let currentNodePosition = this._vehicleState.position as NodePosition;
        try {
            for (const order of orders) {
                if (!this.canExecuteOrder(order.nodes, order.edges)) {
                    throw new Error("order is not executable");
                }
                results.push(this._calculateEstimatedOrderExecutionTime(order, currentNodePosition).toString());
                currentNodePosition = order.nodes[order.nodes.length - 1].nodePosition;
            }
        } catch {
            results.splice(0, results.length);
        }
        this.debug("calculated estimated order execution times: %o", results);
        return results.join(",");
    }

    private _calculateEstimatedOrderExecutionTime(order: Headerless<Order>, currentNodePosition: NodePosition): number {
        let effectiveActionDuration = 0;
        for (const node of order.nodes) {
            let nonHardMaxDuration = 0;
            for (const action of node.actions) {
                if (action.blockingType === BlockingType.Hard) {
                    effectiveActionDuration += nonHardMaxDuration;
                    effectiveActionDuration += this.getNodeActionDuration(action);
                    nonHardMaxDuration = 0;
                } else {
                    nonHardMaxDuration = Math.max(nonHardMaxDuration, this.getNodeActionDuration(action));
                }
            }
        }
        let edgeTraversalTime = 0;
        for (const edge of order.edges) {
            // Ignore duration time of edge actions as they are executed while
            // traversing the edge and terminated on traversal.
            const startNode = order.nodes.find(n => n.nodeId === edge.startNodeId && n.sequenceId === edge.sequenceId - 1);
            const endNode = order.nodes.find(n => n.nodeId === edge.endNodeId && n.sequenceId === edge.sequenceId + 1);
            const startNodePosition = startNode.nodePosition ?? currentNodePosition;
            const distance = Math.sqrt((endNode.nodePosition.x - startNodePosition.x) ** 2 +
                (endNode.nodePosition.y - startNodePosition.y) ** 2);
            edgeTraversalTime += (distance / this.getTargetSpeed(true, distance, edge.maxSpeed));
        }
        return edgeTraversalTime + effectiveActionDuration;
    }
}

/**
 * Represents a tick-based state machine for a virtual action to be executed in
 * the context of the `VirtualAgvAdapter`.
 *
 * Advancement of action states according to the action's definition occurs on
 * periodic ticks triggered by the associated adapter.
 */
class VirtualActionStateMachine {

    private _actionStatus: ActionStatus;
    private _actionStatusOnPause: ActionStatus;
    private _shouldTerminate: boolean;
    private _shouldCancel: boolean;
    private _statusDurationTimes: Map<ActionStatus, number>;

    constructor(
        public readonly actionContext: ActionContext,
        public readonly actionDefinition: VirtualActionDefinition,
        private readonly _finalizeAction: () => void,
        private readonly _debug: AgvAdapterDebugger,
        private _shouldPause: boolean) {
        this._actionStatus = undefined;
        this._actionStatusOnPause = undefined;
        this._shouldTerminate = false;
        this._shouldCancel = false;
        this._statusDurationTimes = new Map(Object.keys(actionDefinition.transitions).map((s: ActionStatus) => [s, 0]));
    }

    /**
     * Determines whether the action represented by this state machine matches
     * the given unqiue action identity defined by actionId and action scope.
     *
     * @param actionId the action ID
     * @param scope the scope of the action
     */
    matches(actionId: string, scope: ActionScope) {
        return this.actionContext.action.actionId === actionId &&
            this.actionContext.scope === scope;
    }

    /**
     * Invoked whenever the `VirtualAgvAdapter` issues a tick. Used to advance
     * the action status of this state machine according to the action
     * definition.
     *
     * @param tick the tick count incremented with each tick
     * @param tickInterval the configured tick interval in milliseconds
     * @param realInterval the real time interval since the last tick in
     * seconds
     */
    tick(tick: number, tickInterval: number, realInterval: number) {
        if (this._shouldTerminate === undefined || this._shouldCancel === undefined) {
            return;
        }

        // Transition to/from PAUSED state if requested.
        if (this._shouldPause && this._actionStatus !== ActionStatus.Paused) {
            this._actionStatusOnPause = this._actionStatus || this.actionDefinition.transitions.ON_INIT.next;
            this._transition({ actionStatus: ActionStatus.Paused });
            return;
        }
        if (!this._shouldPause && this._actionStatus === ActionStatus.Paused) {
            const resumedStatus = this._actionStatusOnPause;
            this._actionStatusOnPause = undefined;
            this._transition({ actionStatus: resumedStatus });
            return;
        }

        // Initially, if not requested to pause, transition to INITIAL state.
        if (this._actionStatus === undefined) {
            this._transition({ actionStatus: this.actionDefinition.transitions.ON_INIT.next });
            return;
        }

        if (this._shouldCancel === true && this.actionDefinition.transitions.ON_CANCEL) {
            const { linkedState: ls } = this.actionDefinition.transitions.ON_CANCEL;
            this._transition({
                actionStatus: ActionStatus.Failed,
                linkedState: ls ? ls(this.actionContext) : undefined,
            });
            return;
        }
        if (this._shouldTerminate === true) {
            const { next: nxt, linkedState: ls } = this.actionDefinition.transitions.ON_TERMINATE;
            this._transition({
                actionStatus: nxt,
                linkedState: ls ? ls(this.actionContext) : undefined,
            });
            return;
        }

        if (this._actionStatus === ActionStatus.Paused) {
            return;
        }

        const actionStatusDef = this.actionDefinition.transitions[this._actionStatus];
        let duration = this._statusDurationTimes.get(this._actionStatus);
        duration += realInterval;

        const { next, durationTime } = actionStatusDef as { next: ActionStatus, durationTime: number };
        if (durationTime !== undefined && duration >= durationTime) {
            this._statusDurationTimes.set(this._actionStatus, 0);
            this._transition({ actionStatus: next });
        } else {
            this._statusDurationTimes.set(this._actionStatus, duration);
        }
    }

    /**
     * Terminate the action of the state machine on the next tick, transitioning
     * to either action status FINISHED or FAILED.
     *
     * @remarks Only required and invoked on edge actions.
     */
    terminate() {
        if (this.actionContext.scope !== "edge" || this._shouldTerminate !== false) {
            return;
        }
        this._debug("should terminate action %o", this.actionContext);
        this._shouldTerminate = true;
    }


    /**
     * If the action is cancelable, i.e. interruptable, cancel it on the next
     * tick, transitioning to action status FAILED.
     *
     * @remarks Only required and invoked on node and edge actions.
     */
    cancel() {
        if (this.actionContext.scope === "instant" || this._shouldCancel !== false || !this.actionDefinition.transitions.ON_CANCEL) {
            return;
        }
        this._debug("should cancel action %o", this.actionContext);
        this._shouldCancel = true;
    }

    /**
     * Pause the action of the state machine on the next tick, transitioning to
     * action status PAUSED.
     */
    pause() {
        this._debug("should pause action %o", this.actionContext);
        this._shouldPause = true;
    }

    /**
     * Resume the paused action of the state machine on the next tick,
     * transitioning to its previous action status.
     */
    unpause() {
        this._debug("should unpause action %o", this.actionContext);
        this._shouldPause = false;
    }

    /**
     * Transition this state machine to the given action status immediately.
     */
    private _transition(change: ActionStatusChangeInfo) {
        this._actionStatus = change.actionStatus;
        if (this._actionStatus === ActionStatus.Finished || this._actionStatus === ActionStatus.Failed) {
            this._shouldTerminate = undefined;
            this._shouldCancel = undefined;
            this._shouldPause = false;
            this._finalizeAction();
        }
        const { linkedState, resultDescription, errorDescription } = this.actionDefinition.transitions[this._actionStatus] ?? {};
        change = {
            actionStatus: this._actionStatus,
            linkedState: Object.assign({}, change.linkedState, linkedState ? linkedState(this.actionContext) : undefined),
            resultDescription: resultDescription ? resultDescription(this.actionContext) : undefined,
            errorDescription: errorDescription ? errorDescription(this.actionContext) : undefined,
        };

        this._debug("transition action %o to status %o", this.actionContext, change);
        this.actionContext.updateActionStatus(change);
    }

}
