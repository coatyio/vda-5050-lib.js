/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * Fleet-wide subscription and multi-AGV tracking tests covering:
 *
 * FR-28: Fleet-Wide Subscriptions (multiple AGVs, wildcard tracking)
 * FR-09: Connection state tracking for multiple AGVs
 * FR-27: Master Controller with multiple AGVs
 */

import * as tap from "tap";

import {
    AgvClient,
    ConnectionState,
    MasterControlClient,
    Topic,
} from "../..";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId, createHeaderlessObject } from "../test-objects";

initTestContext(tap);

/* ------------------------------------------------------------------ */
/* FR-28: Track multiple AGVs simultaneously                          */
/* ------------------------------------------------------------------ */

tap.test("Fleet - track multiple AGVs simultaneously", async t => {
    const agvId1 = createAgvId("RobotCompany", "F01");
    const agvId2 = createAgvId("RobotCompany", "F02");
    const agvId3 = createAgvId("OtherCompany", "F03");

    const mcClient = new MasterControlClient(testClientOptions(t));
    const agvClient1 = new AgvClient(agvId1, testClientOptions(t));
    const agvClient2 = new AgvClient(agvId2, testClientOptions(t));
    const agvClient3 = new AgvClient(agvId3, testClientOptions(t));

    t.test("no tracked states before starting", ts => {
        ts.strictSame(mcClient.getTrackedStates(), []);
        ts.equal(mcClient.getTrackedState(agvId1), undefined);
        ts.equal(mcClient.getTrackedState(agvId2), undefined);
        ts.equal(mcClient.getTrackedState(agvId3), undefined);
        ts.end();
    });

    await agvClient1.start();
    await agvClient2.start();
    await agvClient3.start();
    await mcClient.start();

    await t.test("trackAgvs reports all 3 AGVs online", ts => new Promise(resolve => {
        const trackedAgvs = new Set<string>();
        let resolved = false;

        mcClient.trackAgvs((subject, state) => {
            if (resolved) { return; }
            if (state === ConnectionState.Online) {
                trackedAgvs.add(subject.serialNumber);
            }
            if (trackedAgvs.size === 3) {
                resolved = true;
                ts.ok(trackedAgvs.has("F01"), "AGV F01 tracked online");
                ts.ok(trackedAgvs.has("F02"), "AGV F02 tracked online");
                ts.ok(trackedAgvs.has("F03"), "AGV F03 tracked online");

                const states = mcClient.getTrackedStates();
                ts.ok(states.length >= 3, "should have at least 3 tracked states");

                ts.not(mcClient.getTrackedState(agvId1), undefined, "agvId1 state exists");
                ts.not(mcClient.getTrackedState(agvId2), undefined, "agvId2 state exists");
                ts.not(mcClient.getTrackedState(agvId3), undefined, "agvId3 state exists");
                ts.equal(mcClient.getTrackedState(agvId1).state, ConnectionState.Online);
                ts.equal(mcClient.getTrackedState(agvId2).state, ConnectionState.Online);
                ts.equal(mcClient.getTrackedState(agvId3).state, ConnectionState.Online);

                resolve();
            }
        });
    }));

    t.test("getTrackedState returns undefined for unknown AGV", ts => {
        ts.equal(mcClient.getTrackedState(createAgvId("UnknownCompany", "999")), undefined);
        ts.equal(mcClient.getTrackedState(createAgvId("RobotCompany", "999")), undefined);
        ts.end();
    });

    await agvClient1.stop();
    await agvClient2.stop();
    await agvClient3.stop();
    await mcClient.stop();

    t.test("no tracked states after stopping MC", ts => {
        ts.strictSame(mcClient.getTrackedStates(), []);
        ts.equal(mcClient.getTrackedState(agvId1), undefined);
        ts.end();
    });
});

/* ------------------------------------------------------------------ */
/* FR-28: Subscribe and receive state from multiple AGVs              */
/* ------------------------------------------------------------------ */

tap.test("Fleet - receive state from multiple AGVs on single subscription", async t => {
    const agvId1 = createAgvId("RobotCompany", "S01");
    const agvId2 = createAgvId("RobotCompany", "S02");

    const mcClient = new MasterControlClient(testClientOptions(t));
    const agvClient1 = new AgvClient(agvId1, testClientOptions(t));
    const agvClient2 = new AgvClient(agvId2, testClientOptions(t));

    await agvClient1.start();
    await agvClient2.start();
    await mcClient.start();

    await t.test("wildcard subscription receives state from both AGVs", ts => new Promise(async resolve => {
        const receivedFrom = new Set<string>();

        const subId = await mcClient.subscribe(Topic.State,
            { manufacturer: undefined, serialNumber: undefined },
            (state, subject) => {
                receivedFrom.add(subject.serialNumber);
                if (receivedFrom.size === 2) {
                    ts.ok(receivedFrom.has("S01"), "received state from S01");
                    ts.ok(receivedFrom.has("S02"), "received state from S02");
                    mcClient.unsubscribe(subId);
                    resolve();
                }
            });

        await agvClient1.publish(Topic.State, createHeaderlessObject(Topic.State));
        await agvClient2.publish(Topic.State, createHeaderlessObject(Topic.State));
    }));

    await agvClient1.stop();
    await agvClient2.stop();
    await mcClient.stop();
});

/* ------------------------------------------------------------------ */
/* FR-09: Connection state tracking when AGV disconnects               */
/* ------------------------------------------------------------------ */

tap.test("Fleet - detect AGV disconnect via getTrackedState", async t => {
    const agvId1 = createAgvId("RobotCompany", "D01");

    const mcClient = new MasterControlClient(testClientOptions(t));
    const agvClient1 = new AgvClient(agvId1, testClientOptions(t));

    await agvClient1.start();
    await mcClient.start();

    // Wait for MC to see the AGV come online
    await t.test("AGV tracked online initially", ts => new Promise(resolve => {
        mcClient.trackAgvs((subject, state) => {
            if (subject.serialNumber === "D01" && state === ConnectionState.Online) {
                ts.pass("AGV D01 is online");
                resolve();
            }
        });
    }));

    // Stop the AGV client - MC should detect disconnect via LWT
    await agvClient1.stop();

    // Poll getTrackedState until it shows Offline (LWT may take a moment)
    await t.test("AGV tracked offline after disconnect", ts => new Promise(resolve => {
        const poll = setInterval(() => {
            const tracked = mcClient.getTrackedState(agvId1);
            if (tracked && tracked.state === ConnectionState.Offline) {
                clearInterval(poll);
                ts.equal(tracked.state, ConnectionState.Offline, "AGV D01 is offline");
                resolve();
            }
        }, 50);
    }));

    await mcClient.stop();
});
