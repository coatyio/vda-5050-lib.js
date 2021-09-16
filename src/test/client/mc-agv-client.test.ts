/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import * as tap from "tap";

import { AgvClient, ConnectionState, MasterControlClient, Order, State, SubscriptionId, Topic } from "../..";

import { initTestContext, testClientOptions } from "../test-context";
import { createAgvId, createHeaderlessObject } from "../test-objects";

initTestContext(tap);

tap.test("Master Control Client - AGV Client", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const mcClient = new MasterControlClient(testClientOptions(t));
    const agvClient = new AgvClient(agvId, testClientOptions(t));

    t.test("no tracked state available before starting", ts => {
        ts.equal(mcClient.getTrackedState(agvId), undefined);
        ts.equal(mcClient.getTrackedState({ ...agvId, manufacturer: "FooCompany" }), undefined);
        ts.equal(mcClient.getTrackedState({ ...agvId, serialNumber: "002" }), undefined);
        ts.strictSame(mcClient.getTrackedStates(), []);
        ts.end();
    });

    let trackInvocationCountFirst = 0;
    mcClient.trackAgvs((subject, state, timestamp) => {
        trackInvocationCountFirst++;

        tap.test("track AGV Client before start", ts => {
            ts.equal(trackInvocationCountFirst < 3, true);
            ts.strictSame(subject, agvId);
            ts.equal(timestamp, mcClient.getTrackedState(agvId).timestamp);
            ts.equal(state, mcClient.getTrackedState(agvId).state);
            ts.equal(state, trackInvocationCountFirst === 1 ? ConnectionState.Online : ConnectionState.Offline);
            ts.strictSame(mcClient.getTrackedStates(), [{ subject, state, timestamp }]);
            ts.end();
        });
    });

    await t.test("start AGV Client", async () => {
        await agvClient.start();
    });
    await t.test("start Master Control Client", async () => {
        await mcClient.start();
    });

    let trackInvocationCountSecond = 0;
    mcClient.trackAgvs((subject, state, timestamp) => {
        trackInvocationCountSecond++;

        tap.test("track AGV Client after start", ts => {
            ts.equal(trackInvocationCountSecond < 3, true);
            ts.strictSame(subject, agvId);
            ts.equal(timestamp, mcClient.getTrackedState(agvId).timestamp);
            ts.equal(state, mcClient.getTrackedState(agvId).state);
            ts.equal(state, trackInvocationCountSecond === 1 ? ConnectionState.Online : ConnectionState.Offline);
            ts.equal(mcClient.getTrackedState({ ...agvId, manufacturer: "FooCompany" }), undefined);
            ts.equal(mcClient.getTrackedState({ ...agvId, serialNumber: "002" }), undefined);
            ts.strictSame(mcClient.getTrackedStates(), [{ subject, state, timestamp }]);
            ts.end();

            // Track AGVs once again to test immediate dispatch of already known initial connection states.
            if (trackInvocationCountSecond === 1) {
                let trackInvocationCountThird = 0;
                mcClient.trackAgvs((sub, st, tsp) => {
                    trackInvocationCountThird++;

                    tap.test("track AGV Client with known initial states", tss => {
                        tss.equal(trackInvocationCountThird < 3, true);
                        tss.strictSame(sub, agvId);
                        tss.equal(tsp, mcClient.getTrackedState(agvId).timestamp);
                        tss.equal(st, mcClient.getTrackedState(agvId).state);
                        tss.equal(st, trackInvocationCountThird === 1 ? ConnectionState.Online : ConnectionState.Offline);
                        tss.equal(mcClient.getTrackedState({ ...agvId, manufacturer: "FooCompany" }), undefined);
                        tss.equal(mcClient.getTrackedState({ ...agvId, serialNumber: "002" }), undefined);
                        tss.strictSame(mcClient.getTrackedStates(), [{ subject: sub, state: st, timestamp: tsp }]);
                        tss.end();
                    });
                });
            }
        });
    });

    const headerlessOrder1 = createHeaderlessObject(Topic.Order);
    const headerlessOrderState1 = createHeaderlessObject(Topic.State);

    let order1: Order;
    let orderState1: State;
    let subIdOrder: SubscriptionId;

    await t.test("subscribe order on AGV", async () => {
        let subCounterOrder = 0;
        subIdOrder = await agvClient.subscribe(Topic.Order, async (order, subject, topic, id) => {
            subCounterOrder++;

            tap.test("inbound order on AGV", ts => {
                ts.equal(subCounterOrder, 1);
                ts.equal(topic, Topic.Order);
                ts.strictSame(subject, agvClient.agvId);
                ts.strictSame(order, order1);
                ts.equal(id, subIdOrder);
                ts.end();
            });

            headerlessOrderState1.orderId = order.orderId;
            headerlessOrderState1.orderUpdateId = order.orderUpdateId;

            await tap.test("publish order state on AGV", async () => {
                orderState1 = await agvClient.publish(Topic.State, headerlessOrderState1);
            });
        });
    });

    await t.test("subscribe state on Master Control", async () => {
        const subIdState = await mcClient.subscribe(Topic.State, agvId, async (state, subject, topic, id) => {
            tap.test("inbound state on Control", ts => {
                ts.equal(topic, Topic.State);
                ts.strictSame(subject, agvId);
                ts.strictSame(state, orderState1);
                ts.equal(id, subIdState);
                ts.end();
            });

            await tap.test("unsubscribe order on AGV and stop", async () => {
                await agvClient.unsubscribe(subIdOrder);
                await agvClient.stop();
                // Wait some time before stopping control client so that connection
                // state change by AgvClient can be received.
                await new Promise(resolve => setTimeout(resolve, 500));
            });

            await tap.test("unsubscribe state on Master Control and stop", async () => {
                await mcClient.unsubscribe(subIdState);
                await mcClient.stop();
            });

            tap.test("no tracked state available after stopping", ts => {
                ts.equal(mcClient.getTrackedState(agvId), undefined);
                ts.equal(mcClient.getTrackedState({ ...agvId, manufacturer: "FooCompany" }), undefined);
                ts.equal(mcClient.getTrackedState({ ...agvId, serialNumber: "002" }), undefined);
                ts.strictSame(mcClient.getTrackedStates(), []);
                ts.end();
            });

            await tap.test("restart and stop Master Control without track handler", async ts => {
                ts.equal((mcClient as any)._trackHandler, undefined);
                await mcClient.start();
                ts.equal((mcClient as any)._trackHandler, undefined);
                await mcClient.stop();
                ts.equal((mcClient as any)._trackHandler, undefined);
            });

            tap.endAll();
        });
    });

    await t.test("publish order on Master Control", async () => {
        order1 = await mcClient.publish(Topic.Order, agvId, headerlessOrder1);
    });
});
