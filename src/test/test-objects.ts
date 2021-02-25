/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import * as tp from "tap";

import {
    AgvId,
    Client,
    Connection,
    ConnectionState,
    EStop,
    ExtensionObject,
    Headerless,
    InstantActions,
    OperatingMode,
    Order,
    State,
    Topic,
    TopicObject,
    Vda5050Object,
    Visualization,
} from "..";

/** Provides VDA 5050 mock objects and AGV identifiers for testing. */

/**
 * Create a new AGV identity for the given serial number.
 *
 * @param manufacturer manufacturer of AGV or undefined
 * @param serialNumber serial number of AGV or undefined
 */
export function createAgvId(manufacturer: string, serialNumber: string): AgvId {
    return { manufacturer, serialNumber };
}

/**
 * Creates a headerless VDA 5005 object with default properties for the given
 * communication topic.
 *
 * @param topic a VDA 5050 standard or extension communication topic
 */
export function createHeaderlessObject<T extends string>(topic: T extends Topic ? T : string): Headerless<TopicObject<T>> {
    switch (topic) {
        case Topic.Connection:
            return {
                connectionState: ConnectionState.Offline,
            } as Headerless<Connection> as any;
        case Topic.InstantActions:
            return {
                instantActions: [],
            } as Headerless<InstantActions> as any;
        case Topic.Order:
            return {
                orderId: "order0001",
                orderUpdateId: 0,
                nodes: [{ actions: [], nodeId: "productionunit_1", sequenceId: 0, released: true }],
                edges: [],
            } as Headerless<Order> as any;
        case Topic.State:
            return {
                actionStates: [],
                batteryState: { batteryCharge: 0.8, charging: false },
                driving: false,
                edgeStates: [],
                errors: [],
                lastNodeId: "",
                lastNodeSequenceId: 0,
                nodeStates: [],
                operatingMode: OperatingMode.Automatic,
                orderId: "",
                orderUpdateId: 0,
                safetyState: { eStop: EStop.None, fieldViolation: false },
            } as Headerless<State> as any;
        case Topic.Visualization:
            return {
                agvPosition: {
                    x: 0,
                    y: 0,
                    theta: 0,
                    positionInitialized: true,
                    mapId: "001",
                },
                velocity: {
                    omega: 0,
                    vx: 1,
                    vy: 1,
                },
            } as Headerless<Visualization> as any;
        default:
            return {
                topic,
            } as Headerless<ExtensionObject> as any;
    }
}

/**
 * Verifies that the promise resolves to a headerfull VDA 5050 object and
 * furthermore that the given headerless object matches the resolved object.
 *
 * @param test the test in context
 * @param client the client instance
 * @param subject the corresponding AGV identifier
 * @param headerlessObject a headerless object to test
 * @param promise a promise that resolves a VDA 5050 object
 */
export async function testObjectResolvesMatch(
    test: typeof tp.Test.prototype,
    client: Client,
    subject: AgvId,
    headerlessObject: Headerless<Vda5050Object>,
    promise: Promise<Vda5050Object>) {
    const object = await promise;
    test.equal(object.headerId >= 0 && object.headerId <= 0xFFFFFFFF, true);
    test.equal(object.manufacturer, subject.manufacturer);
    test.equal(object.serialNumber, subject.serialNumber);
    test.equal(object.version, client.protocolVersion);
    const copy = Object.assign({}, object);
    delete copy.headerId;
    delete copy.manufacturer;
    delete copy.serialNumber;
    delete copy.timestamp;
    delete copy.version;
    test.strictDeepEqual(copy, headerlessObject);
}
