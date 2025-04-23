/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import Debug from "debug";
import { Client as Mqtt, connect, IClientOptions, IClientPublishOptions, IClientSubscribeOptions, QoS } from "mqtt";
import { v4 as uuidv4 } from "uuid";

import {
    AgvId,
    ConnectionStateChangeCallback,
    ExtensionValidator,
    Headerless,
    isExtensionTopic,
    SubscriptionHandler,
    SubscriptionId,
    Topic,
    TopicObject,
    Vda5050Object,
} from "..";
import { assertMqttTopicLength } from "./mqtt-utils";
import { SubscriptionManager } from "./subscription-manager";
import {
    validateConnection as validateConnectionV1,
    validateInstantActions as validateInstantActionsV1,
    validateOrder as validateOrderV1,
    validateState as validateStateV1,
    validateVisualization as validateVisualizationV1,
} from "./vda-5050-validators-1.1";
import {
    validateConnection as validateConnectionV2_0,
    validateFactsheet as validateFactsheetV2_0,
    validateInstantActions as validateInstantActionsV2_0,
    validateOrder as validateOrderV2_0,
    validateState as validateStateV2_0,
    validateVisualization as validateVisualizationV2_0,
} from "./vda-5050-validators-2.0";
import {
    validateConnection as validateConnectionV2_1,
    validateFactsheet as validateFactsheetV2_1,
    validateInstantActions as validateInstantActionsV2_1,
    validateOrder as validateOrderV2_1,
    validateState as validateStateV2_1,
    validateVisualization as validateVisualizationV2_1,
} from "./vda-5050-validators-2.1";
/**
 * Create a new Version 4 UUID to be used as a unique identifier for nodes,
 * edges, actions, etc.
 *
 * @returns a unique Version 4 UUID
 *
 * @category Common
 */
export function createUuid() {
    return uuidv4();
}

/**
 * Defines configuration options of a VDA 5050 client, including MQTT transport
 * options.
 *
 * @category Client
 */
export interface ClientOptions {

    /**
     * Name of the used interface (required).
     *
     * The interface name defines a common namespace for communication among
     * clients of a driverless transport system. Communication messages are only
     * routed between clients specifying a common interface name. The interface
     * name is part of the underlying MQTT topics and used to isolate different
     * transport systems sharing the same MQTT infrastructure.
     *
     * @remarks
     * As this property is used as a topic level of an MQTT topic, it must not
     * include the characters `NULL (U+0000)`, `# (U+0023)`, `+ (U+002B)`, and
     * `/ (U+002F)`.
     *
     * This property may also be an empty string according to VDA 5050
     * specification.
     */
    interfaceName: string;

    /**
     * Determines whether runtime validation checks of VDA 5050 communication
     * topic-objects should be performed for inbound and/or outbound messages
     * (optional).
     *
     * Validation passes if the message payload object structure conforms to the
     * VDA 5050 communication topic. For example, if an `"order"` topic is
     * given, the object's properties must satisfy the structure and constraints
     * of a VDA 5050 Order as defined by its JSON schema.
     *
     * By default, validation checks are enabled for both inbound and outbound
     * messages. Thus, if not specified, value defaults to `{ inbound: true,
     * outbound: true }`.
     *
     * @remarks
     * An object may include additional properties which are not defined in the
     * corresponding JSON schema. These properties are ignored, i.e. not
     * validated.
     *
     * If your MQTT broker supports VDA 5050 conformant topic-payload validation
     * of published messages and the client connections are secured, you may
     * turn off client-side validation completely by setting this property to `{
     * inbound: false, outbound: false }`.
     */
    topicObjectValidation?: { inbound: boolean, outbound: boolean };

    /**
     * MQTT-specific transport options for a VDA 5050 client (required).
     */
    transport: MqttTransportOptions;

    /**
     * Represents the selected VDA5050 version (required).
     */
    vdaVersion: VdaVersion;
}

/**
 * Represents the supported VDA5050 specification versions.
 */
export type VdaVersion = "1.1.0" | "2.0.0" | "2.1.0";

/**
 * Defines MQTT transport options for a VDA 5050 client.
 *
 * @category Client
 */
export interface MqttTransportOptions {

    /**
     * Connection URL to MQTT broker (schema `protocol://host:port`, e.g.
     * `mqtt://localhost:1883`).
     *
     * Supported protocols include `mqtt`, `mqtts`, `tcp`, `tls`, `ws`, `wss`,
     * `wx`, `wxs` (WeChat Mini), `ali`, `alis` (Ali Mini).
     *
     * @remarks You can also specify `mqtt` or `mqtts` if the client runs in a
     * browser to open a (secure) websocket connection.
     */
    brokerUrl: string;

    /**
     * Defines the MQTT topic structure as a formatted string with placeholders
     * according to the VDA 5050 protocol specification (optional).
     *
     * Used to create MQTT topics for publication and subscription based on the
     * following format specifiers:
     *
     * - `%interfaceName%` - Name of the used interface
     * - `%majorVersion%` - Major version number prepended by a `"v"`
     * - `%manufacturer%` - Manufacturer of the AGV (e.g. RobotCompany)
     * - `%serialNumber%` - Unique AGV Serial Number consisting of the following
     *   characters: `A-Z a-z 0-9 _ . : -`
     * - `%topic%` - VDA 5050 subtopic name (see enum `Topic`)
     *
     * @remarks
     * The MQTT topic structure is not strictly defined to support a mandatory
     * topic structure of cloud-based MQTT brokers. While the `%topic%`
     * placeholder *must* be present in any case the other ones *may* be
     * omitted.
     *
     * Note that any of the defined placeholders must always make up a complete
     * MQTT topic level.
     *
     * If this option is not specified, the default format looks like this:
     * `%interfaceName%/%majorVersion%/%manufacturer%/%serialNumber%/%topic%`
     *
     * Example: `uagv/v2/KIT/0001/order`
     */
    topicFormat?: string;

    /**
     * The MQTT protocol version used to connect to the broker (optional).
     *
     * If not specified, value defaults to `"3.1.1"`.
     */
    protocolVersion?: "3.1.1" | "5.0";

    /**
     * Heartbeat interval in seconds for exchanging keep alive messages between
     * MQTT broker and client (optional).
     *
     * Defaults to 15 seconds (as recommended by VDA 5050 specification); set to
     * 0 to disable.
     */
    heartbeat?: number;

    /**
     * Interval in milliseconds between two reconnection attempts (optional).
     *
     * Defaults to 1000 ms. Disable auto reconnect by setting to 0.
     */
    reconnectPeriod?: number;

    /**
     * Time in milliseconds to wait for a connection acknowledgement message
     * from the broker (optional).
     *
     * Defaults to 30000 ms. If no CONNACK is received within the given time,
     * the connection is aborted.
     */
    connectTimeout?: number;

    /**
     * The username required by your MQTT broker (optional).
     */
    username?: string;

    /**
     * The password required by your MQTT broker (optional).
     */
    password?: string;

    /**
     * Connection options for mqtts - MQTT over TLS (optional).
     *
     * Default is `{}`. Options are passed through to
     * [`tls.connect()`](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options).
     *
     * @remarks If you run your MQTT connection over WebSockets, use `wsOptions`
     * instead.
     */
    tlsOptions?: {
        /**
         * Private keys in PEM format (optional).
         */
        key?: string | string[] | Buffer | Buffer[] | Array<{ pem: string | Buffer; passphrase?: string; }>;

        /**
         * Cert chains in PEM format (optional).
         */
        cert?: string | string[] | Buffer | Buffer[];

        /**
         * Optionally override the trusted CA certificates in PEM format (optional).
         */
        ca?: string | string[] | Buffer | Buffer[];

        /**
         * PFX or PKCS12 encoded private key and certificate chain. pfx is an
         * alternative to providing `key` and `cert` individually. PFX is
         * usually encrypted, if it is, `passphrase` will be used to decrypt it.
         */
        pfx?: string | string[] | Buffer | Buffer[] | Array<{ buf: string | Buffer; passphrase?: string; }>;

        /**
         * Shared passphrase used for a single private key and/or a PFX.
         */
        passphrase?: string;

        /**
         * If not false, the server certificate is verified against the list of
         * supplied CAs (optional). Defaults to true.
         *
         * @remarks If you are using a self-signed certificate, additionally
         * pass the `rejectUnauthorized: false` option. Beware that you are
         * exposing yourself to man in the middle attacks, so it is a
         * configuration that should never be used for production environments.
         */
        rejectUnauthorized?: boolean;

        /**
         * Any other option supported by
         * [`tls.connect()`](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options).
         */
        [option: string]: any;
    };

    /**
     * WebSocket specific connection options (optional).
     *
     * Default is `{}`. Only used for WebSocket connections.
     *
     * For possible options have a look at:
     * https://github.com/websockets/ws/blob/master/doc/ws.md.
     */
    wsOptions?: object;

    /**
     * For WebSocket ws/wss protocols only (optional). Can be used to implement
     * signing urls or authentication options which upon reconnect can have
     * become expired.
     *
     * For details, see
     * [here](https://github.com/mqttjs/MQTT.js#refresh-authentication-options--signed-urls-with-transformwsurl-websocket-only).
     */
    transformWsUrl?: (url: string, options: any, client: any) => string;

    /**
     * MQTT client Id. Will be autogenerated if undefined or empty. (optional)
     */
    clientId?: string;
}

/**
 * Defines options for individual publications.
 *
 * @category Client
 */
export interface ClientPublishOptions {

    /**
     * Determines whether a publication should be dropped if the client is
     * currently offline due to a broken connection (optional).
     *
     * By default, any offline publication is queued until the client
     * reconnects.
     *
     * @remarks Use this option to disable offline buffering for *individual*
     * publications. For example, regular high frequency state messages on the
     * VDA 5050 "visualization" topic should be dropped while offline as they
     * would be outdated and create a spam wave if published later.
     */
    dropIfOffline?: boolean;

    /**
     * Determines whether to retain the published MQTT message at the MQTT
     * broker (optional).
     *
     * If not specified, the value defaults to `false`.
     */
    retainMessage?: boolean;
}

/**
 * Provides basic client functionality for publishing, subscribing, and
 * unsubscribing communication messages over an MQTT transport according to the
 * VDA 5050 communication interface definition.
 *
 * This class can be used to implement both the coordination plane (control
 * system like master control) as well as the vehicle plane (AGV) of a
 * driverless transport system (DTS). In addition, it can be used to implement
 * visualization, monitoring, or logging clients that passively observe VDA 5050
 * communication flows within the DTS.
 *
 * @remarks
 * This class also lays the basis for proprietary extensions, i.e. non-standard
 * operations between control system and AGVs.
 *
 * This class abstracts VDA 5050 messaging over MQTT, providing the following
 * features:
 *
 * - Runnable in browsers (over WebSocket) and Node.js (over TCP or WebSocket)
 * - Autogeneration of VDA 5050 object types from JSON schema
 * - Autogeneration of MQTT topic-payload from VDA 5050 objects
 * - Configurable MQTT protocol version (3.1.1, 5.0)
 * - Configurable MQTT topic structure to support cloud-based MQTT brokers
 * - Automatic reconnect (configurable)
 * - Regular heartbeat exchange with MQTT broker
 * - Offline buffering of publications and subscriptions
 * - Validation of inbound and outbound VDA 5050 communication messages
 * - Smart subscription-based dispatching of inbound messages
 * - Modern async-await style programming of asynchronous operations
 * - Support of all standard VDA 5050 communication topics and schemas
 * - Extensible by custom VDA 5050 communication topics and schemas
 *
 * By default, publications are buffered while the client is offline due to a
 * broken connection. They are published as soon as the client goes online again
 * upon automatic reconnection. You can also vote to disable offline buffering
 * for *individual* publications. For example, regular high frequency state
 * messages on the VDA 5050 "visualization" topic should be dropped while
 * offline.
 *
 * By default, all subscriptions issued while the client has been started are
 * remembered in case the client goes offline due to a broken connection. As
 * soon as the client goes online again upon automatic reconnection these
 * subscriptions are resubscribed.
 *
 * Note that the asynchronous publish/subscribe/unsubscribe methods throw
 * *synchronously* on *programming errors*, i.e. non-operational errors like
 * passing invalid arguments or or invoking the function while the client is not
 * started. In contrast, *operational errors* are always signaled by rejecting
 * the returned promise.
 *
 * @category Client
 */
export abstract class Client {

    private static readonly ILLEGAL_TOPIC_LEVEL_CHARS_REGEX = /[\u0000+#/]/;

    private static readonly DEFAULT_MQTT_TOPIC_FORMAT = "%interfaceName%/%majorVersion%/%manufacturer%/%serialNumber%/%topic%";

    /**
     * Gets a unique execution ID to be used for logging purposes.
     */
    public readonly execId: string;

    /**
     * Gets a debugger function associated with this client instance.
     *
     * Used to log informational, debug, and error messages. The first argument
     * is a formatter string with printf-style formatting supporting the
     * following directives: `%O` (object multi-line), `%o` (object
     * single-line), `%s` (string), `%d` (number), `%j` (JSON), `%%` (escape).
     *
     * To turn on debug output for this library, set the `DEBUG` environment
     * variable to `vda-5050:*`. To enable low-level MQTT debugging, use
     * `vda-5050:*,mqttjs*`. Use `*` to debug all debug-enabled modules in your
     * application.
     */
    public readonly debug: Debug.Debugger;

    private _mqtt: Mqtt;
    private _isStarted: boolean;
    private _isStopping: boolean;
    private _connectionState: "online" | "offline" | "broken";
    private _connectionStateChangeCallback: ConnectionStateChangeCallback;
    private readonly _clientOptions: ClientOptions;
    private readonly _headerIds: Map<string, number>;
    private readonly _subscriptionManager: SubscriptionManager;
    private readonly _isWebPlatform: boolean;
    private readonly _extensionTopics: Map<string, [boolean, boolean, ExtensionValidator]>;

    /**
     * Creates an instance of a `Client` subclass.
     *
     * @param options configuration options for the client
     * @throws if options are invalid
     */
    constructor(options: ClientOptions) {
        this._isStarted = false;
        this._isStopping = false;
        this._clientOptions = options;
        this.execId = `${uuidv4().replace(/-/g, "").substr(0, 23)}`;
        this.debug = Debug(`vda-5050:${this.execId.substr(0, 10)}`).extend(this.constructor.name);
        this._validateOptions(options);
        this._headerIds = new Map();
        this._subscriptionManager = new SubscriptionManager(
            options.transport.topicFormat || Client.DEFAULT_MQTT_TOPIC_FORMAT,
            this.clientOptions.interfaceName,
            this.getProtocolVersion());
        this._isWebPlatform = new Function("try {return this===window;}catch(e){return false;}")();
        this._extensionTopics = new Map();
        this._emitConnectionStateChange("offline");
        this.debug("Create instance with clientOptions %o", options);
    }

    /**
     * Gets the client configuration options as a readonly object.
     */
    get clientOptions(): Readonly<ClientOptions> {
        return this._clientOptions;
    }

    /**
     * Gets the semantic version of the VDA 5050 protocol this implementation
     * conforms to.
     *
     * @returns a string in the format
     * `"<major-version-number>.<minor-version-number>.<patch-version-number>"`
     */
    get protocolVersion() {
        return this.getProtocolVersion();
    }

    /**
     * Create a new Version 4 UUID to be used as a unique identifier for nodes,
     * edges, actions, etc.
     *
     * @returns a unique Version 4 UUID
     */
    createUuid() {
        return createUuid();
    }

    /**
     * Starts client interaction by connecting to the configured MQTT broker.
     *
     * If client is already started, this operation is a noop.
     *
     * @remarks Always await this operation before invoking other operations on
     * this client instance.
     *
     * @returns a promise resolved when client is initially connected, and
     * rejected when connection fails
     */
    async start() {
        if (this._isStarted) {
            return;
        }
        this.debug("Starting client");
        await this._connect();
        this._isStarted = true;
        await this.onStarted();
    }

    /**
     * Stops client interaction by disconnecting from the MQTT broker and
     * cleaning up all active subscriptions and registered extension topics.
     *
     * If client is not started, this operation is a noop.
     *
     * @remarks
     * Always await this operation before invoking other operations on this
     * client instance, such as `start`.
     *
     * After the client is stopped any publish, subscribe, and unsubscribe
     * operations will throw an error until the client is restarted.
     *
     * @returns a promise resolved when client is disconnected from the
     * underlying MQTT transport.
     */
    async stop() {
        if (!this._isStarted || this._isStopping) {
            return;
        }
        this.debug("Stopping client");
        this._isStopping = true;
        await this.onStopping();
        this._isStarted = false;
        this._isStopping = false;
        await this._disconnect();
    }

    /**
     * Unsubscribes the subscription issued for the given subscription ID.
     *
     * The subscription's handler function will be cleaned up and no longer
     * invoked. If there are no other active subscriptions on the associated VDA
     * 5050 topic, the corresponding MQTT topic will also be unsubscribed to
     * prevent unnecessary network traffic.
     *
     * If the given subscription ID is already unsubscribed, it is silently
     * ignored.
     *
     * @param subscriptionId the subscription ID related to an issued
     * subscription
     * @returns a promise that resolves on successful unsubscription
     * @throws synchronously if client is not started
     */
    unsubscribe(subscriptionId: SubscriptionId) {
        this.debug("Unsubscribing subscription ID %s", subscriptionId);

        if (!this._isStarted) {
            throw new Error("Client is not started");
        }

        return new Promise<void>((resolve, reject) => {
            const { mqttTopic, requiresUnsubscribe } = this._subscriptionManager.remove(subscriptionId);
            if (!requiresUnsubscribe) {
                this.debug("Unsubscribed id %s, more subscriptions on MQTT topic %s", subscriptionId, mqttTopic);
                resolve();
                return;
            }

            if (!this._mqtt.connected) {
                this.debug("Unsubscribe on MQTT topic %s for id %s while offline", mqttTopic, subscriptionId);
                // Do not mqtt.unsubscribe as resubscriptions are handled on reconnect.
                resolve();
                return;
            }

            this._mqtt.unsubscribe(mqttTopic, err => {
                if (err) {
                    // A synchronous error is dispatched immediately if client is
                    // disconnecting (i.e. after mqtt.end function has been invoked).
                    // Also, an unsubscription error occurs (maybe later on reconnect)
                    // if sending the MQTT packet fails for some reason.
                    this.debug("Unsubscribe on MQTT topic %s for id %s failed: %s", mqttTopic, subscriptionId, err);
                    reject(err);
                } else {
                    // Callback fired on successful unsuback.
                    this.debug("Unsubscribed on MQTT topic %s for id %s", mqttTopic, subscriptionId);
                    resolve();
                }
            });
        });
    }

    /**
     * Register a callback function invoked whenever the client's connection
     * state changes.
     *
     * @remarks
     * Upon registration, the given callback is invoked immediately with the
     * current connection state.
     *
     * You can only register one callback per client; any previously registered
     * callback is discarded.
     *
     * @param callback a callback function
     */
    registerConnectionStateChange(callback: ConnectionStateChangeCallback) {
        this._connectionStateChangeCallback = callback;
        this._emitConnectionStateChange(this._connectionState);
    }

    /**
     * Registers a custom VDA 5050 communication topic with a validator function
     * to check structure and constraints of corresponding extension objects at
     * runtime.
     *
     * The `asInbound` and `asOutbound` parameters indicate whether the
     * registered extension topic should be allowed for inbound communication
     * and/or outbound communication. If inbound communication is not allowed,
     * subscribing to the topic will fail. Likewise, if outbound communication
     * is not allowed, publishing on the topic will fail.
     *
     * The validator function is invoked on inbound and/or outbound messages
     * with a registered extension topic according to the client option
     * `topicObjectValidation`.
     *
     * The validator function should throw a `TypeError` synchronously if the
     * passed extension object structure does not conform to the passed
     * extension topic and the direction of the message (inbound, outbound).
     *
     * @remarks
     * If the given topic is already registered, its registration will be
     * overridden with the new parameters.
     *
     * Use the function `createValidators` in the `create-validators` script
     * provided by this package to generate JS validation functions for your
     * custom JSON schemas. Use these functions in this method override.
     *
     * @param extensionTopic a custom VDA 5050 communication topic
     * @param asInbound whether topic should be allowed on inbound communication
     * @param asOutbound whether topic should be allowed on outbound
     * communication
     * @param validator a function that validates message objects against the
     * given extension topic
     */
    registerExtensionTopic(extensionTopic: string, asInbound: boolean, asOutbound: boolean, validator: ExtensionValidator) {
        this._extensionTopics.set(extensionTopic, [asInbound, asOutbound, validator]);
    }

    /* Protected */

    /**
     * Gets the semantic version of the VDA 5050 protocol this implementation
     * conforms to.
     *
     * To be overridden by subclasses that provide VDA 5050 extensions. The
     * default version returned by the base method is the standard VDA 5050
     * protocol version this `Client` class implements.
     *
     * @returns a string in the format
     * `"<major-version-number>.<minor-version-number>.<patch-version-number>"`
     */
    protected getProtocolVersion() {
        return this._clientOptions.vdaVersion;
    }

    /**
     * Determines whether the client has been started.
     *
     * @returns true if client has been started; false otherwise
     */
    protected get isStarted() {
        return this._isStarted;
    }

    /**
     * Invoked after the client has successfully connected or reconnected.
     *
     * To be overridden by subclasses that need to perform additional
     * synchronous or asynchronous actions after the client goes online.
     *
     * The base method does nothing.
     */
    protected onStarted(): void | Promise<void> {
        // Side effects to be defined by subclasses.
    }

    /**
     * Invoked before the client disconnects actively.
     *
     * To be overridden by subclasses that need to perform additional
     * synchronous or asynchronous actions, such as publishing a message before
     * the client disconnects actively.
     *
     * The base method does nothing.
     */
    protected onStopping(): void | Promise<void> {
        // Side effects to be defined by subclasses.
    }

    /**
     * Gets the VDA 5050 communication topic with an associated object to be
     * registered as a last will message.
     *
     * Returns `undefined` if no last will should be registered (default). To be
     * overridden by subclasses.
     *
     * @returns a last will object with a topic, a headerless object, and a
     * retain indicator, or `undefined`
     */
    protected getLastWillTopic(): { topic: Topic, subject: AgvId, object: Headerless<Vda5050Object>, retainMessage: boolean } {
        return undefined;
    }

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
    protected publishTopic<T extends string>(
        topic: T extends Topic ? T : string,
        subject: AgvId,
        object: Headerless<TopicObject<T>>,
        options?: ClientPublishOptions): Promise<TopicObject<T>> {
        this.debug("Publishing on topic %s for subject %o with object %j", topic, subject, object);

        if (!this._isStarted) {
            throw new Error("Client is not started");
        }

        this._validateTopic(topic, false);
        this.validateAgvId(subject, false);

        const headerfullObject = this._withObjectHeader(topic, subject, object);

        if (this.clientOptions.topicObjectValidation?.outbound !== false) {
            this.validateTopicObject(topic, headerfullObject, this.clientOptions.vdaVersion);
        }

        // Validate MQTT topic UTF-8 byte length here as mqtt client errors and
        // disconnects immediately.
        const mqttTopic = this._subscriptionManager.getMqttTopic(topic, subject);
        assertMqttTopicLength(mqttTopic);

        // Throw synchronously if given object is no valid JSON (e.g. cyclic structures).
        const mqttPayload = JSON.stringify(headerfullObject);

        return new Promise((resolve, reject) => {
            const mqttOptions: IClientPublishOptions = this._withMqttProperties({ retain: options?.retainMessage ?? false });

            if (!this._mqtt.connected) {
                if (options?.dropIfOffline) {
                    this.debug("Drop offline publish on topic %s", mqttTopic);
                    resolve(undefined);
                    return;
                } else {
                    this.debug("Publish on MQTT topic %s while offline with retain %s with object %j",
                        mqttTopic, mqttOptions.retain, headerfullObject);
                    this._mqtt.publish(mqttTopic, mqttPayload, mqttOptions);
                    resolve(headerfullObject);
                    return;
                }
            }

            this._mqtt.publish(
                mqttTopic,
                mqttPayload,
                mqttOptions,
                err => {
                    if (err) {
                        // A synchronous error is dispatched immediately if client is disconnecting
                        // (i.e. after mqtt.end function has been invoked). Also, a publication
                        // error occurs if sending the MQTT packet fails for some reason.
                        this.debug("Publish on MQTT topic %s failed: %s", mqttTopic, err);
                        reject(err);
                    } else {
                        // Callback fired when the QoS handling completes, or at the next tick if QoS 0.
                        this.debug("Published on MQTT topic %s with retain %s with object %j",
                            mqttTopic, mqttOptions.retain, headerfullObject);
                        resolve(headerfullObject);
                    }
                });
        });
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
     * @param subject identity of the AGV(s) which are related to this
     * subscription
     * @param handler a function invoked on any inbound message matching the
     * subscription
     * @returns a promise that resolves a unique subscription ID when
     * subscription is set up successfully
     * @throws synchronously if client is not started, if topic or subject is
     * not valid
     */
    protected subscribeTopic<T extends string>(
        topic: T extends Topic ? T : string,
        subject: Partial<AgvId>,
        handler: SubscriptionHandler<T>): Promise<SubscriptionId> {
        this.debug("Subscribing on topic %s for subject %o", topic, subject);

        if (!this._isStarted) {
            throw new Error("Client is not started");
        }

        this._validateTopic(topic, true);
        this.validateAgvId(subject, true);

        // Validate MQTT topic UTF-8 byte length here as mqtt client errors and
        // disconnects immediately.
        const { id, mqttTopic, requiresSubscribe } = this._subscriptionManager.add(topic, subject, handler);

        return new Promise((resolve, reject) => {
            if (!requiresSubscribe) {
                this.debug("Already subscribed on MQTT topic %s with id %s", mqttTopic, id);
                resolve(id);
                return;
            }

            const mqttOptions: IClientSubscribeOptions = { qos: 0 as QoS, rap: true, rh: 0 };

            if (!this._mqtt.connected) {
                this.debug("Subscribe on MQTT topic %s with id %s while offline", mqttTopic, id);
                // Do not mqtt.subscribe as resubscriptions are handled on reconnect.
                resolve(id);
                return;
            }

            this._mqtt.subscribe(mqttTopic, mqttOptions, err => {
                if (err) {
                    // Subscription errors dispatched immediataly and synchronously: invalid
                    // topic structure regarding use of wildcards, and client is disconnecting
                    // (i.e. after mqtt.end function has been invoked). Also, a subscription
                    // error occurs (maybe later on reconnect) if sending the MQTT packet fails
                    // for some reason.
                    this.debug("Subscribe on MQTT topic %s with id %s failed: %s", mqttTopic, id, err);
                    reject(err);
                } else {
                    // Callback fired on successful suback.
                    this.debug("Subscribed on MQTT topic %s with id %s", mqttTopic, id);
                    resolve(id);
                }
            });
        });
    }

    /**
     * Performs a runtime validation check of a standard VDA 5050 communication
     * topic with respect to the direction of information exchange.
     *
     * The base method does nothing. Validation checks need to be defined by
     * subclasses depending on the role of the client (AGV, master control,
     * visualization/monitoring/logging systems, etc.). Such clients are
     * restricted to publish only on certain topics and to only subscribe to
     * certain topics.
     *
     * @param topic a standard VDA 5050 communication topic
     * @param forSubscription whether to validate the topic for subscription or
     * publication
     * @throws if the topic is not valid in the given context
     */
    protected validateTopicDirection(topic: Topic, forSubscription: boolean) {
        // To be defined by subclasses.
    }

    /**
     * Performs a runtime validation check of the given AGV identity to be used
     * as subject of a subscription or publication.
     *
     * For publications, all `AgvId` properties must be specified and valid. For
     * subscriptions, any property may be omitted, but existing properties must
     * have valid values.
     *
     * @param agvId (partial) identity of AGV
     * @param forSubscription whether to validate as a subscription or
     * publication subject
     * @throws a `TypeError` if validation check fails
     */
    protected validateAgvId(agvId: Partial<AgvId>, forSubscription: boolean) {
        if (agvId.manufacturer === "") {
            throw new TypeError("Empty string passed in AgvId.manufacturer.");
        }
        if (!forSubscription && !agvId.manufacturer) {
            throw new TypeError("AgvId.manufacturer not specified for publication");
        }
        if (agvId.manufacturer && !this._isValidTopicLevel(agvId.manufacturer)) {
            throw new TypeError("AgvId.manufacturer is not a valid MQTT topic level");
        }

        if (agvId.serialNumber === "") {
            throw new TypeError("Empty string passed in AgvId.serialNumber.");
        }
        if (!forSubscription && !agvId.serialNumber) {
            throw new TypeError("AgvId.serialNumber not specified for publication");
        }
        if (agvId.serialNumber &&
            (!this._isValidTopicLevel(agvId.serialNumber) || /[^A-Za-z0-9_.:-]/.test(agvId.serialNumber))) {
            throw new TypeError("AgvId.serialNumber is not a valid MQTT topic level or not restricted to A-Z a-z 0-9 _ . : -");
        }
    }

    /**
     * Performs a runtime validation check of a VDA 5050 core or extension
     * object with respect to a given VDA 5050 topic.
     *
     * @param topic a VDA 5050 communication topic
     * @param object a VDA 5050 core or extension object with header properties
     * @throws a `TypeError` if validation check fails
     */
    protected validateTopicObject(topic: string, object: Vda5050Object, vdaVersion: VdaVersion) {
        if (!object || typeof object !== "object") {
            throw new TypeError(`Invalid VDA 5050 object ${object}`);
        }
        if (object.version !== vdaVersion) {
            throw new TypeError(`Invalid VDA 5050 Version. ${topic} version: ${object.version} is not compatible with client verion: ${vdaVersion}`);
        }
        switch (topic) {
            case Topic.Connection:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!validateConnectionV1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Connection at ${validateConnectionV1.errors[0].keywordLocation}, ${validateConnectionV1.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!validateConnectionV2_0(object)) {
                            throw new TypeError(`Invalid VDA 5050 Connection at ${validateConnectionV2_0.errors[0].keywordLocation}, ${validateConnectionV2_0.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.1.0":
                        if (!validateConnectionV2_1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Connection at ${validateConnectionV2_1.errors[0].keywordLocation}, ${validateConnectionV2_1.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Connection Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case Topic.InstantActions:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!validateInstantActionsV1(object)) {
                            throw new TypeError(`Invalid VDA 5050 InstantActions at ${validateInstantActionsV1.errors[0].keywordLocation}, ${validateInstantActionsV1.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!validateInstantActionsV2_0(object)) {
                            throw new TypeError(`Invalid VDA 5050 InstantActions at ${validateInstantActionsV2_0.errors[0].keywordLocation}, ${validateInstantActionsV2_0.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.1.0":
                        if (!validateInstantActionsV2_1(object)) {
                            throw new TypeError(`Invalid VDA 5050 InstantActions at ${validateInstantActionsV2_1.errors[0].keywordLocation}, ${validateInstantActionsV2_1.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`InstantAction Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case Topic.Order:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!validateOrderV1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Order at ${validateOrderV1.errors[0].keywordLocation}, ${validateOrderV1.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!validateOrderV2_0(object)) {
                            throw new TypeError(`Invalid VDA 5050 Order at ${validateOrderV2_0.errors[0].keywordLocation}, ${validateOrderV2_0.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.1.0":
                        if (!validateOrderV2_1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Order at ${validateOrderV2_1.errors[0].keywordLocation}, ${validateOrderV2_1.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Order Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case Topic.State:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!validateStateV1(object)) {
                            throw new TypeError(`Invalid VDA 5050 State at ${validateStateV1.errors[0].keywordLocation}, ${validateStateV1.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!validateStateV2_0(object)) {
                            throw new TypeError(`Invalid VDA 5050 State at ${validateStateV2_0.errors[0].keywordLocation}, ${validateStateV2_0.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.1.0":
                        if (!validateStateV2_1(object)) {
                            throw new TypeError(`Invalid VDA 5050 State at ${validateStateV2_1.errors[0].keywordLocation}, ${validateStateV2_1.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`State Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case Topic.Visualization:
                switch (vdaVersion) {
                    case "1.1.0":
                        if (!validateVisualizationV1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Visualization at ${validateVisualizationV1.errors[0].keywordLocation}, ${validateVisualizationV1.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.0.0":
                        if (!validateVisualizationV2_0(object)) {
                            throw new TypeError(`Invalid VDA 5050 Visualization at ${validateVisualizationV2_0.errors[0].keywordLocation}, ${validateVisualizationV2_0.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.1.0":
                        if (!validateVisualizationV2_1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Visualization at ${validateVisualizationV2_1.errors[0].keywordLocation}, ${validateVisualizationV2_1.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Visualization Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            case Topic.Factsheet:
                switch (vdaVersion) {
                    case "2.0.0":
                        if (!validateFactsheetV2_0(object)) {
                            throw new TypeError(`Invalid VDA 5050 Factsheet at ${validateFactsheetV2_0.errors[0].keywordLocation}, ${validateFactsheetV2_0.errors[0].instanceLocation}`);
                        }
                        break;
                    case "2.1.0":
                        if (!validateFactsheetV2_1(object)) {
                            throw new TypeError(`Invalid VDA 5050 Factsheet at ${validateFactsheetV2_1.errors[0].keywordLocation}, ${validateFactsheetV2_1.errors[0].instanceLocation}`);
                        }
                        break;
                    default:
                        throw new TypeError(`Factsheet Topic not supported with VDA 5050 Version ${vdaVersion}`);
                }
                break;
            default:
                // Note that registration of extension topic has already been
                // performed by _validateTopic method. For incoming messages, it
                // must have been successfully registered and subscribed.
                const [, , validator] = this._extensionTopics.get(topic);
                validator(topic, object);
                break;
        }
    }

    /**
     * Invoked after client is stopped to reset internal client state.
     *
     * To be extended by subclasses. Ensure to call `super.reset()` in your
     * override.
     */
    protected reset() {
        // Keep state of headerIds, connectionState, and extensionTopics for
        // subsequent restart.
        this._subscriptionManager.clear();
    }

    /* Private */

    private _connect() {
        const transOpts = this.clientOptions.transport;
        const mqttOpts: IClientOptions = {
            keepalive: transOpts.heartbeat ?? 15,

            // Do not reschedule keep-alive messages after sending packets. This can cause a
            // broken connection to never be detected as long as messages with QoS 0 are being
            // published continuously.
            reschedulePings: false,

            clientId: transOpts.clientId || this.execId,
            protocolId: "MQTT",
            protocolVersion: transOpts.protocolVersion === "5.0" ? 5 : 4,
            reconnectPeriod: transOpts.reconnectPeriod ?? 1000,
            connectTimeout: transOpts.connectTimeout ?? 30000,
            clean: true,

            // mqtt.js has a strange behaviour regarding resubscription: after connection is
            // broken and a reconnect attempt is successful, subscribed topics are automatically
            // resubscribed again, but only for subscriptions issued while the client has been
            // offline. Online subscriptions which have been acknowledged by the broker BEFORE
            // the connection dropped are not resubscribed in case the connection breaks later
            // and is restablished afterwards. To ensure that these subscriptions are also
            // resubscribed, we implement resubscription in our library (see "offline" event).
            resubscribe: false,

            queueQoSZero: true,
            username: transOpts.username,
            password: transOpts.password,
            ...transOpts.tlsOptions ?? {},
            wsOptions: transOpts.wsOptions ?? {},
            transformWsUrl: transOpts.transformWsUrl,
            will: this._createLastWill(),
        };

        let connectionUrl = this.clientOptions.transport.brokerUrl;
        if (this._isWebPlatform) {
            // Ensure websocket protocol is used in the browser.
            connectionUrl = connectionUrl.replace(/^mqtt/, "ws");
        }

        return new Promise<void>((resolve, reject) => {
            this.debug("Connecting to %s", connectionUrl);
            const mqtt = this._mqtt = connect(connectionUrl, mqttOpts);
            const onceFailureListener = error => {
                this._mqtt = undefined;
                mqtt.end(true, () => {
                    reject(error);
                });
            };

            mqtt

                // Resolve or reject promise on initial connection attempt.
                .once("error", onceFailureListener)
                // WebSocket protocol emits an ETIMEDOUT error after approx 20sec on mqtt.stream.on("error"),
                // then emits a "close" event. However, no error is emitted on "error" listener directly.
                .once("close", onceFailureListener)
                .once("connect", () => {
                    mqtt.removeListener("error", onceFailureListener);
                    mqtt.removeListener("close", onceFailureListener);
                    resolve();
                })

                // Emitted on successful (re)connection before any queued (publish)
                // pakets are delivered.
                .prependListener("connect", () => {
                    this.debug("Connected to %s", connectionUrl);
                    const resubscribes = this._subscriptionManager.getAll();
                    if (resubscribes.length > 0) {
                        this.debug("Resubscribe %d subscription topics", resubscribes.length);
                        mqtt.subscribe(resubscribes);
                    }
                })

                // Emitted on successful (re)connection after any queued (publish)
                // pakets are delivered.
                .on("connect", () => {
                    this._emitConnectionStateChange("online");
                })

                // Emitted when a reconnect starts. It is called for every reconnect
                // attempt as long as connection is not yet successful.
                .on("reconnect", () => {
                    this.debug("Reconnecting to %s", connectionUrl);
                })

                // Emitted after a disconnection requested by calling client.end(),
                // after any failed reconnection attempt, and after a broken
                // connection is terminated when reconnection is disabled.
                .on("close", () => {
                    this._emitConnectionStateChange("offline");
                    this.debug("Disconnected");
                })

                // Emitted when the client goes offline, i.e. when the connection to the server
                // is closed (for whatever reason) and before the client reconnects.
                .on("offline", () => {
                    this._emitConnectionStateChange("offline");
                    this.debug("Offline - connection broken - reconnection pending");
                })

                // Emitted when the client cannot connect (i.e. connack rc != 0) or when a
                // parsing error occurs.
                .on("error", error => {
                    this._emitConnectionStateChange("offline");
                    this.debug("Error on connect: %s", error);
                })

                // Emitted when the client receives a publish packet.
                .on("message", (topic, payload) => {
                    this._dispatchMessage(topic, payload);
                });
        });
    }

    private _disconnect() {
        if (!this._mqtt) {
            return;
        }
        const mqtt = this._mqtt;
        this._mqtt = undefined;
        return new Promise<void>(resolve => {
            mqtt.end(false, () => {
                this.reset();
                resolve();
            });
        });
    }

    private _emitConnectionStateChange(connectionState: "online" | "offline" | "broken") {
        const previousConnectionState = this._connectionState;
        this._connectionState = connectionState;
        if (this._connectionStateChangeCallback) {
            this._connectionStateChangeCallback(connectionState, previousConnectionState);
        }
    }

    /**
     * Synchronously validate topic-payload of an inbound MQTT message, then
     * invoke all matching subscription handlers in series, one after the other,
     * but in arbitrary order.
     *
     * Note that although the local order of subscription handlers for a single
     * subscription topic could be determined (insertion order of handlers as
     * they were added to subscription manager), an overall order of handlers
     * belonging to different matching subscription topics (e.g. with wildcards)
     * is not defined.
     *
     * Incoming publication messages are processed in the order of their
     * arrival. All matching handlers of an incoming publication message are
     * invoked before the handlers of the next publication message received.
     *
     * Handlers can perform asynchronous operations using callbacks or promises
     * but these are not awaited and not synchronized with invocation of other
     * handlers of the current publication message or publication messages
     * received next.
     *
     * An inbound message is discarded, i.e. not dispatched to handlers, if its
     * validation check fails. Uncaught errors in subscription handlers result
     * in "Uncaught Error" or "Unhandled Promise Rejection" reported by the
     * runtime.
     *
     * @param mqttTopic inbound MQTT publication topic
     * @param mqttPayload inbound MQTT payload as an UTF-8 encoded byte array in
     * JSON format
     */
    private _dispatchMessage(mqttTopic: string, mqttPayload: any) {
        let rethrowError = false;
        try {
            const payloadString = mqttPayload.toString();

            this.debug("Inbound message on MQTT topic %s with payload %s", mqttTopic, payloadString);

            const object = JSON.parse(payloadString) as Vda5050Object;
            const subject: AgvId = { manufacturer: object.manufacturer, serialNumber: object.serialNumber };
            const [idAndHandlers, topic] = this._subscriptionManager.find(mqttTopic, subject);

            if (this.clientOptions.topicObjectValidation?.inbound !== false) {
                this.validateTopicObject(topic, object, this.clientOptions.vdaVersion);
            }

            rethrowError = true;

            for (const [id, handler] of idAndHandlers) {
                handler(object, subject, topic, id);
            }
        } catch (error) {
            if (rethrowError) {
                this.debug("Uncaught error in handler for inbound message on MQTT topic %s: %s", mqttTopic, error.message);
                throw error;
            }
            console.error("Drop inbound message on MQTT topic %s with error: %s", mqttTopic, error.message);
            this.debug("Drop inbound message on MQTT topic %s with error: %s", mqttTopic, error.message);
        }
    }

    private _validateOptions(options: ClientOptions) {
        if (options.interfaceName === undefined) {
            throw new TypeError("ClientOption interfaceName is required");
        }
        if (!this._isValidTopicLevel(options.interfaceName)) {
            throw new TypeError("ClientOption interfaceName is not a valid MQTT topic level");
        }
        if (!options.transport?.brokerUrl) {
            throw new TypeError("MqttTransportOption brokerUrl is missing");
        }
        if (options.vdaVersion === undefined) {
            throw new TypeError(`Vda Version is required`);
        }
        if (!this._isValidVdaVersion(options.vdaVersion)) {
            throw new TypeError(`Vda ${options.vdaVersion} Version not supported`);
        }
    }

    private _isValidVdaVersion(version: string) {
        return version === "1.1.0" || version === "1.1" || version === "2.0" || version === "2.0.0" || version === "2.1" || version === "2.1.0";
    }

    private _validateTopic(topic: string, forSubscription: boolean) {
        if (!topic) {
            throw new TypeError("Topic undefined or empty");
        }
        if (!this._isValidTopicLevel(topic)) {
            throw new TypeError(`Topic ${topic} is not a valid MQTT topic level`);
        }
        if (isExtensionTopic(topic)) {
            if (!this._extensionTopics.has(topic)) {
                throw new TypeError(`Extension topic ${topic} is not registered`);
            }
            const [asInbound, asOutbound] = this._extensionTopics.get(topic);
            if (forSubscription && !asInbound) {
                throw new TypeError(`Extension topic ${topic} is not registered for inbound communication`);
            }
            if (!forSubscription && !asOutbound) {
                throw new TypeError(`Extension topic ${topic} is not registered for outbound communication`);
            }
        } else {
            this.validateTopicDirection(topic as Topic, forSubscription);
        }
    }

    private _isValidTopicLevel(name: string) {
        return !Client.ILLEGAL_TOPIC_LEVEL_CHARS_REGEX.test(name);
    }

    private _createLastWill() {
        const lastWill = this.getLastWillTopic();
        if (lastWill) {
            const mqttTopic = this._subscriptionManager.getMqttTopic(lastWill.topic, lastWill.subject);
            return this._withMqttProperties({
                topic: mqttTopic,
                payload: JSON.stringify(this._withObjectHeader(lastWill.topic, lastWill.subject, lastWill.object)),
                retain: lastWill.retainMessage,
            });
        }
        return undefined;
    }

    private _withMqttProperties(pub: any) {
        pub.qos = 0 as QoS;
        switch (this.clientOptions.transport.protocolVersion) {
            case "5.0":
                pub.properties = {
                    payloadFormatIndicator: true,  // UTF-8 encoded payload data
                    contentType: "application/json",
                };
                break;
            case "3.1.1":
            default:
                break;
        }
        return pub;
    }

    private _withObjectHeader(topic: string, subject: AgvId, object: Headerless<Vda5050Object>): Vda5050Object {
        const obj = Object.assign({}, object) as Vda5050Object;
        if (obj.timestamp === undefined) {
            obj.timestamp = new Date().toISOString();
        }
        obj.headerId = this._nextHeaderId(topic);
        obj.manufacturer = subject.manufacturer;
        obj.serialNumber = subject.serialNumber;
        obj.version = this.getProtocolVersion();
        return obj;
    }

    private _nextHeaderId(topic: string): number {
        const id = this._headerIds.get(topic) ?? 0;
        // headerIds are specified as uint32. Handle uint32 wraparound.
        this._headerIds.set(topic, id < 0xFFFFFFFF ? id + 1 : 0);
        return id;
    }
}
