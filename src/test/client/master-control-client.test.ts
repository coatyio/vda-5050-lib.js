/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// tslint:disable: no-empty

import * as tap from "tap";

import { MasterControlClient, Topic } from "../..";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId, createHeaderlessObject } from "../test-objects";

initTestContext(tap);

tap.test("Master Control Client", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t);
    const client = new MasterControlClient(clientOptions);

    await t.test("validate subscription topic direction", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();

        ts.resolves(client.subscribe(Topic.Connection, agvId, () => { }));
        ts.resolves(client.subscribe(Topic.State, agvId, () => { }));
        ts.resolves(client.subscribe(Topic.Visualization, agvId, () => { }));
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId, () => { }));
        ts.throws(() => client.subscribe(Topic.Order, agvId, () => { }));
    });

    await t.test("validate publication topic direction", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();

        ts.throws(() => client.publish(Topic.Connection, agvId, createHeaderlessObject(Topic.Connection)));
        ts.throws(() => client.publish(Topic.State, agvId, createHeaderlessObject(Topic.State)));
        ts.throws(() => client.publish(Topic.Visualization, agvId, createHeaderlessObject(Topic.Visualization)));
        ts.resolves(client.publish(Topic.InstantActions, agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.resolves(client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order)));
    });
});
