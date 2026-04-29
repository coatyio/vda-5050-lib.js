/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * Provides VDA 5050 v3.0-specific mock objects for testing.
 *
 * V3.0 types differ significantly from v2.1 (e.g., powerSupply vs. batteryState,
 * activeEmergencyStop vs. eStop, referenceStateHeaderId in Visualization, etc.).
 * This module provides headerless v3.0 objects that pass v3.0 JSON schema validation.
 */

import { Topic } from "..";
import * as V30 from "../common/vda-5050-types-3.0";

/**
 * Creates a headerless VDA 5050 v3.0 object with minimum required properties
 * for the given communication topic. These objects pass v3.0 JSON schema validation.
 *
 * @param topic a VDA 5050 communication topic
 */
export function createHeaderlessObjectV3<T extends string>(topic: T) {
    switch (topic) {
        case Topic.Connection:
            return {
                connectionState: V30.ConnectionState.Offline,
            } as any;
        case Topic.InstantActions:
            return {
                actions: [],
            } as any;
        case Topic.Order:
            return {
                orderId: "order0001",
                orderUpdateId: 0,
                nodes: [{
                    actions: [],
                    nodeId: "productionunit_1",
                    sequenceId: 0,
                    released: true,
                }],
                edges: [],
            } as any;
        case Topic.State:
            return {
                actionStates: [],
                driving: false,
                edgeStates: [],
                errors: [],
                instantActionStates: [],
                lastNodeId: "",
                lastNodeSequenceId: 0,
                nodeStates: [],
                operatingMode: V30.OperatingMode.Automatic,
                orderId: "",
                orderUpdateId: 0,
                powerSupply: { stateOfCharge: 80, charging: false },
                safetyState: { activeEmergencyStop: V30.ActiveEmergencyStop.None, fieldViolation: false },
            } as any;
        case Topic.Visualization:
            return {
                referenceStateHeaderId: 0,
            } as any;
        case Topic.Factsheet:
            return {
                loadSpecification: {},
                mobileRobotGeometry: {},
                physicalParameters: {
                    length: 1.0,
                    width: 0.6,
                    maximumHeight: 1.5,
                    minimumHeight: 0.5,
                    maximumSpeed: 2.0,
                    minimumSpeed: 0.1,
                    maximumAcceleration: 1.0,
                    maximumDeceleration: 1.5,
                },
                protocolFeatures: {
                    mobileRobotActions: [],
                    optionalParameters: [],
                },
                protocolLimits: {
                    maximumArrayLengths: {},
                    maximumStringLengths: {},
                    timing: {
                        minimumOrderInterval: 0,
                        minimumStateInterval: 0,
                    },
                },
                typeSpecification: {
                    seriesName: "TestBot",
                    mobileRobotClass: "CARRIER",
                    mobileRobotKinematic: "DIFFERENTIAL",
                    localizationTypes: ["NATURAL"],
                    navigationTypes: ["AUTONOMOUS"],
                    maximumLoadMass: 500,
                },
            } as any;
        case Topic.ZoneSet:
            return {
                zoneSet: {
                    mapId: "local",
                    zoneSetId: "zoneSet001",
                    zones: [
                        {
                            zoneId: "zone001",
                            zoneType: V30.ZoneType.Blocked,
                            vertices: [
                                { x: 0, y: 0 },
                                { x: 10, y: 0 },
                                { x: 10, y: 10 },
                                { x: 0, y: 10 },
                            ],
                        },
                    ],
                },
            } as any;
        case Topic.Responses:
            return {
                responses: [
                    {
                        requestId: "req001",
                        grantType: V30.GrantType.Granted,
                    },
                ],
            } as any;
        default:
            return {
                topic,
            } as any;
    }
}
