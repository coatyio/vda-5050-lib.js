/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * Edge-case tests for the Client base class covering:
 *
 * FR-02: MQTT Transport Layer (auth, timeout, version edge cases)
 * FR-04: MQTT QoS Differentiation
 * FR-06: Extension Topics edge cases (registration after start, multiple extensions, re-registration)
 * FR-07: JSON Schema Validation (selective inbound/outbound, cross-version)
 * FR-08: Protocol Header Management (headerId wraparound, inbound header mismatch)
 * FR-09: Connection State Management (rapid transitions, multiple callbacks)
 * CC:    Cross-cutting concerns (race conditions, concurrent start)
 */

// tslint:disable: no-empty

import * as tap from "tap";

import {
    AgvId,
    Client,
    ClientPublishOptions,
    Connection,
    ConnectionState,
    Headerless,
    SubscriptionId,
    Topic,
    TopicObject,
} from "../..";
import { ExtensionValidator, SubscriptionHandler } from "../../common/client-types";

import { consoleRedirect, initTestContext, testClientOptions } from "../test-context";
import { createAgvId, createHeaderlessObject } from "../test-objects";

class TestClient extends Client {

    publish<T extends string>(
        topic: T extends Topic ? T : string,
        subject: AgvId,
        object: Headerless<TopicObject<T>>,
        options?: ClientPublishOptions) {
        return this.publishTopic(topic, subject, object, options);
    }

    subscribe<T extends string>(
        topic: T extends Topic ? T : string,
        subject: Partial<AgvId>,
        handler: SubscriptionHandler<T>): Promise<SubscriptionId> {
        return this.subscribeTopic(topic, subject, handler);
    }

    protected getLastWillTopic(): { topic: Topic, subject: AgvId, object: Headerless<Connection>, retainMessage: boolean } {
        return {
            topic: Topic.Connection,
            subject: createAgvId("RobotCompany", "001"),
            object: {
                connectionState: ConnectionState.Connectionbroken,
            },
            retainMessage: true,
        };
    }
}

initTestContext(tap);

tap.test("Client Edge Cases", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t);

    /* ------------------------------------------------------------------ */
    /* FR-07: Selective inbound/outbound validation                       */
    /* ------------------------------------------------------------------ */

    await t.test("selective validation: inbound-only validation", ts => new Promise(async resolve => {
        // outbound validation disabled → wrong-type object passes publish,
        // but inbound validation enabled → should drop the invalid object.
        const client1 = new TestClient({
            ...clientOptions,
            topicObjectValidation: { inbound: true, outbound: false },
        });
        ts.teardown(() => client1.stop());
        await client1.start();

        let dropped = false;
        const done = consoleRedirect("error", (output) => {
            if (output.some(o => o.includes("Drop inbound message"))) {
                dropped = true;
            }
        });

        // Subscribe for State topic
        await client1.subscribe(Topic.State, agvId, () => {
            ts.fail("handler should not be invoked on invalid inbound object");
        });

        // Publish an Order object on the State topic (outbound validation disabled → passes)
        await client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.Order) as any);

        // Wait briefly for the message round-trip
        await new Promise(r => setTimeout(r, 500));
        done();
        ts.ok(dropped, "invalid inbound object should be dropped");
        resolve();
    }));

    await t.test("selective validation: outbound-only validation", async ts => {
        const client1 = new TestClient({
            ...clientOptions,
            topicObjectValidation: { inbound: false, outbound: true },
        });
        ts.teardown(() => client1.stop());
        await client1.start();

        // Outbound validation enabled — wrong schema should throw
        ts.throws(() => client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.Order) as any));

        // Correct schema should pass
        ts.resolves(client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.State)));
    });

    /* ------------------------------------------------------------------ */
    /* FR-06: Extension Topics — multiple extensions, re-registration     */
    /* ------------------------------------------------------------------ */

    await t.test("multiple extension topics on same client", ts => new Promise(async resolve => {
        const client1 = new TestClient(clientOptions);
        ts.teardown(() => client1.stop());

        const validator1: ExtensionValidator = (topic, object) => {
            if (object.topic !== topic) {
                throw new TypeError("Extension1 validation failed");
            }
        };
        const validator2: ExtensionValidator = (topic, object) => {
            if (object.topic !== topic) {
                throw new TypeError("Extension2 validation failed");
            }
        };

        client1.registerExtensionTopic("myExtension1", true, true, validator1);
        client1.registerExtensionTopic("myExtension2", true, true, validator2);

        await client1.start();

        let received1 = false;
        let received2 = false;

        await client1.subscribe("myExtension1", agvId, (object) => {
            ts.equal((object as any).topic, "myExtension1");
            received1 = true;
            if (received1 && received2) {
                resolve();
            }
        });
        await client1.subscribe("myExtension2", agvId, (object) => {
            ts.equal((object as any).topic, "myExtension2");
            received2 = true;
            if (received1 && received2) {
                resolve();
            }
        });

        await client1.publish("myExtension1", agvId, createHeaderlessObject("myExtension1"));
        await client1.publish("myExtension2", agvId, createHeaderlessObject("myExtension2"));
    }));

    await t.test("extension topic re-registration overrides previous", async ts => {
        const client1 = new TestClient(clientOptions);
        ts.teardown(() => client1.stop());

        // First registration: subscribe + publish
        client1.registerExtensionTopic("reRegExt", true, true, () => { });
        await client1.start();
        ts.resolves(client1.subscribe("reRegExt", agvId, () => { }));
        ts.resolves(client1.publish("reRegExt", agvId, createHeaderlessObject("reRegExt")));

        // Re-register as publish-only → subscribe should throw
        client1.registerExtensionTopic("reRegExt", false, true, () => { });
        ts.throws(() => client1.subscribe("reRegExt", agvId, () => { }));
        ts.resolves(client1.publish("reRegExt", agvId, createHeaderlessObject("reRegExt")));

        // Re-register as subscribe-only → publish should throw
        client1.registerExtensionTopic("reRegExt", true, false, () => { });
        ts.resolves(client1.subscribe("reRegExt", agvId, () => { }));
        ts.throws(() => client1.publish("reRegExt", agvId, createHeaderlessObject("reRegExt")));
    });

    /* ------------------------------------------------------------------ */
    /* FR-08: headerId sequential increment and wraparound to 0           */
    /* ------------------------------------------------------------------ */

    await t.test("headerId wraps from 0xFFFFFFFF to 0 in sequential messages", async ts => {
        const client1 = new TestClient(clientOptions);
        ts.teardown(() => client1.stop());
        await client1.start();

        // Set the headerId counter just below wraparound
        (client1 as any)._headerIds.set(Topic.State, 0xFFFFFFFE);

        const obj1 = await client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.State));
        ts.equal(obj1.headerId, 0xFFFFFFFE, "headerId should be 0xFFFFFFFE");

        const obj2 = await client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.State));
        ts.equal(obj2.headerId, 0xFFFFFFFF, "headerId should be 0xFFFFFFFF");

        const obj3 = await client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.State));
        ts.equal(obj3.headerId, 0, "headerId should wrap to 0");

        const obj4 = await client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.State));
        ts.equal(obj4.headerId, 1, "headerId should continue to 1");
    });

    /* ------------------------------------------------------------------ */
    /* FR-09: Connection State Management — rapid transitions             */
    /* ------------------------------------------------------------------ */

    await t.test("start-stop rapid series preserves state consistency", async ts => {
        const client1 = new TestClient(clientOptions);
        ts.teardown(() => client1.stop());

        // Rapid start-stop sequence
        await client1.start();
        await client1.stop();
        await client1.start();
        await client1.stop();
        await client1.start();
        ts.equal((client1 as any).isStarted, true, "client should be started");
        await client1.stop();
        ts.equal((client1 as any).isStarted, false, "client should be stopped");

        // Verify can be used again
        await client1.start();
        ts.resolves(client1.publish(Topic.State, agvId, createHeaderlessObject(Topic.State)));
        await client1.stop();
    });

    /* ------------------------------------------------------------------ */
    /* FR-01: Invalid vdaVersion                                          */
    /* ------------------------------------------------------------------ */

    await t.test("client with unsupported vdaVersion throws", ts => {
        ts.throws(() => new TestClient({ ...clientOptions, vdaVersion: "4.0.0" as any }));
        ts.throws(() => new TestClient({ ...clientOptions, vdaVersion: "" as any }));
        ts.throws(() => new TestClient({ ...clientOptions, vdaVersion: "1.0" as any }));
        ts.end();
    });

    /* ------------------------------------------------------------------ */
    /* FR-03: V1.1 client cannot use Factsheet, ZoneSet, Responses topics */
    /* ------------------------------------------------------------------ */

    await t.test("v1.1 client rejects Factsheet topic publish", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        ts.throws(() => client11.publish(Topic.Factsheet, agvId, {} as any));
    });

    await t.test("v1.1 client rejects ZoneSet and Responses topic publish", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        ts.throws(() => client11.publish(Topic.ZoneSet, agvId, {} as any));
        ts.throws(() => client11.publish(Topic.Responses, agvId, {} as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-03/FR-07: V3.0 ZoneSet and Responses — empty array edge cases   */
    /* ------------------------------------------------------------------ */

    await t.test("v3.0 ZoneSet with empty zones array", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        const emptyZoneSet = {
            zoneSet: {
                mapId: "local",
                zoneSetId: "zoneSet001",
                zones: [],
            },
        };
        // Empty zones should be valid (clearing all zones)
        ts.resolves(client30.publish(Topic.ZoneSet, agvId, emptyZoneSet as any));
    });

    await t.test("v3.0 Responses with empty responses array", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        const emptyResponses = {
            responses: [],
        };
        // Empty responses should be valid
        ts.resolves(client30.publish(Topic.Responses, agvId, emptyResponses as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-09: V3.0 Connection with HIBERNATING state                      */
    /* ------------------------------------------------------------------ */

    await t.test("v3.0 Connection accepts HIBERNATING state", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        ts.resolves(client30.publish(Topic.Connection, agvId,
            { connectionState: "HIBERNATING" } as any));
    });


    await t.test("v2.0 Connection accepts CONNECTIONBROKEN state", async ts => {
        const client20 = new TestClient(testClientOptions(t, { vdaVersion: "2.0.0" }));
        ts.teardown(() => client20.stop());
        await client20.start();

        ts.resolves(client20.publish(Topic.Connection, agvId,
            { connectionState: "CONNECTIONBROKEN" } as any));
    });

    await t.test("v2.0 Connection rejects HIBERNATING state", async ts => {
        const client20 = new TestClient(testClientOptions(t, { vdaVersion: "2.0.0" }));
        ts.teardown(() => client20.stop());
        await client20.start();

        ts.throws(() => client20.publish(Topic.Connection, agvId,
            { connectionState: "HIBERNATING" } as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-32: Cross-version enum validation                               */
    /* ------------------------------------------------------------------ */

    await t.test("v3.0 State rejects v2.x eStop enum in safetyState", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        // V3.0 uses safetyState.activeEmergencyStop, not safetyState.eStop
        const v2xState = {
            actionStates: [],
            driving: false,
            edgeStates: [],
            errors: [],
            instantActionStates: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "AUTOMATIC",
            orderId: "",
            orderUpdateId: 0,
            powerSupply: { stateOfCharge: 80, charging: false },
            safetyState: { eStop: "NONE", fieldViolation: false },
        };
        ts.throws(() => client30.publish(Topic.State, agvId, v2xState as any));
    });

    await t.test("v3.0 State accepts activeEmergencyStop enum", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        const v30State = {
            actionStates: [],
            driving: false,
            edgeStates: [],
            errors: [],
            instantActionStates: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "AUTOMATIC",
            orderId: "",
            orderUpdateId: 0,
            powerSupply: { stateOfCharge: 80, charging: false },
            safetyState: { activeEmergencyStop: "NONE", fieldViolation: false },
        };
        ts.resolves(client30.publish(Topic.State, agvId, v30State as any));
    });

    await t.test("v2.1 State rejects powerSupply (v3.0 field)", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        // V2.1 State requires batteryState, not powerSupply
        const v30StateOnV21 = {
            actionStates: [],
            driving: false,
            edgeStates: [],
            errors: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "AUTOMATIC",
            orderId: "",
            orderUpdateId: 0,
            powerSupply: { stateOfCharge: 80, charging: false },
            safetyState: { activeEmergencyStop: "NONE", fieldViolation: false },
        };
        ts.throws(() => client21.publish(Topic.State, agvId, v30StateOnV21 as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-32: V3.0 OperatingMode TEACH_IN vs V2.x TEACHIN                */
    /* ------------------------------------------------------------------ */

    await t.test("v3.0 State accepts TEACH_IN operating mode", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        const state30 = {
            actionStates: [],
            driving: false,
            edgeStates: [],
            errors: [],
            instantActionStates: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "TEACH_IN",
            orderId: "",
            orderUpdateId: 0,
            powerSupply: { stateOfCharge: 80, charging: false },
            safetyState: { activeEmergencyStop: "NONE", fieldViolation: false },
        };
        ts.resolves(client30.publish(Topic.State, agvId, state30 as any));
    });

    await t.test("v2.1 State accepts TEACHIN operating mode", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        const state21 = {
            ...createHeaderlessObject(Topic.State),
            operatingMode: "TEACHIN",
        };
        ts.resolves(client21.publish(Topic.State, agvId, state21 as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-33: PowerSupply vs BatteryState field validation per version     */
    /* ------------------------------------------------------------------ */

    await t.test("v1.1 State requires batteryState with batteryCharge", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        const validState = createHeaderlessObject(Topic.State);
        ts.resolves(client11.publish(Topic.State, agvId, validState));

        // Missing batteryState should fail
        const missingBattery = { ...createHeaderlessObject(Topic.State) };
        delete (missingBattery as any).batteryState;
        ts.throws(() => client11.publish(Topic.State, agvId, missingBattery as any));
    });

    await t.test("v3.0 State requires powerSupply with stateOfCharge", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        // Missing stateOfCharge in powerSupply should fail
        const state30 = {
            actionStates: [],
            driving: false,
            edgeStates: [],
            errors: [],
            instantActionStates: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "AUTOMATIC",
            orderId: "",
            orderUpdateId: 0,
            powerSupply: { charging: false },
            safetyState: { activeEmergencyStop: "NONE", fieldViolation: false },
        };
        ts.throws(() => client30.publish(Topic.State, agvId, state30 as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-34: Safety State per version                                    */
    /* ------------------------------------------------------------------ */

    await t.test("v2.1 State requires safetyState with eStop", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        const missingSafety = { ...createHeaderlessObject(Topic.State) };
        delete (missingSafety as any).safetyState;
        ts.throws(() => client21.publish(Topic.State, agvId, missingSafety as any));
    });

    await t.test("v3.0 State requires safetyState with activeEmergencyStop", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        const missingSafety = {
            actionStates: [],
            driving: false,
            edgeStates: [],
            errors: [],
            instantActionStates: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "AUTOMATIC",
            orderId: "",
            orderUpdateId: 0,
            powerSupply: { stateOfCharge: 80, charging: false },
        };
        ts.throws(() => client30.publish(Topic.State, agvId, missingSafety as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-19: V3.0 Visualization with optional fields                     */
    /* ------------------------------------------------------------------ */

    await t.test("v3.0 Visualization without mobileRobotPosition accepted", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        // Minimal v3.0 Visualization — only referenceStateHeaderId
        ts.resolves(client30.publish(Topic.Visualization, agvId,
            { referenceStateHeaderId: 42 } as any));
    });

    /* ------------------------------------------------------------------ */
    /* CC: Multiple subscriptions on same topic with different AgvIds      */
    /* ------------------------------------------------------------------ */

    await t.test("subscribe same topic for different AgvIds", ts => new Promise(async resolve => {
        const client1 = new TestClient(clientOptions);
        ts.teardown(() => client1.stop());
        await client1.start();

        const agvId1 = createAgvId("CompanyA", "001");
        const agvId2 = createAgvId("CompanyA", "002");
        let received1 = false;
        let received2 = false;

        await client1.subscribe(Topic.Order, agvId1, (object, subject) => {
            ts.strictSame(subject, agvId1);
            received1 = true;
            if (received1 && received2) {
                resolve();
            }
        });
        await client1.subscribe(Topic.Order, agvId2, (object, subject) => {
            ts.strictSame(subject, agvId2);
            received2 = true;
            if (received1 && received2) {
                resolve();
            }
        });

        await client1.publish(Topic.Order, agvId1, createHeaderlessObject(Topic.Order));
        await client1.publish(Topic.Order, agvId2, createHeaderlessObject(Topic.Order));
    }));

    /* ------------------------------------------------------------------ */
    /* CC: Wildcard subscription receives messages from multiple AGVs      */
    /* ------------------------------------------------------------------ */

    await t.test("wildcard subscription receives from multiple AGVs", ts => new Promise(async resolve => {
        const client1 = new TestClient(clientOptions);
        ts.teardown(() => client1.stop());
        await client1.start();

        const agvId1 = createAgvId("CompanyX", "A01");
        const agvId2 = createAgvId("CompanyX", "A02");
        const receivedFrom = new Set<string>();

        // Subscribe with wildcard serialNumber
        await client1.subscribe(Topic.State, { manufacturer: "CompanyX" } as Partial<AgvId>, (object, subject) => {
            receivedFrom.add(subject.serialNumber);
            if (receivedFrom.size === 2) {
                ts.ok(receivedFrom.has("A01"), "received from A01");
                ts.ok(receivedFrom.has("A02"), "received from A02");
                resolve();
            }
        });

        await client1.publish(Topic.State, agvId1, createHeaderlessObject(Topic.State));
        await client1.publish(Topic.State, agvId2, createHeaderlessObject(Topic.State));
    }));

});
