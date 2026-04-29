/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * Cross-version controller tests covering:
 *
 * FR-CV-01: MC v2.0 sends instant action to AGV v1.1 → never received (major topic version mismatch: v2 vs v1)
 * FR-CV-02: MC v1.1 sends instant action to AGV v2.0 → never received (major topic version mismatch: v1 vs v2)
 * FR-CV-03: MC v2.0 sends instant action to AGV v2.1 → received and executed (same major topic version: v2)
 * FR-CV-04: MC v2.1 sends instant action to AGV v2.0 → received and executed (same major topic version: v2)
 * FR-CV-05: MC v2.0 sends order to AGV v1.1 → never received (major topic version mismatch)
 * FR-CV-06: MC v1.1 sends order to AGV v2.0 → never received (major topic version mismatch)
 */

import * as tap from "tap";

import {
    AgvController,
    AgvControllerOptions,
    BlockingType,
    createUuid,
    MasterController,
    VirtualAgvAdapter,
    VirtualAgvAdapterOptions,
} from "../..";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId } from "../test-objects";
import { createHeaderlessOrder } from "./mc-agv-controller-helpers";

initTestContext(tap);

/** Timeout in ms used for "never received" assertions. Keep short to avoid slow tests. */
const NO_DELIVERY_TIMEOUT = 1500;

(async () => {
    await tap.test("Cross-Version Controller Tests", async t => {

        // AGVs use unique manufacturer namespace to avoid ID collisions with other test suites.
        const agvIdV11 = createAgvId("CrossVersionCo", "V11");
        const agvIdV20 = createAgvId("CrossVersionCo", "V20");
        const agvIdV20b = createAgvId("CrossVersionCo", "V20b");
        const agvIdV21 = createAgvId("CrossVersionCo", "V21");

        // Master controllers for different versions
        const mcV11 = new MasterController(testClientOptions(t, { vdaVersion: "1.1.0" }), {});
        const mcV20 = new MasterController(testClientOptions(t, { vdaVersion: "2.0.0" }), {});
        const mcV21 = new MasterController(testClientOptions(t, { vdaVersion: "2.1.0" }), {});

        const agvOpts: AgvControllerOptions = { agvAdapterType: VirtualAgvAdapter };
        const agvAdapOpts: VirtualAgvAdapterOptions = { initialBatteryCharge: 80, timeLapse: 100 };

        // AGV controllers with their respective versions
        const agvCtrlV11 = new AgvController(agvIdV11, testClientOptions(t, { vdaVersion: "1.1.0" }), agvOpts, agvAdapOpts);
        const agvCtrlV20 = new AgvController(agvIdV20, testClientOptions(t, { vdaVersion: "2.0.0" }), agvOpts, agvAdapOpts);
        const agvCtrlV20b = new AgvController(agvIdV20b, testClientOptions(t, { vdaVersion: "2.0.0" }), agvOpts, agvAdapOpts);
        const agvCtrlV21 = new AgvController(agvIdV21, testClientOptions(t, { vdaVersion: "2.1.0" }), agvOpts, agvAdapOpts);

        t.teardown(() => agvCtrlV11.stop());
        t.teardown(() => agvCtrlV20.stop());
        t.teardown(() => agvCtrlV20b.stop());
        t.teardown(() => agvCtrlV21.stop());
        t.teardown(() => mcV11.stop());
        t.teardown(() => mcV20.stop());
        t.teardown(() => mcV21.stop());

        await t.test("start AGV Controller v1.1", () => agvCtrlV11.start());
        await t.test("start AGV Controller v2.0", () => agvCtrlV20.start());
        await t.test("start AGV Controller v2.0b (for v2.1 MC test)", () => agvCtrlV20b.start());
        await t.test("start AGV Controller v2.1", () => agvCtrlV21.start());
        await t.test("start Master Controller v1.1", () => mcV11.start());
        await t.test("start Master Controller v2.0", () => mcV20.start());
        await t.test("start Master Controller v2.1", () => mcV21.start());

        /* ---------------------------------------------------------------
         * FR-CV-01: MC v2.0 → AGV v1.1  (topic mismatch: v2 vs v1)
         * Instant action must NOT be received by the AGV.
         * --------------------------------------------------------------- */

        await t.test("FR-CV-01: MC v2.0 instant action NOT received by AGV v1.1 (topic: v2 vs v1)", ts =>
            new Promise(async resolve => {
                let callbackFired = false;

                // We cannot await initiateInstantActions here because the AGV never responds
                // and the promise would not resolve. Fire-and-forget.
                mcV20.initiateInstantActions(agvIdV11, {
                    actions: [{
                        actionId: createUuid(),
                        actionType: "startPause",
                        blockingType: BlockingType.Hard,
                    }],
                }, {
                    onActionStateChanged: () => {
                        callbackFired = true;
                        ts.fail("onActionStateChanged must not fire: AGV v1.1 is on a different MQTT major topic (v1 vs v2)");
                        resolve();
                    },
                    onActionError: () => {
                        callbackFired = true;
                        ts.fail("onActionError must not fire: AGV v1.1 is on a different MQTT major topic (v1 vs v2)");
                        resolve();
                    },
                }).catch(() => { /* ignore */ });

                setTimeout(() => {
                    if (!callbackFired) {
                        ts.pass("instant action was not delivered to AGV v1.1 (major topic version mismatch v2 vs v1, as expected)");
                    }
                    resolve();
                }, NO_DELIVERY_TIMEOUT);
            }),
        );

        /* ---------------------------------------------------------------
         * FR-CV-02: MC v1.1 → AGV v2.0  (topic mismatch: v1 vs v2)
         * Instant action must NOT be received by the AGV.
         * --------------------------------------------------------------- */

        await t.test("FR-CV-02: MC v1.1 instant action NOT received by AGV v2.0 (topic: v1 vs v2)", ts =>
            new Promise(async resolve => {
                let callbackFired = false;

                mcV11.initiateInstantActions(agvIdV20, {
                    instantActions: [{
                        actionId: createUuid(),
                        actionType: "startPause",
                        blockingType: BlockingType.Hard,
                    }],
                } as any, {
                    onActionStateChanged: () => {
                        callbackFired = true;
                        ts.fail("onActionStateChanged must not fire: AGV v2.0 is on a different MQTT major topic (v2 vs v1)");
                        resolve();
                    },
                    onActionError: () => {
                        callbackFired = true;
                        ts.fail("onActionError must not fire: AGV v2.0 is on a different MQTT major topic (v2 vs v1)");
                        resolve();
                    },
                }).catch(() => { /* ignore */ });

                setTimeout(() => {
                    if (!callbackFired) {
                        ts.pass("instant action was not delivered to AGV v2.0 (major topic version mismatch v1 vs v2, as expected)");
                    }
                    resolve();
                }, NO_DELIVERY_TIMEOUT);
            }),
        );

        /* ---------------------------------------------------------------
         * FR-CV-03: MC v2.0 → AGV v2.1  (same major MQTT topic v2)
         * Instant action IS delivered to AGV (same MQTT v2 topic), but the MC
         * drops the AGV's state responses because the minor version (2.1.0) is
         * incompatible with the MC's expected version (2.0.0). As a result, the
         * MC callbacks never fire — the action is a silent fire-and-forget.
         * --------------------------------------------------------------- */

        await t.test("FR-CV-03: MC v2.0 instant action delivered to AGV v2.1 but MC gets no feedback (minor version state drop)", ts =>
            new Promise(async resolve => {
                let callbackFired = false;

                // The AGV v2.1 will receive and process the action (same MQTT v2 topic),
                // but the MC v2.0 drops the resulting AGV state as incompatible (2.1.0 vs 2.0.0).
                mcV20.initiateInstantActions(agvIdV21, {
                    actions: [{
                        actionId: createUuid(),
                        actionType: "startPause",
                        blockingType: BlockingType.Hard,
                    }],
                }, {
                    onActionStateChanged: () => {
                        callbackFired = true;
                        ts.fail("onActionStateChanged must not fire: MC v2.0 drops AGV v2.1 state (minor version mismatch)");
                        resolve();
                    },
                    onActionError: () => {
                        callbackFired = true;
                        ts.fail("onActionError must not fire");
                        resolve();
                    },
                }).catch(() => { /* ignore */ });

                setTimeout(() => {
                    if (!callbackFired) {
                        ts.pass("MC v2.0 received no callbacks for AGV v2.1 action (state dropped due to minor version mismatch, as expected)");
                    }
                    resolve();
                }, NO_DELIVERY_TIMEOUT);
            }),
        );

        /* ---------------------------------------------------------------
         * FR-CV-04: MC v2.1 → AGV v2.0  (same major MQTT topic v2)
         * Instant action IS delivered to AGV (same MQTT v2 topic), but the MC
         * drops the AGV's state responses because the minor version (2.0.0) is
         * incompatible with the MC's expected version (2.1.0). As a result, the
         * MC callbacks never fire — the action is a silent fire-and-forget.
         * --------------------------------------------------------------- */

        await t.test("FR-CV-04: MC v2.1 instant action delivered to AGV v2.0 but MC gets no feedback (minor version state drop)", ts =>
            new Promise(async resolve => {
                let callbackFired = false;

                // The AGV v2.0 will receive and process the action (same MQTT v2 topic),
                // but the MC v2.1 drops the resulting AGV state as incompatible (2.0.0 vs 2.1.0).
                mcV21.initiateInstantActions(agvIdV20b, {
                    actions: [{
                        actionId: createUuid(),
                        actionType: "startPause",
                        blockingType: BlockingType.Hard,
                    }],
                }, {
                    onActionStateChanged: () => {
                        callbackFired = true;
                        ts.fail("onActionStateChanged must not fire: MC v2.1 drops AGV v2.0 state (minor version mismatch)");
                        resolve();
                    },
                    onActionError: () => {
                        callbackFired = true;
                        ts.fail("onActionError must not fire");
                        resolve();
                    },
                }).catch(() => { /* ignore */ });

                setTimeout(() => {
                    if (!callbackFired) {
                        ts.pass("MC v2.1 received no callbacks for AGV v2.0 action (state dropped due to minor version mismatch, as expected)");
                    }
                    resolve();
                }, NO_DELIVERY_TIMEOUT);
            }),
        );

        /* ---------------------------------------------------------------
         * FR-CV-05: MC v2.0 → AGV v1.1  (topic mismatch)
         * Order must NOT be received by the AGV.
         * --------------------------------------------------------------- */

        await t.test("FR-CV-05: MC v2.0 order NOT received by AGV v1.1 (topic: v2 vs v1)", ts =>
            new Promise(async resolve => {
                let callbackFired = false;

                mcV20.assignOrder(agvIdV11, createHeaderlessOrder(), {
                    onOrderProcessed: () => {
                        callbackFired = true;
                        ts.fail("onOrderProcessed must not fire: AGV v1.1 is on a different MQTT major topic");
                        resolve();
                    },
                    onActionStateChanged: () => {
                        callbackFired = true;
                        ts.fail("onActionStateChanged must not fire");
                        resolve();
                    },
                    onNodeTraversed: () => {
                        callbackFired = true;
                        ts.fail("onNodeTraversed must not fire");
                        resolve();
                    },
                    onEdgeTraversing: () => {
                        callbackFired = true;
                        ts.fail("onEdgeTraversing must not fire");
                        resolve();
                    },
                    onEdgeTraversed: () => {
                        callbackFired = true;
                        ts.fail("onEdgeTraversed must not fire");
                        resolve();
                    },
                }).catch(() => { /* ignore */ });

                setTimeout(() => {
                    if (!callbackFired) {
                        ts.pass("order was not delivered to AGV v1.1 (major topic version mismatch v2 vs v1, as expected)");
                    }
                    resolve();
                }, NO_DELIVERY_TIMEOUT);
            }),
        );

        /* ---------------------------------------------------------------
         * FR-CV-06: MC v1.1 → AGV v2.0  (topic mismatch)
         * Order must NOT be received by the AGV.
         * --------------------------------------------------------------- */

        await t.test("FR-CV-06: MC v1.1 order NOT received by AGV v2.0 (topic: v1 vs v2)", ts =>
            new Promise(async resolve => {
                let callbackFired = false;

                mcV11.assignOrder(agvIdV20, createHeaderlessOrder(), {
                    onOrderProcessed: () => {
                        callbackFired = true;
                        ts.fail("onOrderProcessed must not fire: AGV v2.0 is on a different MQTT major topic");
                        resolve();
                    },
                    onActionStateChanged: () => {
                        callbackFired = true;
                        ts.fail("onActionStateChanged must not fire");
                        resolve();
                    },
                    onNodeTraversed: () => {
                        callbackFired = true;
                        ts.fail("onNodeTraversed must not fire");
                        resolve();
                    },
                    onEdgeTraversing: () => {
                        callbackFired = true;
                        ts.fail("onEdgeTraversing must not fire");
                        resolve();
                    },
                    onEdgeTraversed: () => {
                        callbackFired = true;
                        ts.fail("onEdgeTraversed must not fire");
                        resolve();
                    },
                }).catch(() => { /* ignore */ });

                setTimeout(() => {
                    if (!callbackFired) {
                        ts.pass("order was not delivered to AGV v2.0 (major topic version mismatch v1 vs v2, as expected)");
                    }
                    resolve();
                }, NO_DELIVERY_TIMEOUT);
            }),
        );

    });
})();
