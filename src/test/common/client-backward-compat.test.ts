/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * Backward compatibility tests covering:
 *
 * FR-29: V2.1 InstantActions dual-field (actions vs instantActions key)
 * FR-32: Cross-version enum compatibility
 * FR-05: Topic structure with different interfaceNames
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

tap.test("Backward Compatibility", async t => {
    const agvId = createAgvId("RobotCompany", "001");

    /* ------------------------------------------------------------------ */
    /* FR-29: V2.1 InstantActions uses 'actions' key                      */
    /* ------------------------------------------------------------------ */

    await t.test("v2.1 InstantActions accepts 'actions' key", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        // V2.1 should accept 'actions' instead of 'instantActions'
        ts.resolves(client21.publish(Topic.InstantActions, agvId, { actions: [] } as any));
    });

    await t.test("v2.1 InstantActions rejects v1.1 'instantActions' key", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        // V2.1 should reject the v1.1 'instantActions' key
        ts.throws(() => client21.publish(Topic.InstantActions, agvId,
            createHeaderlessObject(Topic.InstantActions) as any));
    });

    await t.test("v1.1 InstantActions uses 'instantActions' key", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        // V1.1 uses 'instantActions' key
        ts.resolves(client11.publish(Topic.InstantActions, agvId,
            createHeaderlessObject(Topic.InstantActions)));
    });

    await t.test("v2.0 InstantActions uses 'actions' key", async ts => {
        const client20 = new TestClient(testClientOptions(t, { vdaVersion: "2.0.0" }));
        ts.teardown(() => client20.stop());
        await client20.start();

        // V2.0 should also use 'actions'
        ts.resolves(client20.publish(Topic.InstantActions, agvId, { actions: [] } as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-32: Cross-version Connection enum compatibility                  */
    /* ------------------------------------------------------------------ */

    await t.test("v1.1 Connection uses CONNECTIONBROKEN", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        ts.resolves(client11.publish(Topic.Connection, agvId,
            { connectionState: "CONNECTIONBROKEN" } as any));
        ts.resolves(client11.publish(Topic.Connection, agvId,
            { connectionState: "ONLINE" } as any));
        ts.resolves(client11.publish(Topic.Connection, agvId,
            { connectionState: "OFFLINE" } as any));
    });

    await t.test("v3.0 Connection uses CONNECTION_BROKEN not CONNECTIONBROKEN", async ts => {
        const client30 = new TestClient(testClientOptions(t, { vdaVersion: "3.0.0" }));
        ts.teardown(() => client30.stop());
        await client30.start();

        ts.resolves(client30.publish(Topic.Connection, agvId,
            { connectionState: "CONNECTION_BROKEN" } as any));
        ts.throws(() => client30.publish(Topic.Connection, agvId,
            { connectionState: "CONNECTIONBROKEN" } as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-32: Cross-version OperatingMode compatibility                    */
    /* ------------------------------------------------------------------ */

    await t.test("v2.1 uses TEACHIN operating mode", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        const state = { ...createHeaderlessObject(Topic.State), operatingMode: "TEACHIN" };
        ts.resolves(client21.publish(Topic.State, agvId, state as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-05: Topic structure with custom interfaceName                    */
    /* ------------------------------------------------------------------ */

    await t.test("pub-sub with custom interfaceName", ts => new Promise(async resolve => {
        const customOpts = testClientOptions(t, { interfaceName: "customVDA" });
        const client1 = new TestClient(customOpts);
        ts.teardown(() => client1.stop());
        await client1.start();

        await client1.subscribe(Topic.Order, agvId, (object, subject, topic) => {
            ts.equal(topic, Topic.Order);
            ts.strictSame(subject, agvId);
            ts.equal(object.orderId, "order0001");
            resolve();
        });
        await client1.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    await t.test("clients with different interfaceNames are isolated", ts => new Promise(async resolve => {
        const opts1 = testClientOptions(t, { interfaceName: "iface_A" });
        const opts2 = testClientOptions(t, { interfaceName: "iface_B" });
        const clientA = new TestClient(opts1);
        const clientB = new TestClient(opts2);
        ts.teardown(async () => { await clientA.stop(); await clientB.stop(); });
        await clientA.start();
        await clientB.start();

        let receivedByB = false;
        await clientB.subscribe(Topic.Order, agvId, () => {
            receivedByB = true;
        });
        await clientA.subscribe(Topic.Order, agvId, () => {
            // Client A receives its own message
            setTimeout(() => {
                ts.equal(receivedByB, false, "clientB should not receive clientA messages");
                resolve();
            }, 500);
        });
        await clientA.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    /* ------------------------------------------------------------------ */
    /* FR-20: Factsheet supported from V2.0 onwards, not in V1.1          */
    /* ------------------------------------------------------------------ */

    await t.test("v1.1 does not support Factsheet topic", async ts => {
        const client11 = new TestClient(testClientOptions(t, { vdaVersion: "1.1.0" }));
        ts.teardown(() => client11.stop());
        await client11.start();

        ts.throws(() => client11.publish(Topic.Factsheet, agvId, {} as any));
    });

    await t.test("v2.0 supports Factsheet topic", async ts => {
        const client20 = new TestClient(testClientOptions(t, { vdaVersion: "2.0.0" }));
        ts.teardown(() => client20.stop());
        await client20.start();

        ts.resolves(client20.publish(Topic.Factsheet, agvId, {} as any));
    });

    /* ------------------------------------------------------------------ */
    /* FR-03: V2.x does not support ZoneSet and Responses topics           */
    /* ------------------------------------------------------------------ */

    await t.test("v2.1 does not support ZoneSet topic", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        ts.throws(() => client21.publish(Topic.ZoneSet, agvId, {} as any));
    });

    await t.test("v2.1 does not support Responses topic", async ts => {
        const client21 = new TestClient(testClientOptions(t, { vdaVersion: "2.1.0" }));
        ts.teardown(() => client21.stop());
        await client21.start();

        ts.throws(() => client21.publish(Topic.Responses, agvId, {} as any));
    });
});
