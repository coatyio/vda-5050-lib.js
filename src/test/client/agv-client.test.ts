/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// tslint:disable: no-empty

import * as tap from "tap";

import { AgvClient, Topic } from "../..";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId, createHeaderlessObject } from "../test-objects";

initTestContext(tap);

tap.test("AGV Client V1.1", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t, { vdaVersion: "1.1.0" });
    const client = new AgvClient(agvId, clientOptions);

    await t.test("validate subscription topic direction", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        ts.throws(() => client.subscribe(Topic.Connection, () => { }));
        ts.throws(() => client.subscribe(Topic.State, () => { }));
        ts.throws(() => client.subscribe(Topic.Visualization, () => { }));
        ts.resolves(client.subscribe(Topic.InstantActions, () => { }));
        ts.resolves(client.subscribe(Topic.Order, () => { }));
    });

    await t.test("validate publication topic direction", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        ts.resolves(client.publish(Topic.Connection, createHeaderlessObject(Topic.Connection)));
        ts.resolves(client.publish(Topic.State, createHeaderlessObject(Topic.State)));
        ts.resolves(client.publish(Topic.Visualization, createHeaderlessObject(Topic.Visualization)));
        ts.throws(() => client.publish(Topic.InstantActions, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish(Topic.Order, createHeaderlessObject(Topic.Order)));
    });
});

tap.test("AGV Client V2.0", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t, { vdaVersion: "2.0.0" });
    const client = new AgvClient(agvId, clientOptions);

    await t.test("validate subscription topic direction", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        ts.throws(() => client.subscribe(Topic.Connection, () => { }));
        ts.throws(() => client.subscribe(Topic.State, () => { }));
        ts.throws(() => client.subscribe(Topic.Visualization, () => { }));
        ts.resolves(client.subscribe(Topic.InstantActions, () => { }));
        ts.resolves(client.subscribe(Topic.Order, () => { }));
    });

    await t.test("validate publication topic direction", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        ts.resolves(client.publish(Topic.Connection, createHeaderlessObject(Topic.Connection)));
        ts.resolves(client.publish(Topic.State, createHeaderlessObject(Topic.State)));
        ts.resolves(client.publish(Topic.Visualization, createHeaderlessObject(Topic.Visualization)));
        ts.resolves(client.publish(Topic.Factsheet, createHeaderlessObject(Topic.Factsheet)));
        ts.throws(() => client.publish(Topic.InstantActions, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish(Topic.Order, createHeaderlessObject(Topic.Order)));
    });
});

tap.test("AGV Client V2.1", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t, { vdaVersion: "2.1.0" });
    const client = new AgvClient(agvId, clientOptions);

    await t.test("validate subscription topic direction", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        ts.throws(() => client.subscribe(Topic.Connection, () => { }));
        ts.throws(() => client.subscribe(Topic.State, () => { }));
        ts.throws(() => client.subscribe(Topic.Visualization, () => { }));
        ts.resolves(client.subscribe(Topic.InstantActions, () => { }));
        ts.resolves(client.subscribe(Topic.Order, () => { }));
    });

    await t.test("validate publication topic direction", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        ts.resolves(client.publish(Topic.Connection, createHeaderlessObject(Topic.Connection)));
        ts.resolves(client.publish(Topic.State, createHeaderlessObject(Topic.State)));
        ts.resolves(client.publish(Topic.Visualization, createHeaderlessObject(Topic.Visualization)));
        ts.resolves(client.publish(Topic.Factsheet, createHeaderlessObject(Topic.Factsheet)));
        ts.throws(() => client.publish(Topic.InstantActions, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish(Topic.Order, createHeaderlessObject(Topic.Order)));
    });
});
