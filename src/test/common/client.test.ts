/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// tslint:disable: no-empty

import * as tap from "tap";

import { AgvId, Client, ClientPublishOptions, Connection, ConnectionState, Headerless, SubscriptionId, Topic, TopicObject } from "../..";
import { ExtensionValidator, isPlainObject, SubscriptionHandler, Vda5050Object } from "../../common/client-types";
import { SubscriptionManager } from "../../common/subscription-manager";

import { startBroker, stopBroker } from "../test-broker";
import { consoleRedirect, initTestContext, testClientOptions, UUID_REGEX } from "../test-context";
import { createAgvId, createHeaderlessObject, testObjectResolvesMatch } from "../test-objects";

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

// Increase test timeout on top level for subtest "connection refused on unreachable broker".
tap.setTimeout(60000);

tap.test("Client", async t => {
    const agvId = createAgvId("RobotCompany", "001");
    const clientOptions = testClientOptions(t);
    const client = new TestClient(clientOptions);
    const topicLevelTooLong = "a".repeat(65536);
    const extensionValidator: ExtensionValidator = (topic, object) => {
        if (object.topic !== topic) {
            throw new TypeError(`Extension object not valid`);
        }
    };

    t.test("isPlainObject", ts => {
        ts.equal(isPlainObject(null), false);
        ts.equal(isPlainObject(undefined), false);
        ts.equal(isPlainObject({}), true);
        ts.end();
    });

    t.test("check client options, protocol version, and UUID creation", ts => {
        ts.strictDeepEqual(client.clientOptions, clientOptions, "expect supplied options");
        ts.equal(client.protocolVersion, "1.1.0", "expect correct protocol version");
        ts.match(client.createUuid(), UUID_REGEX);
        ts.end();
    });

    t.test("throws synchronously not started", ts => {
        ts.throws(() => client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order)));
        ts.throws(() => client.subscribe(Topic.Order, agvId, () => { }));
        ts.throws(() => client.unsubscribe("whatever"));
        ts.equal((client as any).isStarted, false);
        ts.end();
    });

    t.test("throws synchronously after stopped", async ts => {
        await client.start();
        ts.equal((client as any).isStarted, true);
        await client.stop();
        ts.throws(() => client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order)));
        ts.throws(() => client.subscribe(Topic.Order, agvId, () => { }));
        ts.throws(() => client.unsubscribe("whatever"));
        ts.equal((client as any).isStarted, false);
    });

    await t.test("connection refused on unreachable broker", async ts => {
        // Some broker connections, such as public broker.hivemq.com, do not emit an error
        // immediately but time out after approx. 20sec with a close event.
        ts.tearDown(() => client1.stop());
        const opts = testClientOptions(ts, { transport: { brokerUrl: testClientOptions(ts).transport.brokerUrl + "0" } });
        const client1 = new TestClient(opts);
        ts.rejects(client1.start());
    });

    await t.test("connect with websocket protocol on browser platform", async ts => {
        ts.tearDown(() => client1.stop());
        const opts = testClientOptions(ts, { transport: { brokerUrl: (testClientOptions(ts).transport as any).wsBrokerUrl } });
        const client1 = new TestClient(opts);
        (client1 as any)._isWebPlatform = true;
        ts.resolves(client1.start());
    });

    await t.test("start-stop in series", async ts => {
        ts.tearDown(() => client.stop());
        await client.stop();
        await client.start();
        await client.start();
        await client.stop();
        await client.stop();
        await client.start();
        await client.stop();
    });

    await t.test("validate client options", async ts => {
        const opts = testClientOptions(t);
        const brokerUrl = opts.transport.brokerUrl;
        const transportOpts = opts.transport;

        opts.transport = undefined;
        ts.throws(() => new TestClient(opts));
        opts.transport = transportOpts;
        opts.transport.brokerUrl = undefined;
        ts.throws(() => new TestClient(opts));
        opts.transport.brokerUrl = "";
        ts.throws(() => new TestClient(opts));

        opts.transport.brokerUrl = brokerUrl;
        opts.interfaceName = undefined;
        ts.throws(() => new TestClient(opts));
        opts.interfaceName = "";
        ts.doesNotThrow(() => new TestClient(opts));
        opts.interfaceName = "\u0000";
        ts.throws(() => new TestClient(opts));
        opts.interfaceName = "+";
        ts.throws(() => new TestClient(opts));
        opts.interfaceName = "#";
        ts.throws(() => new TestClient(opts));
        opts.interfaceName = "/";
        ts.throws(() => new TestClient(opts));
    });

    await t.test("validate subscription topic and subject", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();

        ts.throws(() => client.subscribe(undefined, agvId, () => { }));
        ts.throws(() => client.subscribe("", agvId, () => { }));
        ts.throws(() => client.subscribe(topicLevelTooLong, agvId, () => { }));
        ts.throws(() => client.subscribe("\u0000", agvId, () => { }));
        ts.throws(() => client.subscribe("+", agvId, () => { }));
        ts.throws(() => client.subscribe("#", agvId, () => { }));
        ts.throws(() => client.subscribe("/", agvId, () => { }));

        let agvId1 = createAgvId(undefined, "001");
        ts.resolves(client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("", "001");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId(topicLevelTooLong, "001");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("\u0000", "001");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("+", "001");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("#", "001");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("/", "001");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));

        agvId1 = createAgvId("RobotCompany", undefined);
        ts.resolves(client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", "");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId(topicLevelTooLong, topicLevelTooLong);
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", "\u0000");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", "+");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", "#");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", "/");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", ",");
        ts.throws(() => client.subscribe(Topic.InstantActions, agvId1, () => { }));
        agvId1 = createAgvId("RobotCompany", "A-Za-z0-9_.:-");
        ts.resolves(client.subscribe(Topic.InstantActions, agvId1, () => { }));

        agvId1 = createAgvId(undefined, undefined);
        ts.resolves(client.subscribe(Topic.InstantActions, agvId1, () => { }));

        agvId1 = createAgvId("RobotCompany", "001");
        ts.resolves(client.subscribe(Topic.InstantActions, agvId1, () => { }));
    });

    await t.test("validate publication topic and subject", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();

        ts.throws(() => client.publish(undefined, agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish("", agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish(topicLevelTooLong, agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish("\u0000", agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish("+", agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish("#", agvId, createHeaderlessObject(Topic.InstantActions)));
        ts.throws(() => client.publish("/", agvId, createHeaderlessObject(Topic.InstantActions)));

        let agvId1 = createAgvId(undefined, "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("", "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId(topicLevelTooLong, "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("\u0000", "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("+", "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("#", "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("/", "001");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));

        agvId1 = createAgvId("RobotCompany", undefined);
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", "");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId(topicLevelTooLong, topicLevelTooLong);
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", "\u0000");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", "+");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", "#");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", "/");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", ",");
        ts.throws(() => client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
        agvId1 = createAgvId("RobotCompany", "A-Za-z0-9_.:-");
        ts.resolves(client.publish(Topic.InstantActions, agvId1, createHeaderlessObject(Topic.InstantActions)));
    });

    await t.test("validate publication topic object", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();

        let headerlessObject: Headerless<Vda5050Object> = createHeaderlessObject(Topic.Connection);
        await testObjectResolvesMatch(ts, client, agvId, headerlessObject,
            client.publish(Topic.Connection, agvId, headerlessObject as any));
        ts.throws(() => client.publish(Topic.Connection, agvId, undefined));
        ts.throws(() => client.publish(Topic.Connection, agvId, {} as any));
        ts.throws(() => client.publish(Topic.Connection, agvId, createHeaderlessObject(Topic.InstantActions) as any));

        headerlessObject = createHeaderlessObject(Topic.InstantActions);
        await testObjectResolvesMatch(ts, client, agvId, headerlessObject,
            client.publish(Topic.InstantActions, agvId, headerlessObject as any));
        ts.throws(() => client.publish(Topic.InstantActions, agvId, undefined));
        ts.throws(() => client.publish(Topic.InstantActions, agvId, {} as any));
        ts.throws(() => client.publish(Topic.InstantActions, agvId, createHeaderlessObject(Topic.Connection) as any));

        headerlessObject = createHeaderlessObject(Topic.Order);
        await testObjectResolvesMatch(ts, client, agvId, headerlessObject,
            client.publish(Topic.Order, agvId, headerlessObject as any));
        ts.throws(() => client.publish(Topic.Order, agvId, undefined));
        ts.throws(() => client.publish(Topic.Order, agvId, {} as any));
        ts.throws(() => client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.InstantActions) as any));

        headerlessObject = createHeaderlessObject(Topic.State);
        await testObjectResolvesMatch(ts, client, agvId, headerlessObject,
            client.publish(Topic.State, agvId, headerlessObject as any));
        ts.throws(() => client.publish(Topic.State, agvId, undefined));
        ts.throws(() => client.publish(Topic.State, agvId, {} as any));
        ts.throws(() => client.publish(Topic.State, agvId, createHeaderlessObject(Topic.InstantActions) as any));

        headerlessObject = createHeaderlessObject(Topic.Visualization);
        await testObjectResolvesMatch(ts, client, agvId, headerlessObject,
            client.publish(Topic.Visualization, agvId, headerlessObject as any));
        ts.resolves(client.publish(Topic.Visualization, agvId, undefined));
        ts.resolves(client.publish(Topic.Visualization, agvId, {} as any));
        ts.resolves(client.publish(Topic.Visualization, agvId, {} as any));
        delete headerlessObject["agvPosition"].x;
        ts.throws(() => client.publish(Topic.Visualization, agvId, headerlessObject as any));

        // Note: Topic object validation functions allow additional object properties to
        // be present which are not defined in the corresponding JSON schema.
        ts.resolves(client.publish(Topic.Visualization, agvId, createHeaderlessObject(Topic.InstantActions) as any));

        // Check if Object headerId unint32 property wraps around properly.
        client.registerExtensionTopic("extension1", true, true, () => { });
        (client as any)._headerIds.set("extension1", 0xFFFFFFFF);
        headerlessObject = createHeaderlessObject("extension1");
        await testObjectResolvesMatch(ts, client, agvId, headerlessObject, client.publish("extension1", agvId, headerlessObject as any));
        ts.equal((client as any)._headerIds.get("extension1"), 0);
    });

    await t.test("validate extension topic direction", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();

        client.registerExtensionTopic("extension1", true, true, () => { });
        ts.resolves(client.subscribe("extension1", agvId, () => { }));
        ts.resolves(client.publish("extension1", agvId, createHeaderlessObject("extension1")));

        client.registerExtensionTopic("extension1", false, false, extensionValidator);
        ts.throws(() => client.subscribe("extension1", agvId, () => { }));
        ts.throws(() => client.publish("extension1", agvId, createHeaderlessObject("extension1")));

        client.registerExtensionTopic("extension1", false, true, extensionValidator);
        ts.throws(() => client.subscribe("extension1", agvId, () => { }));
        ts.resolves(client.publish("extension1", agvId, createHeaderlessObject("extension1")));
        ts.throws(() => client.publish("extension1", agvId, createHeaderlessObject("extension2")));

        client.registerExtensionTopic("extension1", true, false, extensionValidator);
        ts.resolves(client.subscribe("extension1", agvId, () => { }));
        ts.throws(() => client.publish("extension1", agvId, createHeaderlessObject("extension1")));
    });

    await t.test("pub-sub validated standard topic object", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        await client.start();
        await client.subscribe(Topic.Order, agvId, (object, subject, topic) => {
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, order);
            resolve();
        });
        const order = await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    await t.test("pub-sub non-validated standard topic object", ts => new Promise(async resolve => {
        const client1 = new TestClient({ ...clientOptions, topicObjectValidation: { inbound: false, outbound: false } });
        ts.tearDown(() => client1.stop());
        await client1.start();
        await client1.subscribe(Topic.Order, agvId, (object, subject, topic) => {
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, action);
            resolve();
        });
        const action = await client1.publish(Topic.Order, agvId, createHeaderlessObject(Topic.InstantActions) as any);
    }));

    await t.test("pub-sub validated extension topic object", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        client.registerExtensionTopic("extension1", true, true, extensionValidator);
        await client.start();
        await client.subscribe("extension1", agvId, (object, subject, topic) => {
            ts.equal(topic, "extension1");
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, extension1Object);
            resolve();
        });
        const extension1Object = await client.publish("extension1", agvId, createHeaderlessObject("extension1"));
    }));

    await t.test("pub-sub non-validated extension topic object", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        client.registerExtensionTopic("extension1", true, true, () => { });
        await client.start();
        await client.subscribe("extension1", agvId, (object, subject, topic) => {
            ts.equal(topic, "extension1");
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, extensionObject2);
            resolve();
        });
        const extensionObject2 = await client.publish("extension1", agvId, createHeaderlessObject("extension2"));
    }));

    await t.test("pub-sub with explicit timestamp in topic object", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        const timestamp = new Date(2000, 2, 10).toISOString();
        await client.start();
        await client.subscribe(Topic.Order, agvId, (object) => {
            ts.equal(order.timestamp, timestamp);
            ts.equal(object.timestamp, timestamp);
            resolve();
        });
        const orderWithTimestamp = Object.assign(createHeaderlessObject(Topic.Order), { timestamp });
        const order = await client.publish(Topic.Order, agvId, orderWithTimestamp);
    }));

    await t.test("pub-sub with non-default client transport options", ts => new Promise(async resolve => {
        const client1 = new TestClient({
            ...clientOptions,
            transport: {
                brokerUrl: clientOptions.transport.brokerUrl,
                protocolVersion: "3.1.1",
                heartbeat: 60,
                reconnectPeriod: 2000,
                connectTimeout: 10000,
                tlsOptions: {},
                wsOptions: {},
            },
        });
        ts.tearDown(() => client1.stop());
        await client1.start();
        await client1.subscribe(Topic.Order, agvId, (object, subject, topic) => {
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, order);
            resolve();
        });
        const order = await client1.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    // This test is not runnable with test:debug:broker, test:hivemq, and test:hivemq:debug
    // scripts as these brokers cannot be stopped and restarted programmatically while testing.
    if (t.context.canStopAndRestartBrokerWhileTesting) {
        await t.test("pub-sub-unsub while offline", ts => new Promise(async (resolve, reject) => {
            ts.tearDown(() => client.stop());
            await client.start();
            const subIdOrder = await client.subscribe(Topic.Order, agvId, () => {
                ts.fail("receive unexpected order message");
                reject();
            });
            await stopBroker();
            await new Promise(res => setTimeout(res, 500));
            await client.unsubscribe(subIdOrder);
            await client.subscribe(Topic.Visualization, agvId, () => {
                ts.fail("receive unexpected visualization message");
                reject();
            });
            await client.subscribe(Topic.Order, agvId, (object, subject, topic) => {
                ts.comment("callback second order subscribe");
                ts.equal(topic, Topic.Order);
                ts.strictDeepEqual(subject, agvId);
                ts.strictDeepEqual(object, order);
                resolve();
            });
            const vis = await client.publish(Topic.Visualization, agvId, createHeaderlessObject(Topic.Visualization),
                { dropIfOffline: true });
            ts.equal(vis, undefined);
            const order = await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
            await startBroker();
        }));
    }

    // For test coverage only. Disconnection error should never happen in a real vda-5050
    // application as pub/sub/unsub mqtt.js operations are either rejected after stopping
    // the client gracefully (with await) or resolved after stopping the client gracefully
    // without await (see test "pub-sub-unsub resolves after client is stopped without await").
    await t.test("pub-sub-unsub fails if client is disconnecting", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();
        const subId1 = await client.subscribe(Topic.Visualization, agvId, () => { });
        (client as any)._mqtt.disconnecting = true;
        ts.rejects(client.unsubscribe(subId1));
        ts.rejects(client.subscribe(Topic.Visualization, agvId, () => { }));
        ts.rejects(client.publish(Topic.Visualization, agvId, createHeaderlessObject(Topic.Visualization)));
        (client as any)._mqtt.disconnecting = false;
    });

    await t.test("pub-sub-unsub resolves after client is stopped without await", async ts => {
        const client1 = new TestClient(testClientOptions(ts));
        ts.tearDown(() => stopPromise);
        await client1.start();
        const subId1 = await client1.subscribe(Topic.Visualization, agvId, () => { });
        const stopPromise = client1.stop();
        ts.resolves(client1.unsubscribe(subId1));
        ts.resolves(client1.subscribe(Topic.Visualization, agvId, () => { }));
        ts.resolves(client1.publish(Topic.Visualization, agvId, createHeaderlessObject(Topic.Visualization)));
    });

    await t.test("publication rejected on cyclic object", async ts => {
        ts.tearDown(() => client.stop());
        await client.start();
        client.registerExtensionTopic("extension1", true, true, () => { });
        const obj = createHeaderlessObject("extension1");
        obj.cyclic = obj;
        ts.throws(() => client.publish("extension1", agvId, obj));
    });

    // This test is not runnable with the vda-5050 broker as it doesn't support
    // MQTT 5.0 yet. Note that Aedes broker is corrupted after trying to connect
    // with MQTT 5 and needs to be restarted afterwards.
    if (t.context.supportsMqtt5) {
        await t.test("pub-sub with MQTT 5.0 protocol version", ts => new Promise(async resolve => {
            const client1 = new TestClient(testClientOptions(ts, { transport: { protocolVersion: "5.0" } }));
            ts.tearDown(() => client1.stop());
            await client1.start();
            await client1.subscribe(Topic.Order, agvId, (object, subject, topic) => {
                ts.equal(topic, Topic.Order);
                ts.strictDeepEqual(subject, agvId);
                ts.strictDeepEqual(object, order);
                resolve();
            });
            const order = await client1.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
        }));
    } else if (t.context.canStopAndRestartBrokerWhileTesting) {
        // For test coverage only as long as vda-5050 broker doesn't support MQTT 5.0.
        // @todo remove code as soon as aedes broker supports MQTT 5.0
        await t.test("pub-sub with MQTT 5.0 protocol version not supported", ts => new Promise(resolve => {
            const client1 = new TestClient(testClientOptions(ts, { transport: { protocolVersion: "5.0" } }));
            ts.tearDown(async () => {
                await client1.stop();
                await stopBroker();
                await startBroker();
            });
            client1.start()
                .then(() => {
                    ts.fail("start should not have succeeded");
                    resolve();
                })
                .catch(() => resolve());
        }));
    }

    await t.test("inbound message dropped on invalid payload", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        await client.start();
        await client.subscribe(Topic.Order, agvId, () => { });
        const mqttTopicOrder = ((client as any)._subscriptionManager as SubscriptionManager).getMqttTopic(Topic.Order, agvId);
        let incomingCount = 0;
        consoleRedirect("error", (output, done) => {
            ts.match(output[0], `Drop inbound message on MQTT topic ${mqttTopicOrder} with error: `);
            if (++incomingCount === 5) {
                done();
                resolve();
            }
        });
        (client as any)._mqtt.publish(mqttTopicOrder, "}{");
        (client as any)._mqtt.publish(mqttTopicOrder, "undefined");
        (client as any)._mqtt.publish(mqttTopicOrder, "null");
        (client as any)._mqtt.publish(mqttTopicOrder, "42");
        (client as any)._mqtt.publish(mqttTopicOrder, "{}");
    }));

    await t.test("subscription handlers invoked in series", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        await client.start();
        let handlerInvocationCount = 0;
        const subIdOrder1 = await client.subscribe(Topic.Order, agvId, (object, subject, topic, subId) => {
            handlerInvocationCount++;
            ts.equal(handlerInvocationCount, 1);
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, order);
            ts.equal(subId, subIdOrder1);
        });
        const subIdOrder2 = await client.subscribe(Topic.Order, agvId, (object, subject, topic, subId) => {
            handlerInvocationCount++;
            ts.equal(handlerInvocationCount, 2);
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, order);
            ts.equal(subId, subIdOrder2);
            resolve();
        });
        const order = await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    await t.test("subscription handler unsubscribed in other handler", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        await client.start();
        let handlerInvocationCount = 0;
        const subIdOrder = await client.subscribe(Topic.Order, agvId, async (object, subject, topic, subId) => {
            handlerInvocationCount++;
            await client.unsubscribe(subId2);
            ts.equal(handlerInvocationCount, 1);
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, order);
            ts.equal(subId, subIdOrder);
            resolve();
        });
        const subId2 = await client.subscribe(Topic.Order, agvId, () => {
            ts.fail("subscription already unsubscribed");
        });
        const order = await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    await t.test("subscription handler unsubscribed in same handler", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        await client.start();
        let handlerInvocationCount = 0;
        const subIdOrder = await client.subscribe(Topic.Order, agvId, async (object, subject, topic, subId) => {
            handlerInvocationCount++;
            if (handlerInvocationCount > 1) {
                ts.fail("subscription already unsubscribed");
                return;
            }
            await client.unsubscribe(subId);
            ts.equal(handlerInvocationCount, 1);
            ts.equal(topic, Topic.Order);
            ts.strictDeepEqual(subject, agvId);
            ts.strictDeepEqual(object, order1);
            ts.equal(subId, subIdOrder);
            resolve();
        });
        const order1 = await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
        await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    await t.test("subscription handler throws synchronously", ts => new Promise(async resolve => {
        ts.tearDown(() => client.stop());
        await client.start();
        await client.subscribe(Topic.Order, agvId, () => {
            setTimeout(resolve, 0);
            throw new Error("Sync handler error");
        });
        ts.expectUncaughtException();
        await client.publish(Topic.Order, agvId, createHeaderlessObject(Topic.Order));
    }));

    await t.test("connection state changed once online and offline", ts => new Promise(async resolve => {
        let numStateInvocations1 = 0;
        client.registerConnectionStateChange((state, prev) => {
            numStateInvocations1++;
            ts.equal(numStateInvocations1, 1);
            ts.equal(state, "offline");
            ts.equal(prev, "offline");
        });

        // Note that second registration overrides first one!
        let numStateInvocations2 = 0;
        client.registerConnectionStateChange((state, prev) => {
            numStateInvocations2++;
            ts.equal(state, numStateInvocations2 === 2 ? "online" : "offline");
            ts.equal(prev, numStateInvocations2 === 3 ? "online" : "offline");
            if (numStateInvocations2 === 3) {
                resolve();
            }
        });
        await client.start();
        await client.stop();
    }));

});
