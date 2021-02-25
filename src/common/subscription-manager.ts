/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import { v4 as uuidv4 } from "uuid";

import { AgvId, SubscriptionHandler, SubscriptionId } from "..";
import { assertMqttTopicUtf8Count, getUtf8BytesCount } from "./mqtt-utils";

/**
 * Manages subscriptions with associated handlers and MQTT topics, and supports
 * efficient lookup of subscription handlers/topics that match the MQTT topic of
 * an inbound message.
 */
export class SubscriptionManager {

    // Maps a topic to a map of serialNumbers to a map of manufacturers to a map
    // of subscription IDs with associated subscription handlers.
    private readonly _subscriptions: Map<string, Map<string, Map<string, Map<string, SubscriptionHandler<string>>>>>;

    // Maps a subscription ID to the subscription IDs submap within
    // _subscriptions.
    private readonly _subscriptionIds: Map<string, Map<string, SubscriptionHandler<string>>>;

    // Precompiled function for efficient construction of an MQTT topic with a
    // preconfigured topic format.
    private _constructMqttTopic: (manufacturer: string, serialNumber: string, topic: string) => string;

    // Precompiled function for efficient deconstruction of an inbound MQTT
    // topic with a preconfigured topic format.
    private _deconstructMqttTopic: (mqttTopic: string) => [manufacturer: string, serialNumber: string, topic: string];

    // Precompiled function for efficient calculation of the UTF-8 byte length
    // of an MQTT topic with a preconfigured topic format.
    private _getMqttTopicUtf8Length: (manufacturer: string, serialNumber: string, topic: string) => number;

    /**
     * Creates an instance of SubscriptionManager.
     */
    constructor(topicFormat: string, interfaceName: string, protocolVersion: string) {
        this._subscriptions = new Map();
        this._subscriptionIds = new Map();
        this._compileMqttTopic(topicFormat, interfaceName, protocolVersion);
    }

    /**
     * Gets the MQTT topic for the given subject and VDA 5050 communication
     * topic according to the topic format configured in the Client transport
     * options.
     *
     * @param topic a VDA 5050 core or extension communication topic, or
     * undefined for wildcard
     * @param subject (partial) AGV identifier for subscription or publication
     * @returns an MQTT topic
     */
    getMqttTopic(topic: string, subject: Partial<AgvId>) {
        return this._constructMqttTopic(subject.manufacturer ?? "+", subject.serialNumber ?? "+", topic ?? "+");
    }

    /**
     * Gets the UTF-8 byte length of the MQTT topic for the given subject and
     * VDA 5050 communication topic according to the topic format configured in
     * the Client transport options.
     *
     * @param topic a VDA 5050 core or extension communication topic, or
     * undefined for wildcard
     * @param subject (partial) AGV identifier for subscription or publication
     * @returns UTF-8 byte length of the MQTT topic
     */
    getMqttTopicUtf8Length(topic: string, subject: Partial<AgvId>) {
        return this._getMqttTopicUtf8Length(subject.manufacturer ?? "+", subject.serialNumber ?? "+", topic ?? "+");
    }

    /**
     * Removes all managed subscriptions.
     */
    clear() {
        this._subscriptions.clear();
        this._subscriptionIds.clear();
    }

    /**
     * Adds a new subscription handler for the given topic and subject.
     *
     * `undefined` values for topic or subject properties are treated as
     * subscription wildcards.
     *
     * @returns an object with new subscription ID, its related MQTT topic, and
     * a boolean indicating whether the MQTT topic needs to be subscribed.
     * @throws if the related MQTT topic's UTF-8 byte length would exceed its
     * maximum limit of 65535
     */
    add(topic: string, subject: Partial<AgvId>, handler: SubscriptionHandler<string>): {
        id: SubscriptionId, mqttTopic: string, requiresSubscribe: boolean,
    } {
        assertMqttTopicUtf8Count(this.getMqttTopicUtf8Length(topic, subject));

        const id = uuidv4();
        const path = [subject.manufacturer, subject.serialNumber, topic];
        let pathIndex = path.length - 1;
        let map = this._subscriptions as Map<string, any>;

        while (pathIndex !== -1) {
            const key = path[pathIndex];
            let value = map.get(key) as Map<string, any>;
            if (value === undefined) {
                value = new Map();
                map.set(key, value);
            }
            map = value;
            pathIndex--;
        }

        this._subscriptionIds.set(id, map);
        map.set(id, handler);
        if (map.size === 1) {
            const mqttTopic = map["mqttTopic"] = this.getMqttTopic(topic, subject);
            return { id, mqttTopic, requiresSubscribe: true };
        }
        return { id, mqttTopic: map["mqttTopic"], requiresSubscribe: false };
    }

    /**
     * Removes the subscription handler for the given subscription ID.
     *
     * @returns `undefined` if the given ID has already been removed or has not
     * been added; otherwise the MQTT subscription topic and a boolean
     * indicating whether the subscription topic needs to be unsubscribed.
     */
    remove(id: SubscriptionId): { mqttTopic: string, requiresUnsubscribe: boolean } {
        const subIdsMap = this._subscriptionIds.get(id);
        if (subIdsMap === undefined || !subIdsMap.has(id)) {
            return undefined;
        }
        subIdsMap.delete(id);
        return {
            mqttTopic: subIdsMap["mqttTopic"],
            requiresUnsubscribe: subIdsMap.size === 0,
        };
    }

    /**
     * Gets all managed MQTT subscription topics.
     *
     * @returns an array of managed MQTT subscription topics
     */
    getAll() {
        const mqttTopics: string[] = [];
        const walk = (map: Map<string, any>) => {
            const mqttTopic = map["mqttTopic"];
            if (mqttTopic !== undefined) {
                if (map.size > 0) {
                    mqttTopics.push(mqttTopic);
                }
                return;
            }
            map.forEach(subMap => walk(subMap));
        };
        walk(this._subscriptions);
        return mqttTopics;
    }

    /**
     * Finds all subscription handlers of subscriptions that match the given
     * inbound MQTT topic (without wildcards).
     *
     * @remarks If manufacturer and/or serialNumber are not defined as
     * placeholders in the topic format, the given subject (usually computed
     * from inbound VDA 5050 object header information) is used for lookup.
     *
     * @returns a tuple with iterable of matching subscription ID - handler
     * tuples and the VDA 5050 communication topic
     */
    find(mqttTopic: string, subject: AgvId):
        [handlers: Iterable<[SubscriptionId, SubscriptionHandler<string>]>, topic: string] {
        const path = this._deconstructMqttTopic(mqttTopic);
        if (path[0] === undefined) {
            path[0] = subject.manufacturer;
        }
        if (path[1] === undefined) {
            path[1] = subject.serialNumber;
        }
        return [this._findInternal(this._subscriptions, path, path.length - 1), path[2]];
    }

    private * _findInternal(map: Map<string, any>, path: string[], pathIndex: number):
        Iterable<[SubscriptionId, SubscriptionHandler<string>]> {
        if (pathIndex === -1) {
            yield* map.entries();
            return;
        }
        const key = path[pathIndex];
        let value = map.get(key) as Map<string, any>;
        if (value !== undefined) {
            yield* this._findInternal(value, path, pathIndex - 1);
        }
        // Always follow a wildcard subscription.
        value = map.get(undefined);
        if (value !== undefined) {
            yield* this._findInternal(value, path, pathIndex - 1);
        }
    }

    private _compileMqttTopic(topicFormat: string, interfaceName: string, protocolVersion: string) {
        const majorVersion = `v${protocolVersion.substring(0, protocolVersion.indexOf("."))}`;
        const placeholders = ["%interfaceName%", "%majorVersion%", "%manufacturer%", "%serialNumber%", "%topic%"];
        const levels = topicFormat.split("/");
        const indices = placeholders.map(p => levels.indexOf(p));
        for (let i = 0; i < indices.length; i++) {
            if (levels.some((l, li) => l.search(placeholders[i]) !== -1 && li !== indices[i])) {
                throw new Error(`Invalid topic format: ${placeholders[i]} placeholder not a complete topic level or specified multiple times`);
            }
        }
        if (indices[4] === -1) {
            throw new Error("Invalid topic format: %topic% placeholder is missing");
        }
        this._constructMqttTopic = (manufacturer: string, serialNumber: string, topic: string) => {
            levels[indices[0]] = interfaceName;
            levels[indices[1]] = majorVersion;
            levels[indices[2]] = manufacturer;
            levels[indices[3]] = serialNumber;
            levels[indices[4]] = topic;
            return levels.join("/");
        };
        this._deconstructMqttTopic = (mqttTopic: string) => {
            const mqttLevels = mqttTopic.split("/");
            return [
                mqttLevels[indices[2]],
                mqttLevels[indices[3]],
                mqttLevels[indices[4]],
            ];
        };
        this._getMqttTopicUtf8Length = (manufacturer: string, serialNumber: string, topic: string) => {
            levels[indices[0]] = interfaceName;
            levels[indices[1]] = majorVersion;
            levels[indices[2]] = manufacturer;
            levels[indices[3]] = serialNumber;
            levels[indices[4]] = topic;
            return levels.reduce((prev, cur, index, arr) => prev + getUtf8BytesCount(cur) + (index === arr.length - 1 ? 0 : 1), 0);
        };
    }
}
