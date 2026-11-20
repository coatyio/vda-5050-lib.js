/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import * as mqtt from "mqtt";
import * as tap from "tap";

import {
    Action,
    ActionState,
    ActionStatus,
    BlockingType,
    Error as VdaError,
    ErrorLevel,
    ErrorType,
    Headerless,
    MasterController,
    Order,
    State,
    Topic,
} from "../..";
import { initTestContext } from "../test-context";
import { createHeaderlessObject } from "../test-objects";

initTestContext(tap);

const customTopicFormat = "%topic%/%interfaceName%/%manufacturer%/%serialNumber%/%majorVersion%";
const actionId = "empty-blocking-type";
const agvId = { manufacturer: "siemens", serialNumber: "001" };

async function setup(
    t: typeof tap.Test.prototype,
    version: "1.1.0" | "2.0.0" | "2.1.0" = "2.0.0",
    customFormat = false) {
    const interfaceName = `errorcorrelation${process.pid}`;
    const majorVersion = version === "1.1.0" ? "v1" : "v2";
    const topic = (name: Topic) => customFormat ?
        `${name}/${interfaceName}/siemens/001/${majorVersion}` :
        `${interfaceName}/${majorVersion}/siemens/001/${name}`;
    const brokerUrl: string = t.context.brokerUrls[0];
    const controller = new MasterController({
        interfaceName,
        vdaVersion: version,
        transport: { brokerUrl, topicFormat: customFormat ? customTopicFormat : undefined },
        topicObjectValidation: { inbound: true, outbound: false },
    }, {});
    let publisher: mqtt.MqttClient;
    t.teardown(async () => {
        if (publisher) {
            await new Promise<void>((resolve, reject) => publisher.end(true, error => error ? reject(error) : resolve()));
        }
        await controller.stop();
    });

    await controller.start();
    publisher = mqtt.connect(brokerUrl);
    await new Promise<void>((resolve, reject) => {
        publisher.once("connect", () => resolve());
        publisher.once("error", reject);
    });

    let stateSeen: () => void;
    await controller.subscribe(Topic.State, agvId, () => stateSeen?.());
    let headerId = 0;
    const sendState = async (
        errors: VdaError[],
        actionStates: ActionState[] = [],
        stateProperties: Partial<Headerless<State>> = {}) => {
        const state: State = {
            ...createHeaderlessObject(Topic.State),
            ...stateProperties,
            ...agvId,
            headerId: headerId++,
            timestamp: "2026-11-20T12:04:00.352Z",
            version,
            errors,
            actionStates,
        };
        let timer: ReturnType<typeof setTimeout>;
        const received = new Promise<void>((resolve, reject) => {
            timer = setTimeout(() => reject(new Error("State was not received")), 3000);
            stateSeen = resolve;
        });
        try {
            await new Promise<void>((resolve, reject) => publisher.publish(
                topic(Topic.State),
                JSON.stringify(state),
                error => error ? reject(error) : resolve(),
            ));
            await received;
        } finally {
            clearTimeout(timer);
            stateSeen = undefined;
        }
    };
    return { controller, topic, sendState };
}

function invalidOrder(): Headerless<Order> {
    return {
        orderId: "edge-action-empty-blocking-type",
        orderUpdateId: 0,
        nodes: [
            { nodeId: "30", sequenceId: 0, released: true, actions: [] },
            { nodeId: "39", sequenceId: 2, released: true, actions: [] },
        ],
        edges: [{
            edgeId: "30_39",
            sequenceId: 1,
            startNodeId: "30",
            endNodeId: "39",
            released: true,
            actions: [{ actionId, actionType: "pick", blockingType: "" as BlockingType }],
        }],
    };
}

function orderValidationError(topic: string, order: Headerless<Order>): VdaError {
    return {
        errorType: ErrorType.OrderValidation,
        errorLevel: ErrorLevel.Warning,
        errorReferences: [
            { referenceKey: "topic", referenceValue: topic },
            { referenceKey: "orderId", referenceValue: order.orderId },
            { referenceKey: "orderUpdateId", referenceValue: String(order.orderUpdateId) },
            { referenceKey: "actionId", referenceValue: actionId },
        ],
    };
}

for (const scenario of [
    { name: "logical topic", version: "2.0.0" as const, custom: false, logical: true },
    { name: "full MQTT topic", version: "1.1.0" as const, custom: false, logical: false },
    { name: "custom MQTT topic", version: "2.1.0" as const, custom: true, logical: false },
]) {
    tap.test(`order validation rejection with actionId and ${scenario.name}`, async t => {
        const h = await setup(t, scenario.version, scenario.custom);
        const order = invalidOrder();
        const rejections: VdaError[] = [];
        await h.controller.assignOrder(agvId, order, {
            onOrderProcessed: withError => rejections.push(withError),
        });
        const error = orderValidationError(scenario.logical ? Topic.Order : h.topic(Topic.Order), order);

        await h.sendState([error]);
        t.same(rejections, [error]);
        t.ok(await h.controller.assignOrder(agvId, order, { onOrderProcessed: () => undefined }),
            "rejection removes the cached order");
    });
}

tap.test("unrelated and incomplete action errors do not reject an order", async t => {
    const h = await setup(t);
    const order = invalidOrder();
    const rejections: VdaError[] = [];
    await h.controller.assignOrder(agvId, order, { onOrderProcessed: error => rejections.push(error) });
    const valid = orderValidationError(Topic.Order, order);
    const invalid = [
        { ...valid, errorType: ErrorType.OrderAction },
        orderValidationError(h.topic(Topic.InstantActions), order),
        orderValidationError(h.topic(Topic.Order).replace("/001/", "/other/"), order),
        { ...valid, errorReferences: valid.errorReferences.filter(ref => ref.referenceKey !== "orderUpdateId") },
        {
            ...valid,
            errorReferences: valid.errorReferences.map(ref => ref.referenceKey === "orderUpdateId" ?
                { ...ref, referenceValue: "0-invalid" } : ref),
        },
    ];
    for (const error of invalid) {
        await h.sendState([error]);
        t.same(rejections, []);
    }
    await h.sendState([valid]);
    t.same(rejections, [valid]);
});

for (const logical of [true, false]) {
    tap.test(`validation error for an active order action with ${logical ? "logical" : "full MQTT"} topic`, async t => {
        const h = await setup(t);
        const order = invalidOrder();
        order.edges[0].actions[0].blockingType = BlockingType.None;
        const actionErrors: VdaError[] = [];
        await h.controller.assignOrder(agvId, order, {
            onOrderProcessed: () => t.fail("active order must not be rejected"),
            onActionStateChanged: (_state, withError) => actionErrors.push(withError),
        });
        const error = orderValidationError(logical ? Topic.Order : h.topic(Topic.Order), order);
        await h.sendState([error], [{ actionId, actionStatus: ActionStatus.Failed }], {
            orderId: order.orderId,
            orderUpdateId: order.orderUpdateId,
            nodeStates: [{ nodeId: "30", sequenceId: 0, released: true }],
        });
        t.same(actionErrors, [error]);
    });
}

function instantActionError(topic: string, id = actionId): VdaError {
    return {
        errorType: ErrorType.InstantActionValidation,
        errorLevel: ErrorLevel.Warning,
        errorReferences: [
            { referenceKey: "topic", referenceValue: topic },
            { referenceKey: "actionId", referenceValue: id },
        ],
    };
}

tap.test("instant action rejection with full MQTT topic is correlated once", async t => {
    const h = await setup(t);
    const action: Action = { actionId, actionType: "pick", blockingType: "" as BlockingType };
    const rejections: VdaError[] = [];
    await h.controller.initiateInstantActions(agvId, { actions: [action] }, {
        onActionStateChanged: () => t.fail("rejected action must not have a state"),
        onActionError: withError => rejections.push(withError),
    });
    const error = instantActionError(h.topic(Topic.InstantActions));
    await h.sendState([error]);
    await h.sendState([error]);
    t.same(rejections, [error]);
});

tap.test("instant action correlation checks the configured topic and actionId", async t => {
    const h = await setup(t, "2.0.0", true);
    const action: Action = { actionId, actionType: "pick", blockingType: "" as BlockingType };
    const logicalAction: Action = { ...action, actionId: "logical-action" };
    const rejections: VdaError[] = [];
    await h.controller.initiateInstantActions(agvId, { actions: [action, logicalAction] }, {
        onActionStateChanged: () => t.fail("rejected action must not have a state"),
        onActionError: withError => rejections.push(withError),
    });
    await h.sendState([instantActionError(h.topic(Topic.InstantActions).replace("/001/", "/other/"))]);
    await h.sendState([instantActionError(h.topic(Topic.InstantActions), "other-action")]);
    t.same(rejections, []);
    const logicalError = instantActionError(Topic.InstantActions, logicalAction.actionId);
    await h.sendState([logicalError]);
    t.same(rejections, [logicalError]);
    const error = instantActionError(h.topic(Topic.InstantActions));
    await h.sendState([error]);
    t.same(rejections, [logicalError, error]);
});

tap.test("failed instant action state includes the error with a full MQTT topic", async t => {
    const h = await setup(t);
    const action: Action = { actionId, actionType: "pick", blockingType: BlockingType.None };
    const errors: VdaError[] = [];
    await h.controller.initiateInstantActions(agvId, { actions: [action] }, {
        onActionStateChanged: (_state, withError) => errors.push(withError),
        onActionError: () => t.fail("failed action must be reported as a state change"),
    });
    const error = { ...instantActionError(h.topic(Topic.InstantActions)), errorType: ErrorType.InstantAction };
    await h.sendState([error], [{ actionId, actionStatus: ActionStatus.Failed }]);
    t.same(errors, [error]);
});
