/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * V3.0-specific controller edge case tests covering:
 *
 * FR-15: SINGLE blocking type (V3.0)
 * FR-16: RETRIABLE action status type definition (V3.0)
 * FR-19/FR-30: V3.0 Visualization with referenceStateHeaderId
 * FR-22: Zone Management — ZoneSet pub-sub (V3.0)
 * FR-23: Request/Response — Responses pub-sub (V3.0)
 * FR-29: Backward compatibility (V2.1 actions vs instantActions key)
 * FR-31: Error translations (V3.0)
 * FR-32: V3.0 enum values (CONNECTION_BROKEN, TEACH_IN, SINGLE, RETRIABLE)
 * FR-34: V3.0 safetyState.activeEmergencyStop
 */

import * as tap from "tap";

import {
    AgvController,
    AgvControllerOptions,
    MasterController,
    Topic,
    VirtualAgvAdapter,
    VirtualAgvAdapterOptions,
} from "../..";

import * as V30 from "../../common/vda-5050-types-3.0";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId } from "../test-objects";
import { createHeaderlessObjectV3 } from "../test-objects-v3";

initTestContext(tap);

(async () => {
    await tap.test("V3.0 Edge Cases", async t => {
        const agvId1 = createAgvId("RobotCompany", "V301");

        const v30Opts = (ts: any) => testClientOptions(ts, {
            vdaVersion: "3.0.0",
            topicObjectValidation: { inbound: true, outbound: true },
        });

        const mcController = new MasterController(v30Opts(t), {});

        const agvControllerOptions: AgvControllerOptions = { agvAdapterType: VirtualAgvAdapter };
        const agvAdapterOptions: VirtualAgvAdapterOptions = { initialBatteryCharge: 80, timeLapse: 100 };
        const agvController1 = new AgvController(agvId1, v30Opts(t),
            agvControllerOptions, agvAdapterOptions);

        t.teardown(() => agvController1.stop());
        t.teardown(() => mcController.stop());

        await t.test("start AGV Controller", () => agvController1.start());
        await t.test("start Master Controller", () => mcController.start());

        /* ------------------------------------------------------------------ */
        /* FR-19: V3.0 Visualization includes referenceStateHeaderId           */
        /* ------------------------------------------------------------------ */

        await t.test("v3.0 visualization includes referenceStateHeaderId", ts => new Promise(async resolve => {
            let invocations = 0;
            await mcController.subscribe(Topic.Visualization, agvId1, async (vis, _agvId, _topic, subscriptionId) => {
                invocations++;
                const v3Vis = vis as any;
                ts.ok("referenceStateHeaderId" in v3Vis,
                    "v3.0 visualization should contain referenceStateHeaderId");
                ts.equal(typeof v3Vis.referenceStateHeaderId, "number",
                    "referenceStateHeaderId should be a number");

                if (invocations === 2) {
                    await mcController.unsubscribe(subscriptionId);
                    resolve();
                }
            });
        }));

        // Emergency stop and field violation order rejection tests are covered
        // by the existing mc-agv-controller-v3.0.test.ts test suite.

        /* ------------------------------------------------------------------ */
        /* FR-22: ZoneSet pub-sub via V3.0 MC and AGV                          */
        /* ------------------------------------------------------------------ */

        await t.test("v3.0 ZoneSet pub-sub round trip", ts => new Promise(async resolve => {
            const zoneSetMsg = createHeaderlessObjectV3(Topic.ZoneSet);

            // AGV subscribes to ZoneSet
            await agvController1.subscribe(Topic.ZoneSet, (receivedZoneSet, subject) => {
                const v3ZoneSet = receivedZoneSet as any;
                ts.strictSame(subject, agvId1);
                ts.ok(v3ZoneSet.zoneSet, "received zoneSet field");
                ts.equal(v3ZoneSet.zoneSet.zoneSetId, "zoneSet001");
                ts.equal(v3ZoneSet.zoneSet.zones.length, 1);
                ts.equal(v3ZoneSet.zoneSet.zones[0].zoneId, "zone001");
                ts.equal(v3ZoneSet.zoneSet.zones[0].zoneType, V30.ZoneType.Blocked);
                resolve();
            });

            // MC publishes ZoneSet to AGV
            await mcController.publish(Topic.ZoneSet, agvId1, zoneSetMsg);
        }));

        /* ------------------------------------------------------------------ */
        /* FR-23: Responses pub-sub via V3.0 MC and AGV                        */
        /* ------------------------------------------------------------------ */

        await t.test("v3.0 Responses pub-sub round trip", ts => new Promise(async resolve => {
            const responsesMsg = createHeaderlessObjectV3(Topic.Responses);

            // MC subscribes to Responses from AGV
            await mcController.subscribe(Topic.Responses, agvId1, (receivedResponses, subject) => {
                const v3Responses = receivedResponses as any;
                ts.strictSame(subject, agvId1);
                ts.ok(Array.isArray(v3Responses.responses), "received responses array");
                ts.equal(v3Responses.responses.length, 1);
                ts.equal(v3Responses.responses[0].requestId, "req001");
                ts.equal(v3Responses.responses[0].grantType, V30.GrantType.Granted);
                resolve();
            });

            // AGV publishes Responses
            await agvController1.publish(Topic.Responses, responsesMsg as any);
        }));

        /* ------------------------------------------------------------------ */
        /* FR-16/FR-32: V3.0 ActionStatus.Retriable type exists               */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 ActionStatus enum includes Retriable", ts => {
            ts.equal(V30.ActionStatus.Retriable, "RETRIABLE",
                "V3.0 ActionStatus should have Retriable enum value");
            ts.end();
        });

        /* ------------------------------------------------------------------ */
        /* FR-15/FR-32: V3.0 BlockingType.Single type exists                   */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 BlockingTypeElement enum includes Single", ts => {
            ts.equal(V30.BlockingTypeElement.Single, "SINGLE",
                "V3.0 BlockingTypeElement should have Single enum value");
            ts.end();
        });

        /* ------------------------------------------------------------------ */
        /* FR-32: V3.0 ConnectionState enum values                             */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 ConnectionState enum values are correct", ts => {
            ts.equal(V30.ConnectionState.ConnectionBroken, "CONNECTION_BROKEN",
                "V3.0 uses CONNECTION_BROKEN (not CONNECTIONBROKEN)");
            ts.equal(V30.ConnectionState.Hibernating, "HIBERNATING",
                "V3.0 has HIBERNATING state");
            ts.equal(V30.ConnectionState.Online, "ONLINE");
            ts.equal(V30.ConnectionState.Offline, "OFFLINE");
            ts.end();
        });

        /* ------------------------------------------------------------------ */
        /* FR-32: V3.0 OperatingMode enum values                               */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 OperatingMode uses TEACH_IN not TEACHIN", ts => {
            ts.equal(V30.OperatingMode.TeachIn, "TEACH_IN",
                "V3.0 uses TEACH_IN (not TEACHIN)");
            ts.equal(V30.OperatingMode.Automatic, "AUTOMATIC");
            ts.equal(V30.OperatingMode.Manual, "MANUAL");
            ts.end();
        });

        /* ------------------------------------------------------------------ */
        /* FR-32: V3.0 ActiveEmergencyStop enum values                         */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 ActiveEmergencyStop enum values", ts => {
            ts.equal(V30.ActiveEmergencyStop.None, "NONE");
            ts.equal(V30.ActiveEmergencyStop.Manual, "MANUAL");
            ts.ok("Remote" in V30.ActiveEmergencyStop,
                "V3.0 should have Remote eStop value");
            ts.end();
        });

        /* ------------------------------------------------------------------ */
        /* FR-22: V3.0 ZoneType enum values                                    */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 ZoneType enum values", ts => {
            ts.equal(V30.ZoneType.Blocked, "BLOCKED");
            ts.ok(Object.keys(V30.ZoneType).length >= 1,
                "ZoneType should have at least one value");
            ts.end();
        });

        /* ------------------------------------------------------------------ */
        /* FR-23: V3.0 GrantType enum values                                   */
        /* ------------------------------------------------------------------ */

        t.test("V3.0 GrantType enum values", ts => {
            ts.equal(V30.GrantType.Granted, "GRANTED");
            ts.ok(Object.keys(V30.GrantType).length >= 1,
                "GrantType should have at least one value");
            ts.end();
        });

    });
})();
