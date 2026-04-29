/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// tslint:disable: no-empty

import * as tap from "tap";

import { AgvId, Client, ClientPublishOptions, Connection, ConnectionState, Headerless, SubscriptionId, Topic, TopicObject } from "../..";
import { SubscriptionHandler } from "../../common/client-types";

import { initTestContext, testClientOptions } from "../test-context";
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

tap.test("Client V2.0 Validation", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t, { vdaVersion: "2.0.0" });
    const client = new TestClient(clientOptions);

    t.test("check v2.0 protocol version", ts => {
        ts.equal(client.protocolVersion, "2.0.0", "expect v2.0.0 protocol version");
        ts.end();
    });

    await t.test("validate v2.0 Connection topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v2.0 Connection
        ts.resolves(client.publish(Topic.Connection, agvId, createHeaderlessObject(Topic.Connection)));

        // Invalid: missing connectionState
        ts.throws(() => client.publish(Topic.Connection, agvId, {} as any));
    });

    await t.test("validate v2.0 InstantActions topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v2.0 InstantActions (uses 'actions' key, not 'instantActions')
        ts.resolves(client.publish(Topic.InstantActions, agvId, { actions: [] } as any));

        // Invalid: v1.1 shape with 'instantActions' key
        ts.throws(() => client.publish(Topic.InstantActions, agvId,
            createHeaderlessObject(Topic.InstantActions) as any));

        // Invalid: empty object
        ts.throws(() => client.publish(Topic.InstantActions, agvId, {} as any));
    });

    await t.test("validate v2.0 Order topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v2.0 Order
        ts.resolves(client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order)));

        // Invalid: missing required fields
        ts.throws(() => client.publish(Topic.Order, agvId, {} as any));
    });

    await t.test("validate v2.0 State topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v2.0 State
        ts.resolves(client.publish(Topic.State, agvId, createHeaderlessObject(Topic.State)));

        // Invalid: missing required fields
        ts.throws(() => client.publish(Topic.State, agvId, {} as any));

        // Invalid: missing batteryState
        const stateMissingBattery = { ...createHeaderlessObject(Topic.State) };
        delete (stateMissingBattery as any).batteryState;
        ts.throws(() => client.publish(Topic.State, agvId, stateMissingBattery as any));
    });

    await t.test("validate v2.0 Visualization topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v2.0 Visualization
        ts.resolves(client.publish(Topic.Visualization, agvId, createHeaderlessObject(Topic.Visualization)));

        // Visualization accepts empty/minimal objects
        ts.resolves(client.publish(Topic.Visualization, agvId, {} as any));
    });

    await t.test("validate v2.0 Factsheet topic object", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // Valid v2.0 Factsheet (all fields optional beyond header)
        ts.resolves(client.publish(Topic.Factsheet, agvId, {} as any));

        // Factsheet with optional fields
        ts.resolves(client.publish(Topic.Factsheet, agvId, {
            typeSpecification: {
                seriesName: "TestBot",
                agvKinematic: "DIFF",
                agvClass: "CARRIER",
                maxLoadMass: 100,
                localizationTypes: ["NATURAL"],
                navigationTypes: ["AUTONOMOUS"],
            },
        } as any));
    });

    await t.test("validate v2.0 Factsheet not supported in v1.1", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        // Factsheet topic not supported in v1.1
        ts.throws(() => client11.publish(Topic.Factsheet, agvId, {} as any));
    });

    await t.test("pub-sub v2.0 standard topic objects", ts => new Promise(async resolve => {
        ts.teardown(() => client.stop());
        await client.start();

        // Test that v2.0 Order can be published and received via pub-sub
        await client.subscribe(Topic.Order, agvId, (object, subject, topic) => {
            ts.equal(topic, Topic.Order);
            ts.strictSame(subject, agvId);
            ts.equal(object.orderId, "order0001");
            resolve();
        });
        await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));
});
