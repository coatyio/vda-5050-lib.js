/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// tslint:disable: no-empty

import * as tap from "tap";

import { AgvId, Client, ClientPublishOptions, Connection, ConnectionState, Headerless, SubscriptionId, Topic, TopicObject } from "../..";
import { SubscriptionHandler } from "../../common/client-types";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId, createHeaderlessObject } from "../test-objects";
import { createHeaderlessObjectV3 } from "../test-objects-v3";

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

tap.test("Client V3.0 Validation", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t, { vdaVersion: "3.0.0" });
    const client = new TestClient(clientOptions);

    t.test("check v3.0 protocol version", ts => {
        ts.equal(client.protocolVersion, "3.0.0", "expect v3.0.0 protocol version");
        ts.end();
    });

    await t.test("validate v3.0 Connection topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 Connection
        ts.resolves(client.publish(Topic.Connection, agvId, createHeaderlessObjectV3(Topic.Connection)));

        // Invalid: v2.1 CONNECTIONBROKEN value (v3.0 uses CONNECTION_BROKEN)
        ts.throws(() => client.publish(Topic.Connection, agvId,
            { connectionState: "CONNECTIONBROKEN" } as any));

        // Invalid: missing connectionState
        ts.throws(() => client.publish(Topic.Connection, agvId, {} as any));
    });

    await t.test("validate v3.0 InstantActions topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 InstantActions (uses actions, not instantActions)
        ts.resolves(client.publish(Topic.InstantActions, agvId, createHeaderlessObjectV3(Topic.InstantActions)));

        // Invalid: empty object
        ts.throws(() => client.publish(Topic.InstantActions, agvId, {} as any));
    });

    await t.test("validate v3.0 Order topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 Order
        ts.resolves(client.publish(Topic.Order, agvId, createHeaderlessObjectV3(Topic.Order)));

        // Invalid: missing required fields
        ts.throws(() => client.publish(Topic.Order, agvId, {} as any));
    });

    await t.test("validate v3.0 State topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 State
        ts.resolves(client.publish(Topic.State, agvId, createHeaderlessObjectV3(Topic.State)));

        // Invalid: v2.1 State shape (batteryState instead of powerSupply, eStop instead of activeEmergencyStop)
        ts.throws(() => client.publish(Topic.State, agvId, createHeaderlessObject(Topic.State) as any));

        // Invalid: missing powerSupply
        const stateMissingPower = { ...createHeaderlessObjectV3(Topic.State) };
        delete stateMissingPower.powerSupply;
        ts.throws(() => client.publish(Topic.State, agvId, stateMissingPower as any));

        // Invalid: missing instantActionStates (required in v3.0)
        const stateMissingInstant = { ...createHeaderlessObjectV3(Topic.State) };
        delete stateMissingInstant.instantActionStates;
        ts.throws(() => client.publish(Topic.State, agvId, stateMissingInstant as any));
    });

    await t.test("validate v3.0 Visualization topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 Visualization (requires referenceStateHeaderId)
        ts.resolves(client.publish(Topic.Visualization, agvId, createHeaderlessObjectV3(Topic.Visualization)));

        // V3.0 Visualization allows additional optional fields
        const visWithPosition = {
            ...createHeaderlessObjectV3(Topic.Visualization),
            mobileRobotPosition: {
                x: 1, y: 2, theta: 0, mapId: "local", localized: true,
            },
        };
        ts.resolves(client.publish(Topic.Visualization, agvId, visWithPosition as any));
    });

    await t.test("validate v3.0 Factsheet topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 Factsheet
        ts.resolves(client.publish(Topic.Factsheet, agvId, createHeaderlessObjectV3(Topic.Factsheet)));

        // Invalid: empty object (v3.0 Factsheet has many required fields)
        ts.throws(() => client.publish(Topic.Factsheet, agvId, {} as any));
    });

    await t.test("validate v3.0 ZoneSet topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 ZoneSet
        ts.resolves(client.publish(Topic.ZoneSet, agvId, createHeaderlessObjectV3(Topic.ZoneSet)));

        // Invalid: missing zoneSet field
        ts.throws(() => client.publish(Topic.ZoneSet, agvId, {} as any));

        // Invalid: zone missing required zoneType
        const zoneSetBadZone = {
            zoneSet: {
                mapId: "local",
                zoneSetId: "zs001",
                zones: [{ zoneId: "z1", vertices: [{ x: 0, y: 0 }] }],
            },
        };
        ts.throws(() => client.publish(Topic.ZoneSet, agvId, zoneSetBadZone as any));
    });

    await t.test("validate v3.0 Responses topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v3.0 Responses
        ts.resolves(client.publish(Topic.Responses, agvId, createHeaderlessObjectV3(Topic.Responses)));

        // Invalid: missing responses array
        ts.throws(() => client.publish(Topic.Responses, agvId, {} as any));

        // Invalid: response missing grantType
        const responsesBadGrant = {
            responses: [{ requestId: "req001" }],
        };
        ts.throws(() => client.publish(Topic.Responses, agvId, responsesBadGrant as any));
    });

    await t.test("pub-sub v3.0 standard topic objects", ts => new Promise(async resolve => {
        ts.teardown(() => client.stop());
        await client.start();

        // Test that v3.0 Order can be published and received via pub-sub
        await client.subscribe(Topic.Order, agvId, (object, subject, topic) => {
            ts.equal(topic, Topic.Order);
            ts.strictSame(subject, agvId);
            ts.equal(object.orderId, "order0001");
            resolve();
        });
        await client.publish(Topic.Order, agvId, createHeaderlessObjectV3(Topic.Order));
    }));
});
