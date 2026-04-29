/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import * as tap from "tap";

import {
    Action,
    ActionStatus,
    AgvController,
    AgvId,
    BlockingType,
    createUuid,
    ErrorLevel,
    ErrorType,
    EStop,
    Headerless,
    MasterController,
    OperatingMode,
    Order,
    Topic,
} from "../..";

export function createHeaderlessOrder(
    nodeActions = [[createPickDropNoopAction("pick")], [createPickDropNoopAction("drop")]],
): Headerless<Order> {
    return {
        orderId: createUuid(),
        orderUpdateId: 0,
        nodes: [
            {
                nodeId: "productionunit_1",
                sequenceId: 0,
                released: true,
                nodePosition: { x: 0, y: 0, mapId: "local" },
                actions: nodeActions[0],
            },
            {
                nodeId: "productionunit_2",
                sequenceId: 2,
                released: true,
                nodePosition: { x: 100, y: 0, mapId: "local" },
                actions: nodeActions[1],
            },
        ],
        edges: [
            {
                edgeId: "productionunit_1_2",
                sequenceId: 1,
                startNodeId: "productionunit_1",
                endNodeId: "productionunit_2",
                released: true,
                actions: [],
            },
        ],
    };
}

export function createPickDropNoopAction(actionType: "pick" | "drop" | "noop", blockingType = BlockingType.Hard): Action {
    return {
        actionId: createUuid(),
        actionType,
        blockingType,
        actionParameters: [{ key: "stationType", value: "floor" }, { key: "loadType", value: "EPAL" }],
    };
}

export async function testOrderError(
    test: typeof tap.Test.prototype,
    testName: string,
    errorType: ErrorType,
    mc: MasterController,
    agvId: AgvId,
    order: Headerless<Order>,
    withStateChange: { ac: AgvController, keyChain: string, newValue: any },
    timeoutAfter: number,
    ...expectedErrorRefs: Array<{ referenceKey: string, referenceValue: string }>) {
    await test.test(testName, ts => new Promise(async resolve => {
        if (timeoutAfter !== undefined) {
            setTimeout(() => {
                ts.pass("test timed out as expected after " + timeoutAfter + "ms");
                resolve();
            }, timeoutAfter);
        }

        let currentState: any;
        if (withStateChange) {
            currentState = withStateChange.ac.currentState;
            const newState = JSON.parse(JSON.stringify(currentState));
            const keys = withStateChange.keyChain.split(".");
            let keyValue = newState;
            for (const key of keys.slice(0, keys.length - 1)) {
                keyValue = keyValue[key];
            }
            keyValue[keys[keys.length - 1]] = withStateChange.newValue;
            withStateChange.ac.updatePartialState(newState, false);
        }

        let errorInvocations = 0;
        const headeredOrder = await mc.assignOrder(agvId, order, {
            onOrderProcessed: (withError, byCancelation, active, context) => {
                errorInvocations++;
                ts.equal(errorInvocations, 1);
                ts.equal(byCancelation, false);
                ts.equal(active, false);
                ts.not(withError, undefined);
                ts.equal(withError.errorLevel, ErrorLevel.Warning);
                ts.equal(withError.errorType, errorType);
                ts.ok((withError.errorReferences.length < 1) ||
                    (withError.errorReferences.some(r => r.referenceKey === "orderId" && r.referenceValue === order.orderId)));
                ts.ok((withError.errorReferences.length < 1) ||
                    withError.errorReferences.some(r => r.referenceKey === "orderUpdateId"));
                ts.ok(!withError.errorReferences.some(r => r.referenceKey === "topic") ||
                    withError.errorReferences.some(r => r.referenceKey === "topic" && r.referenceValue === Topic.Order));
                ts.ok(!withError.errorReferences.some(r => r.referenceKey === "headerId") ||
                    withError.errorReferences.some(r => r.referenceKey === "headerId" &&
                        r.referenceValue === headeredOrder.headerId.toString()));
                ts.ok(expectedErrorRefs.every(er => withError.errorReferences.some(r =>
                    r.referenceKey === er.referenceKey && r.referenceValue === er.referenceValue)));
                ts.strictSame(context.agvId, agvId);
                ts.equal(context.order, order);

                if (withStateChange) {
                    withStateChange.ac.updatePartialState(currentState);
                }
                resolve();
            },
        });
    }));
}

export async function testOrder(
    test: typeof tap.Test.prototype,
    testName: string,
    mc: MasterController,
    agvId: AgvId,
    order: Headerless<Order>,
    expectedChanges: {
        // true if order is completely processed, i.e. without outstanding horizon nodes/edges;
        // false if order is processed but still active because of horizon nodes/edges.
        completes: boolean,
        isStitching?: boolean,
        canceled?: boolean,
        discardedByMc?: boolean,
        errorRefs?: Array<{ referenceKey: string, referenceValue: string }>,
        actionErrorRefs?: Array<{ referenceKey: string, referenceValue: string }>,
        triggerOnEdgeTraversing?: (test: typeof tap.Test.prototype, edgeId: string, resolve: () => void) => void,
        triggerOnActionInitializing?: (test: typeof tap.Test.prototype, action: Action, resolve: () => void) => void,
    },
    failAfter?: number) {
    await test.test(testName, ts => new Promise(async resolve => {
        if (failAfter !== undefined) {
            setTimeout(() => {
                ts.pass("test timed out as expected after " + failAfter + "ms");
                resolve();
            }, failAfter);
        }

        let processedInvocations = 0;
        let hasResolved = false;
        let nodeTraversedIndex = -1;
        let edgeTraversedIndex = -1;
        let edgeTraversingCount = 0;
        let triggeredOnEdgeTraversing = false;
        let triggeredOnActionInitializing = false;
        const headeredOrder = await mc.assignOrder(agvId, order, {
            onOrderProcessed: (withError, byCancelation, active, context) => {
                if (hasResolved) {
                    // The test has already resolved (e.g. a horizon order was later canceled
                    // by a subsequent test). Ignore the re-invocation to avoid stale assertions.
                    return;
                }
                if (failAfter !== undefined) {
                    ts.fail("onOrderProcessed should not be called due to failAfter timeout");
                    hasResolved = true;
                    resolve();
                    return;
                }
                if (expectedChanges.discardedByMc) {
                    ts.fail("onOrderProcessed should not be called as order should be discarded by mc");
                    hasResolved = true;
                    resolve();
                    return;
                }
                ts.equal(expectedChanges.completes, !active);
                ts.equal(byCancelation, !!expectedChanges.canceled);
                if (!expectedChanges.completes && expectedChanges.canceled) {
                    // Test has already ended, do not invoke asserts on it.
                    return;
                }
                processedInvocations++;
                ts.equal(processedInvocations, 1);
                ts.strictSame(context.agvId, agvId);
                ts.equal(context.order, order);

                if (expectedChanges.errorRefs?.length > 0) {
                    ts.not(withError, undefined);
                    ts.ok(expectedChanges.errorRefs.every(er => withError.errorReferences.some(r =>
                        r.referenceKey === er.referenceKey && r.referenceValue === er.referenceValue)));
                } else {
                    ts.equal(withError, undefined);
                }

                hasResolved = true;
                resolve();
            },
            onNodeTraversed: (node, nextEdge, nextNode, context) => {
                if (failAfter !== undefined) {
                    ts.fail("onNodeTraversed should not be called because of failAfter timeout");
                    resolve();
                    return;
                }
                nodeTraversedIndex++;
                if (!expectedChanges.isStitching) {
                    // For stitching orders, the node may refer to the order context of the previous order.
                    ts.equal(edgeTraversingCount, 0);
                    ts.equal(nodeTraversedIndex, edgeTraversedIndex + 1);
                    ts.equal(node, context.order.nodes[nodeTraversedIndex]);
                    ts.equal(nextEdge, context.order.edges[nodeTraversedIndex]);
                    ts.equal(nextNode, context.order.nodes[nodeTraversedIndex + 1]);
                }
                ts.strictSame(context.agvId, agvId);
                ts.equal(context.order, order);
                ts.strictSame(context.order, order);
                if (node.nodePosition) {
                    // Support both V2.1 (agvPosition) and V3.0 (mobileRobotPosition) shapes
                    const pos = (context.state as any).agvPosition ?? (context.state as any).mobileRobotPosition;
                    const posInitialized = pos.positionInitialized ?? pos.localized;
                    ts.equal(posInitialized, true);
                    ts.equal(pos.mapId, node.nodePosition.mapId);
                    ts.equal(pos.x, node.nodePosition.x);
                    ts.equal(pos.y, node.nodePosition.y);
                    if (node.nodePosition.theta !== undefined) {
                        ts.equal(pos.theta, node.nodePosition.theta);
                    }
                }
                if (!expectedChanges.completes && !nextEdge?.released) {
                    ts.pass("last released node traversed - order has more unreleased nodes");
                    resolve();
                }
            },
            onEdgeTraversed: (edge, startNode, endNode, context) => {
                if (failAfter !== undefined) {
                    ts.fail("onEdgeTraversed should not be called because of failAfter timeout");
                    resolve();
                    return;
                }
                edgeTraversingCount = 0;
                edgeTraversedIndex++;
                if (!expectedChanges.isStitching) {
                    // For stitching orders, the edge may refer to the order context of the previous order.
                    ts.equal(nodeTraversedIndex, edgeTraversedIndex);
                    ts.equal(edge, context.order.edges[edgeTraversedIndex]);
                    ts.equal(startNode, context.order.nodes[edgeTraversedIndex]);
                    ts.equal(endNode, context.order.nodes[edgeTraversedIndex + 1]);
                }
                ts.strictSame(context.agvId, agvId);
                ts.equal(context.order, order);
                ts.strictSame(context.order, order);
            },
            onEdgeTraversing: (edge, startNode, endNode, stateChanges, invocationCount, context) => {
                if (failAfter !== undefined) {
                    ts.fail("onEdgeTraversing should not be called because of failAfter timeout");
                    resolve();
                    return;
                }
                edgeTraversingCount++;
                ts.strictSame(context.agvId, agvId);
                ts.equal(context.order, order);
                ts.strictSame(context.order, order);
                if (!expectedChanges.isStitching) {
                    // For stitching orders, the edge may refer to the order context of the previous order.
                    ts.equal(edgeTraversingCount, invocationCount);
                    ts.equal(edge, context.order.edges[edgeTraversedIndex + 1]);
                    ts.equal(nodeTraversedIndex, edgeTraversedIndex + 1);
                    ts.equal(startNode, context.order.nodes[edgeTraversedIndex + 1]);
                    ts.equal(endNode, context.order.nodes[edgeTraversedIndex + 2]);
                    if (edgeTraversingCount === 1) {
                        ts.equal(stateChanges.distanceSinceLastNode, undefined);
                        // ts.equal(stateChanges.driving, false);
                        ts.equal(stateChanges.newBaseRequest, undefined);
                        ts.equal(stateChanges.operatingMode, OperatingMode.Automatic);
                        // @todo make parameterizable for startPause/stopPause tests
                        // ts.equal(stateChanges.paused, false);
                        // Support both V2.1 (eStop) and V3.0 (activeEmergencyStop) shapes
                        const safetyState = stateChanges.safetyState as any;
                        const eStopValue = safetyState.eStop ?? safetyState.activeEmergencyStop;
                        ts.ok(eStopValue === EStop.None || eStopValue === "NONE",
                            "eStop/activeEmergencyStop should be NONE");
                        ts.equal(safetyState.fieldViolation, false);
                    } else {
                        ts.equal("distanceSinceLastNode" in stateChanges, false);
                        ts.equal("newBaseRequest" in stateChanges, false);
                        ts.equal("operatingMode" in stateChanges, false);
                        // @todo make parameterizable for startPause/stopPause tests
                        // ts.equal("paused" in stateChanges, false);
                        ts.equal("safetyState" in stateChanges, false);
                    }
                }
                if (expectedChanges.triggerOnEdgeTraversing && !triggeredOnEdgeTraversing) {
                    triggeredOnEdgeTraversing = true;
                    expectedChanges.triggerOnEdgeTraversing(ts, edge.edgeId, resolve);
                }
            },
            onActionStateChanged: (actionState, withError, action, target, context) => {
                if (failAfter !== undefined) {
                    ts.fail("onActionStateChanged should not be called because of failAfter timeout");
                    resolve();
                    return;
                }
                const targetActions = target.actions;
                const actionIndex = targetActions.indexOf(action);
                ts.not(actionIndex, -1);
                ts.equal(actionState.actionType, action.actionType);
                ts.equal(actionState.actionId, action.actionId);
                ts.equal(actionState.actionDescription, action.actionDescription);

                if (actionState.actionStatus === ActionStatus.Failed && expectedChanges.actionErrorRefs?.length > 0) {
                    ts.not(withError, undefined);
                    ts.equal(withError.errorType, ErrorType.OrderAction);
                    ts.ok(expectedChanges.actionErrorRefs.every(er => withError.errorReferences.some(r =>
                        r.referenceKey === er.referenceKey && r.referenceValue === er.referenceValue)));
                } else {
                    ts.equal(withError, undefined);
                }

                if (!triggeredOnActionInitializing &&
                    actionState.actionStatus === ActionStatus.Initializing &&
                    expectedChanges.triggerOnActionInitializing) {
                    triggeredOnActionInitializing = true;
                    expectedChanges.triggerOnActionInitializing(ts, action, resolve);
                }
            },
        });

        if (headeredOrder === undefined) {
            if (expectedChanges.discardedByMc) {
                ts.pass("Assigned order has been discarded by mc");
            } else {
                ts.fail("Assigned order has been discarded by mc");
            }
            resolve();
        }
    }));
}
