/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import {
    AgvId,
    AgvIdMap,
    Client,
    ClientPublishOptions,
    Connection,
    ConnectionState,
    Headerless,
    SubscriptionHandler,
    SubscriptionId,
    Topic,
    TopicObject,
} from "..";

/**
 * A client that implements a basic publish-subscribe communication abstraction
 * layer of the coordination plane (master control) of VDA 5050 on top of the
 * MQTT transport protocol.
 *
 * Additional features:
 * - Tracking online/offline connection state of all AGV clients within the
 *   driverless transport system
 * - Target individual AGVs, all AGVs, or a subset of AGVs when subscribing to a
 *   VDA 5050 topic
 *
 * @remarks
 * The counterpart of this component on the vehicle plane is the class
 * `AgvClient`.
 *
 * This client can also be used to realize visualization, monitoring or logging
 * components that passively observe certain VDA 5050 communication flows within
 * the DTS, such as Visualization or State messages.
 *
 * @category Client
 */
export class MasterControlClient extends Client {

    /**
     * Maps AgvId.manufacturer to a map of AgvId.serialNumber to latest received
     * connection object.
     */
    private readonly _connectionStates: AgvIdMap<Connection> = new AgvIdMap();

    private _trackHandler: (subject: AgvId, state: ConnectionState, timestamp: string) => void;

    /**
     * Publishes the given VDA 5050 core or extension object on the given VDA
     * 5050 communication topic related to the given AGV subject.
     *
     * The `AgvId` subject is used to automatically fill in header properties of
     * the object to be published. Each of its properties must specify a
     * non-empty string and must be valid as an MQTT topic level.
     *
     * On successful publication, this async function resolves a promise
     * containing a copy of the given headerless object including all header
     * properties as it has been published. If the publication is dropped
     * according to the `dropIfOffline` publish option, the promise resolves
     * with an `undefined` value.
     *
     * @param topic the VDA 5050 communication topic to publish on
     * @param subject identity of the AGV which is related to this publication
     * @param object a VDA 5050 core or extension object without header
     * properties
     * @param options client publish options (optional)
     * @returns a promise that resolves the published object if publication
     * succeeds or `undefined` if message should be dropped while offline
     * @throws synchronously if client is not started, if topic or subject is
     * not valid, if object validation fails
     */
    publish<T extends string>(
        topic: T extends Topic ? T : string,
        subject: AgvId,
        object: Headerless<TopicObject<T>>,
        options?: ClientPublishOptions) {
        return this.publishTopic(topic, subject, object, options);
    }

    /**
     * Subscribes to the given VDA 5050 communication topic for the given AGV
     * subject and registers a handler function to be invoked when matching
     * inbound publication messages are received by this client.
     *
     * In the given partial `AgvId` subject, any property must either specify a
     * non-empty string which is valid as an MQTT topic level or be `undefined`
     * or excluded, to support wildcard subscriptions by control clients.
     * Otherwise, an error is thrown.
     *
     * @remarks
     * If multiple subscription handlers are registered for a given
     * subscription, they are invoked synchronously in series, one after the
     * other, but in arbitrary order.
     *
     * A subscription handler should never perform long-lasting synchronous
     * operations as it blocks processing of other handlers and incoming
     * messages.
     *
     * A subscription handler may also perform asynchronous operations but these
     * are are not awaited and not synchronized with the invocation of
     * subsequent handlers.
     *
     * A subscription handler is responsible for catching any errors. Uncaught
     * errors result in "Uncaught Error" or "Unhandled Promise Rejection"
     * reported by the runtime.
     *
     * Take care to invoke `Client.unsubscribe` method on any subscription ID
     * that is no longer needed by the application to clean up the
     * subscription's handler function and to reduce network traffic.
     * Unsubscribing in a handler function is also possible; use the
     * corresponding subscription id passed as argument. If you want to keep a
     * subscription for the lifetime of the client, there is no need to
     * explicitely unsubscribe it before stopping the client.
     *
     * @param topic the VDA 5050 communication topic to subscribe to
     * @param subject identity of the AGV(s) which are related to this
     * subscription
     * @param handler a function invoked on any inbound message matching the
     * subscription
     * @returns a promise that resolves a unique subscription ID when
     * subscription is set up successfully
     * @throws synchronously if client is not started, if topic or subject is
     * not valid
     */
    subscribe<T extends string>(
        topic: T extends Topic ? T : string,
        subject: Partial<AgvId>,
        handler: SubscriptionHandler<T>): Promise<SubscriptionId> {
        return this.subscribeTopic(topic, subject, handler);
    }

    /**
     * Tracks the lifecycle of all AGVs in the driverless transport system by
     * emitting connection state changes on the given handler function.
     *
     * @remarks You can invoke this method before or after the client is
     * started. If already known, the latest connection states of AGVs are
     * immediately dispatched synchronously on the given handler.
     *
     * @param handler a function invoked whenever the connection state of any
     * tracked AGV changes. The function is passed the identity of the AGV, its
     * connection state and its timestamp.
     */
    trackAgvs(handler: (subject: AgvId, state: ConnectionState, timestamp: string) => void) {
        if (!this._trackHandler) {
            this._trackHandler = handler;
        } else {
            const previousHandler = this._trackHandler;
            this._trackHandler = (subject: AgvId, state: ConnectionState, timestamp: string) => {
                previousHandler(subject, state, timestamp);
                handler(subject, state, timestamp);
            };
        }

        for (const [agvId, connection] of this._connectionStates) {
            handler(agvId, connection.connectionState, connection.timestamp);
        }
    }

    /**
     * Gets the most recently tracked connection state of a given AGV.
     *
     * @param subject identity of the AGV
     * @returns the latest connection state with the timestamp of the latest
     * state change or `undefined` if the state is not yet known.
     */
    getTrackedState(subject: AgvId): { state: ConnectionState, timestamp: string } {
        const conn = this._connectionStates.get(subject);
        return conn ? { state: conn.connectionState, timestamp: conn.timestamp } : undefined;
    }

    /**
     * Gets the most recently tracked connection states of all tracked AGVs.
     *
     * @returns an array of objects with AGV identifier, the latest connection
     * state and the timestamp of the latest state change.
     */
    getTrackedStates() {
        const states: Array<{ subject: AgvId, state: ConnectionState, timestamp: string }> = [];
        for (const [agvId, conn] of this._connectionStates) {
            states.push({ subject: agvId, state: conn.connectionState, timestamp: conn.timestamp });
        }
        return states;
    }

    protected reset() {
        super.reset();
        this._connectionStates.clear();
        this._trackHandler = undefined;
    }

    /**
     * Whenever client starts, track the connection state of AGVs.
     */
    protected async onStarted() {
        await this.subscribeTopic(Topic.Connection, {}, (connection, agvId) => {
            this._connectionStates.set(agvId, connection);
            if (!this._trackHandler) {
                return;
            }
            this._trackHandler(agvId, connection.connectionState, connection.timestamp);
        });
    }

    /**
     * Validate standard VDA 505 topics at runtime with respect to the direction
     * of information exchange. A control client can only publish on certain
     * topics and only subscribe on certain topics.
     */
    protected validateTopicDirection(topic: Topic, asInbound: boolean) {
        switch (topic) {
            case Topic.Connection:
                if (!asInbound) {
                    throw new TypeError("Outbound connection message not compatible with MasterControlClient");
                }
                break;
            case Topic.InstantActions:
                if (asInbound) {
                    throw new TypeError("Inbound instantActions message not compatible with MasterControlClient");
                }
                break;
            case Topic.Order:
                if (asInbound) {
                    throw new TypeError("Inbound order message not compatible with MasterControlClient");
                }
                break;
            case Topic.State:
                if (!asInbound) {
                    throw new TypeError("Outbound state message not compatible with MasterControlClient");
                }
                break;
            case Topic.Visualization:
                if (!asInbound) {
                    throw new TypeError("Outbound visualization message not compatible with MasterControlClient");
                }
                break;
        }
    }
}
