/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import { Connection, Factsheet, Header, InstantActions, Order, State, Visualization } from "./vda-5050-types";

/**
 * Get all optional keys in T (non-array types only).
 * 
 * @category Common
 */
export type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];

/**
 * From T, pick all optional properties.
 * 
 * @category Common
 */
export type Optional<T> = Pick<T, OptionalKeys<T>>;

/**
 * Type for any custom VDA 5050 extension object.
 *
 * An extension object *must* include all VDA 5050 protocol header properties
 * and *may* include additional properties of any valid JSON data type, i.e.
 * null, number, boolean, string, array, object.
 *
 * @remarks To define a typesafe extension object type in your application, use
 * an interface that extends the `Header` interface.
 * 
 * @category Common
 */
export type ExtensionObject = Header & { [key: string]: any; };

/**
 * Function type for validating custom VDA 5050 extension objects.
 * 
 * @category Common
 */
export type ExtensionValidator = (extensionTopic: string, extensionObject: ExtensionObject) => void;

/**
 * Represents a VDA 5050 core or extension object.
 * 
 * @category Common
 */
export type Vda5050Object = Connection | Order | InstantActions | State | Visualization | Factsheet | ExtensionObject;

/**
 * Generic type for VDA 5050 object types *without* protocol header properties.
 *
 * @remarks Specify the `timestamp` header property (ISO8601, UTC) if you want
 * to override the default value which is automatically set to the time the
 * object is being published. All other header properties are automatically
 * filled in on publication.
 * 
 * @category Common
 */
export type Headerless<T extends Vda5050Object> = { [H in keyof Pick<T, "timestamp">]?: T[H]; } & Omit<T, keyof Header>;

/**
 * Defines standard VDA 5050 communication topics for information exchange
 * between coordination plane and vehicle plane of a driverless transport
 * system.
 * 
 * @category Common
 */
export enum Topic {

    /**
     * Communication of driving orders from master control to AGV.
     * 
     * Published by master control. Subscribed by AGV.
     */
    Order = "order",

    /** 
     * Communication of actions that are to be executed immediately on an AGV.
     * 
     * Published by master control. Subscribed by AGV.
     */
    InstantActions = "instantActions",

    /**
     * Communication of the AGV state to master control.
     * 
     * Published by AGV. Subscribed by master control.
     */
    State = "state",

    /**
     * Higher frequency of position topic for visualization purposes only.
     * 
     * Published by AGV. Subscribed by visualization systems.
     */
    Visualization = "visualization",

    /**
     * Indicates when AGV connection is lost.
     *
     * Published by Broker/AGV. Subscribed by master control.
     *
     * @remarks Not to be used by master control for checking the vehicle
     * health. To be used for an MQTT protocol level check of connection only.
     */
    Connection = "connection",

    /**
     * Communication of the AGV factshett to master control on request.
     * 
     * Published by AGV. Subscribed by master control.
     */
    Factsheet = "factsheet",
}

/**
 * Determines whether the given topic string is a standard or custom VDA 5050
 * topic.
 *
 * @param topic a VDA 5050 standard or extension topic
 * @returns true if the given topic is an extension topic; false otherwise
 * 
 * @category Common
 */
export function isExtensionTopic(topic: string) {
    for (const value in Topic) {
        if ((Topic as any)[value] === topic) {
            return false;
        }
    }
    return true;
}

/**
 * Type that maps VDA 5050 communication topic types to VDA 5050 object
 * types. Used to infer typesafe parameters.
 * 
 * @category Common
 */
export interface TopicObjectTypeMappings {
    [Topic.Connection]: Connection;
    [Topic.Order]: Order;
    [Topic.InstantActions]: InstantActions;
    [Topic.State]: State;
    [Topic.Visualization]: Visualization;
    [Topic.Factsheet]: Factsheet;
    [key: string]: ExtensionObject;
}

/**
 * Generic type of a VDA 5050 core or extension object which is inferred from a
 * given VDA 5050 communication topic.
 * 
 * @category Common
 */
export type TopicObject<T extends string> = Pick<TopicObjectTypeMappings, T>[T];

/**
 * Type used to identify an AGV as a target of publications and subscriptions.
 *
 * An AGV identity (AgvId for short) is a unique reference to a specific AGV
 * within the overall system. It consists of properties each of which is
 * required and must contain a non-empty string.
 *
 * @remarks As `AgvId` properties are used as topic levels of an MQTT topic,
 * they must not include the characters `NULL (U+0000)`, `# (U+0023)`, `+
 * (U+002B)`, and `/ (U+002F)`.
 * 
 * @category Common
 */
export interface AgvId {

    /**
     * Manufacturer of the AGV (required, non-empty string).
     */
    manufacturer: string;

    /**
     * Unique AGV Serial Number consisting of the following characters: `A-Z a-z
     * 0-9 _ . : -` (required, non-empty string).
     */
    serialNumber: string;
}

/** 
 * Type for uniquely identifying a specific VDA 5050 topic subscription.
 *
 * Used to unsubscribe the corresponding subscription.
 * 
 * @category Client
 */
export type SubscriptionId = string;

/**
 * Generic type of a subscription handler function.
 * 
 * @category Client
 */
export type SubscriptionHandler<T extends string> = (object: TopicObject<T>, subject: AgvId, topic: T, subscriptionId: SubscriptionId) =>
    void;

/**
 * Function type of callback invoked on connection state changes.
 * 
 * @category Client
 */
export type ConnectionStateChangeCallback = (
    connectionState: "online" | "offline" | "broken",
    previousConnectionState: "online" | "offline" | "broken") => void;

/**
 * All error types used for the property `Error.errorType` within this package.
 *
 * @remarks All of them except `"orderActionError"` and
 * `"instantActionError"`are predefined by the VDA 5050 specification. However,
 * the master controller doesn't use these error types to distinguish between
 * order and instant action errors.
 *
 * @category Common
 */
export enum ErrorType {
    Order = "orderError",
    OrderUpdate = "orderUpdateError",
    OrderNoRoute = "noRouteError",
    OrderValidation = "validationError",
    OrderAction = "orderActionError",
    InstantAction = "instantActionError",
    InstantActionValidation = "validationError",
    InstantActionNoOrderToCancel = "noOrderToCancel",
}

/**
 * Checks if `value` is a plain JavaScript object, that is, an object created by
 * an object literal, the `Object` constructor, or one with a prototype of
 * `null`, i.e. `Object.create(null)`.
 *
 * @param value the value to check.
 * @returns `true` if `value` is a plain object, else `false`
 * 
 * @category Common
 */
export function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
