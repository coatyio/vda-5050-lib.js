/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import {
    AgvId,
    Client,
    ClientOptions,
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
 * layer of the vehicle plane (AGV) of VDA 5050 on top of the MQTT transport
 * protocol.
 *
 * @remarks The counterpart of this component on the coordination plane is the
 * class `MasterControlClient`.
 *
 * @category Client
 */
export class AgvClient extends Client {

    /**
     * Creates an instance of `AgvClient`.
     *
     * @param agvId the identity of the AGV this client represents
     * @param options configuration options for the client
     */
    constructor(public agvId: AgvId, options: ClientOptions) {
        super(options);
        this.validateAgvId(agvId, false);
    }

    /**
     * Publishes the given VDA 5050 core or extension object on the given VDA
     * 5050 communication topic.
     *
     * On successful publication, this async function resolves a promise
     * containing a copy of the given headerless object including all header
     * properties as it has been published. If the publication is dropped
     * according to the `dropIfOffline` publish option, the promise resolves
     * with an `undefined` value.
     *
     * @param topic the VDA 5050 communication topic to publish on
     * @param object a VDA 5050 core or extension object without header
     * properties
     * @param options client publish options (optional)
     * @returns a promise that resolves the published object if publication
     * succeeds or `undefined` if message should be dropped while offline
     * @throws synchronously if client is not started, if topic is not valid, if
     * object validation fails
     */
    publish<T extends string>(
        topic: T extends Topic ? T : string,
        object: Headerless<TopicObject<T>>,
        options?: ClientPublishOptions) {
        return this.publishTopic(topic, this.agvId, object, options);
    }

    /**
     * Subscribes to the given VDA 5050 communication topic and registers a
     * handler function to be invoked when matching inbound publication messages
     * are received by this client.
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
     * are are not awaited and not synchronized with the invocation of other
     * handlers.
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
     * @param handler a function invoked on any inbound message matching the
     * subscription
     * @returns a promise that resolves a unique subscription ID when
     * subscription is set up successfully
     * @throws synchronously if client is not started, if topic or subject is
     * not valid
     */
    subscribe<T extends string>(
        topic: T extends Topic ? T : string,
        handler: SubscriptionHandler<T>): Promise<SubscriptionId> {
        return this.subscribeTopic(topic, this.agvId, handler);
    }

    /**
     * Validate standard VDA 5050 topics at runtime with respect to the
     * direction of information exchange. An AGV client can only publish on
     * certain topics and only subscribe to certain topics.
     */
    protected validateTopicDirection(topic: Topic, asInbound: boolean) {
        switch (topic) {
            case Topic.Connection:
                if (asInbound) {
                    throw new TypeError("Inbound connection message not compatible with AgvClient");
                }
                break;
            case Topic.Factsheet:
                if (asInbound) {
                    throw new TypeError("Inbound factsheet message not compatible with AgvClient");
                }
                break;
            case Topic.InstantActions:
                if (!asInbound) {
                    throw new TypeError("Outbound instantActions message not compatible with AgvClient");
                }
                break;
            case Topic.Order:
                if (!asInbound) {
                    throw new TypeError("Outbound order message not compatible with AgvClient");
                }
                break;
            case Topic.State:
                if (asInbound) {
                    throw new TypeError("Inbound state message not compatible with AgvClient");
                }
                break;
            case Topic.Visualization:
                if (asInbound) {
                    throw new TypeError("Inbound visualization message not compatible with AgvClient");
                }
                break;
        }
    }

    /**
     * Register a last will message at the broker that triggers publication of a
     * connection topic for broken connection state whenever the connection is
     * interrupted unexpectedly.
     */
    protected getLastWillTopic(): { topic: Topic, subject: AgvId, object: Headerless<Connection>, retainMessage: boolean } {
        return {
            topic: Topic.Connection,
            subject: this.agvId,
            object: {
                connectionState: ConnectionState.Connectionbroken,
            },
            retainMessage: true,
        };
    }

    /**
     * Whenever client starts, publish a retained connection topic for online
     * connection state.
     */
    protected async onStarted() {
        await this.publishConnectionState(ConnectionState.Online);
    }

    /**
     * Before client disconnects actively, publish a retained connection topic
     * for offline connection state.
     */
    protected async onStopping() {
        await this.publishConnectionState(ConnectionState.Offline);
    }

    protected publishConnectionState(connectionState: ConnectionState) {
        return this.publish(
            Topic.Connection,
            { connectionState: connectionState },
            { retainMessage: true },
        );
    }
}
