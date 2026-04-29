/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// tslint:disable: no-empty

import * as tap from "tap";

import { AgvClient, Topic } from "../..";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId } from "../test-objects";
import { createHeaderlessObjectV3 } from "../test-objects-v3";

initTestContext(tap);

tap.test("AGV Client V3.0", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t, { vdaVersion: "3.0.0" });
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

        ts.resolves(client.publish(Topic.Connection, createHeaderlessObjectV3(Topic.Connection)));
        ts.resolves(client.publish(Topic.State, createHeaderlessObjectV3(Topic.State)));
        ts.resolves(client.publish(Topic.Visualization, createHeaderlessObjectV3(Topic.Visualization)));
        ts.resolves(client.publish(Topic.Factsheet, createHeaderlessObjectV3(Topic.Factsheet)));
        ts.throws(() => client.publish(Topic.InstantActions, createHeaderlessObjectV3(Topic.InstantActions)));
        ts.throws(() => client.publish(Topic.Order, createHeaderlessObjectV3(Topic.Order)));
    });

    await t.test("validate v3.0 topic object shapes", async ts => {
        ts.teardown(() => client.stop());
        await client.start();

        // V3.0 Connection uses CONNECTION_BROKEN instead of CONNECTIONBROKEN
        ts.resolves(client.publish(Topic.Connection, createHeaderlessObjectV3(Topic.Connection)));

        // V3.0 State requires powerSupply instead of batteryState
        ts.resolves(client.publish(Topic.State, createHeaderlessObjectV3(Topic.State)));

        // V3.0 State with v2.1 shape (batteryState) should fail validation
        const v21StateShape = {
            actionStates: [],
            batteryState: { batteryCharge: 0.8, charging: false },
            driving: false,
            edgeStates: [],
            errors: [],
            lastNodeId: "",
            lastNodeSequenceId: 0,
            nodeStates: [],
            operatingMode: "AUTOMATIC",
            orderId: "",
            orderUpdateId: 0,
            safetyState: { eStop: "NONE", fieldViolation: false },
        };
        ts.throws(() => client.publish(Topic.State, v21StateShape as any));

        // V3.0 Visualization requires referenceStateHeaderId
        ts.resolves(client.publish(Topic.Visualization, createHeaderlessObjectV3(Topic.Visualization)));

        // V3.0 Factsheet with required fields
        ts.resolves(client.publish(Topic.Factsheet, createHeaderlessObjectV3(Topic.Factsheet)));

        // V3.0 ZoneSet topic
        ts.resolves(client.publish(Topic.ZoneSet, createHeaderlessObjectV3(Topic.ZoneSet)));

        // V3.0 Responses topic
        ts.resolves(client.publish(Topic.Responses, createHeaderlessObjectV3(Topic.Responses)));
    });
});
