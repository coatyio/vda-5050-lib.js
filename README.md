# Universal VDA 5050 TypeScript/JavaScript library

[![TypeScript](https://img.shields.io/badge/Source%20code-TypeScript-007ACC.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![release](https://img.shields.io/badge/release-Conventional%20Commits-yellow.svg)](https://conventionalcommits.org/)
[![npm version](https://badge.fury.io/js/vda-5050-lib.svg)](https://www.npmjs.com/package/vda-5050-lib)
[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fcoatyio.github.io%2Fvda-5050-lib.js%2Fcoverage%2Fcoverage.shieldsio.json)](https://coatyio.github.io/vda-5050-lib.js/coverage/lcov-report/index.html)

## Table of Contents

* [Introduction](#introduction)
* [Overview](#overview)
* [Installation](#installation)
* [Getting started](#getting-started)
  * [Control logic abstraction layer](#control-logic-abstraction-layer)
  * [Pub-Sub communication abstraction layer](#pub-sub-communication-abstraction-layer)
  * [VDA 5050 protocol extensions](#vda-5050-protocol-extensions)
  * [Programming guidelines](#programming-guidelines)
* [Contributing](#contributing)
* [License](#license)

## Introduction

This package provides a universal library for implementing systems based on [VDA
5050](https://github.com/VDA5050/VDA5050) in TypeScript/JavaScript running in
Node.js and modern browsers. The library implements the VDA 5050 specification
[version 1.1](https://github.com/VDA5050/VDA5050/blob/1.1.0/VDA5050_EN.md) and 
[version 2.0](https://github.com/VDA5050/VDA5050/blob/2.0.0/VDA5050_EN_V1.md)
_"Interface for the communication between automated guided vehicles (AGV) and a
master control"_.

This package comes with complete [API
documentation](https://coatyio.github.io/vda-5050-lib.js/api/index.html) and an
[overview slide
deck](https://coatyio.github.io/vda-5050-lib.js/slides/vda-5050-typescript-javascript-library.pdf)
of the library in the context of the VDA 5050 specification.

In addition, this project includes an
[example](https://github.com/coatyio/vda-5050-lib.js/tree/master/example) that
demonstrates best practices and typical usage patterns of the library on the
master control side.

> This library is accompanied by a [command line
> interface](https://www.npmjs.com/package/vda-5050-cli) with tools useful for
> developing VDA 5050 applications. It features an MQTT broker for development
> testing, professionally designed JSON schemas of the VDA 5050 topics, and a
> code generator to create type definitions from these schemas in various
> programming languages.

## Overview

The key objectives of this library are:

* Encapsulate complex control logic & flows of order, action, and state
  management/handling into reusable components.
* Provide abstraction layers for coordination/vehicle plane and communication.
* Adapt to vehicle-specific navigation & control interfaces through uniform
  protocol adapters realized by integrators or AGV manufacturers.
* Use library components on coordination/vehicle plane in combination or
  separately.
* Support custom VDA 5050 actions and extension topics/object models.

This library supports cross platform deployments (Linux, Win, macOS, Android,
iOS) and runtime environments (Edge, Cloud, Docker, Browser). Ease of
programming and reuse is ensured by an object-oriented software design of
configurable, extensible, and pluggable components. The library encourages a
modern and clean programming style of asynchronous operations by means of the
async-await pattern.

## Installation

Install the latest stable version of this library:

```sh
npm install vda-5050-lib
```

This package uses ECMAScript version `ES2019` and module format `commonjs`. It
runs in [Node.js](https://nodejs.org) v11 or newer and in modern browsers.

## Getting started

This library supports two abstraction layers:

* A high-level abstraction of the VDA 5050 control logic & flows on the
  coordination plane (master control) and on the vehicle plane (AGV).
* A Pub-Sub communication abstraction over MQTT messaging.

Both layers can be used in combination or separately as the classes implementing
the control logic abstraction layer extend from classes that implement the
communication abstraction layer.

> **Tip**: UML class diagrams of all library components can be found in this
> [project documentation
> folder](https://coatyio.github.io/vda-5050-lib.js/slides).
>
> **Tip**: The integration test suite accompanying the library provides a
> valuable source of examples demonstrating how to use the library on both
> layers.

### Control logic abstraction layer

This layer is realized by a *Master Controller* on the coordination plane and by
an *AGV Controller* on the vehicle plane. The AGV Controller connects to
vehicle-specific navigation and control systems by so-called *plug-in AGV
adapters* that expose a uniform AGV interface to the AGV Controller and adapt to
vehicle-specific operations.

The following example shows how to set up and operate a Master Controller to
assign orders and to initiate instant actions as well as to handle order/instant
action related events in the application. For details please consult the [API
documentation](https://coatyio.github.io/vda-5050-lib.js/api/index.html).

```ts
// Create instance of Master Controller with minimal client options: communication namespace and broker endpoint address.
const masterController = new MasterController({ interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" }, vdaVersion: "2.0.0" });

// The target AGV.
const agvId001: AgvId = { manufacturer: "RobotCompany", serialNumber: "001" };

// Define a pick & drop order with two base nodes and one base edge.
const order: Headerless<Order> = {
    orderId: masterController.createUuid(),
    orderUpdateId: 0,
    nodes: [
        {
            nodeId: "productionunit_1", sequenceId: 0, released: true, nodePosition: { x: 0, y: 0, mapId: "local" },
            actions: [{ actionId: "a001", actionType: "pick", blockingType: BlockingType.Hard, actionParameters: [{ key: "stationType", value: "floor" }, { key: "loadType", value: "EPAL" }] }],
        },
        {
            nodeId: "productionunit_2", sequenceId: 2, released: true, nodePosition: { x: 100, y: 200, mapId: "local" },
            actions: [{ actionId: "a002", actionType: "drop", blockingType: BlockingType.Hard, actionParameters: [{ key: "stationType", value: "floor" }, { key: "loadType", value: "EPAL" }] }],
        },
    ],
    edges: [
        { edgeId: "productionunit_1_2", sequenceId: 1, startNodeId: "productionunit_1", endNodeId: "productionunit_2", released: true, actions: [] },
    ],
};

// Start client interaction, connect to MQTT broker.
await masterController.start();

// Assign order to target AGV and handle incoming order change events.
await masterController.assignOrder(agvId001, order, {
    onOrderProcessed: (withError, byCancelation, active, ctx) => console.log("Order processed"),

    // Optional callbacks, use if required.
    onNodeTraversed: (node, nextEdge, nextNode, ctx) => console.log("Order node traversed: %o", node),
    onEdgeTraversing: (edge, startNode, endNode, stateChanges, invocationCount, ctx) => console.log("Order edge traversing: %o %o", edge, stateChanges),
    onEdgeTraversed: (edge, startNode, endNode, ctx) => console.log("Order edge traversed: %o", edge),
    onActionStateChanged: (actionState, withError, action, target, ctx) => console.log("Order action state changed: %o %o %o", actionState, action, target),
});

// Initiate an instant action and handle incoming action change events.
await masterController.initiateInstantActions(agvId001, {
    instantActions: [{
        actionId: masterController.createUuid(),
        actionDescription: "initialize position to x:10 y:10 on map floor2",
        actionType: "initPosition",
        blockingType: BlockingType.Hard,
        actionParameters: [
            { key: "x", value: 10 },
            { key: "y", value: 10 },
            { key: "theta", value: 0 },
            { key: "mapId", value: "floor2" },
            { key: "lastNodeId", value: "n1" },
        ],
    }],
}, {
    onActionStateChanged: (actionState, withError, action, agvId, state) => console.log("Instant action state changed: %o %o %o", actionState, withError, action),
    onActionError: (error, action, agvId, state) => console.log("Instant action error: %o %o %o", error, action, state),
});
```

The following example shows how to set up an AGV Controller with a specific
plug-in AGV adapter. An AGV Controller processes orders and instant actions
according to VDA 5050 control logic & flows, delegates vehicle-specific
operations to the associated adapter, manages state and visualization changes,
and reports them back to master control.

```ts
// Use minimal client options: communication namespace and broker endpoint address.
const agvClientOptions: ClientOptions = { interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" }, vdaVersion: "2.0.0" };

// The target AGV.
const agvId001: AgvId = { manufacturer: "RobotCompany", serialNumber: "001" };

// Specify associated adapter type; use defaults for all other AGV controller options. 
const agvControllerOptions = {
    agvAdapterType: VirtualAgvAdapter,
};

// Use defaults for all adapter options of Virtual AGV adapter.
const agvAdapterOptions: VirtualAgvAdapterOptions = {};

// Create instance of AGV Controller with client, controller, and adapter options.
const agvController = new AgvController(agvId001, agvClientOptions, agvControllerOptions, agvAdapterOptions);

// Start client interaction, connect to MQTT broker.
await agvController.start();
```

The *Virtual AGV Adapter* used in the above example is part of the library. It
supports free autonomous navigation along edges, and a basic, yet extensible set
of actions. It is meant to be used as a template for realizing your own adapter,
for simulation purposes, integration testing, and in other kind of environments
where real AGVs are not available or must be mocked.

In general, any AGV Adapter class must implement a uniform interface that
comprises the following vehicle-specific operations:

* Traverse an edge
* Stop traversing an edge
* Check if a node, edge, or instant action is executable
* Execute and cancel a node, edge, or instant action
* Terminate an edge action
* Report changes in action and vehicle state to AGV Controller
* Check if a route of nodes and edges is traversable
* Check if vehicle is positioned/oriented within a node's deviation range
* Calculate trajectory paths (optional, if supported)

### Pub-Sub communication abstraction layer

This layer abstracts VDA 5050 messaging over the MQTT transport protocol. It is
based on an abstract *Client* class that provides basic methods for publishing
on and subscribing to VDA 5050 topics, featuring

* type-safe use of VDA 5050 objects with type definitions autogenerated from
  JSON schemas,
* schema-based validation of inbound and outbound VDA 5050 messages,
* efficient subscription-based message dispatching, and
* extensibility by custom VDA 5050 topics and object types.

The *Client* class also provides a rich set of configurable options that control
MQTT communication features, including

* MQTT protocol version (3.1.1, 5.0)
* MQTT transport options: TCP, WebSocket, TLS
* MQTT topic structure
* Automatic reconnect to MQTT broker
* Regular heartbeat exchange with MQTT broker
* Offline buffering of publications and subscriptions (if required)

All these options have recommended defaults which are used throughout the
examples in this document.

The following example shows how to set up a *Master Control Client* that
subscribes to state and visualization topics, publishes order topics, and tracks
the connection state of AGVs.

```ts
// Create instance of Master Control Client with minimal options: communication namespace and broker endpoint address.
const mcClient = new MasterControlClient({ interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" }, vdaVersion: "2.0.0" });

// Start client interaction, connect to MQTT broker.
await mcClient.start();

// Observe Visualization objects from all AGVs manufactured by "RobotCompany".
const visSubscriptionId = await mcClient.subscribe(Topic.Visualization, { manufacturer: "RobotCompany" }, vis => console.log("Visualization object received: %o", vis));

// Publish an Order object targeted at a specific AGV.
const agvId001: AgvId = { manufacturer: "RobotCompany", serialNumber: "001" };
const order: Headerless<Order> = {
    orderId: "order0001",
    orderUpdateId: 0,
    nodes: [{ nodeId: "productionunit_1", sequenceId: 0, released: true, actions: [] }, { nodeId: "productionunit_2", sequenceId: 2, released: true, actions: [] }],
    edges: [{ edgeId: "edge1_1", sequenceId: 1, startNodeId: "productionunit_1", endNodeId: "productionunit_2", released: true, actions: [] }],
};
const orderWithHeader = await mcClient.publish(Topic.Order, agvId001, order);
console.log("Published order %o", orderWithHeader);

// Observe State objects emitted by the specific AGV Client.
const stateSubscriptionId = await mcClient.subscribe(Topic.Order, agvId001, state => {
    console.log("State object received: %o", state);
    // Detect order state changes by delta comparison of received State objects.
});

// Track online-offline connection state of all AGVs within the context "logctx42".
mcClient.trackAgvs((agvId, connectionState, timestamp) => console.log("AGV %o changed connection state to %s at %d", agvId, connectionState, timestamp));

// Stop observing Visualization and State objects.
mcClient.unsubscribe(visSubscriptionId);
mcClient.unsubscribe(stateSubscriptionId);

// Stop client interaction gracefully; disconnect from MQTT broker.
await mcClient.stop();
```

The following example shows how to set up an *AGV Control Client* that
subscribes to order topics, and publishes state and visualization topics.

Usually, there should be no need to use this component as the AGV Controller
subclass provides a ready-to-use implementation of the complete control logic on
the vehicle plane.

```ts
const currentState = {} as State;
const currentPosition = {} as AgvPosition;
const currentVelocity = {} as Velocity;

// The target AGV.
const agvId001: AgvId = { manufacturer: "RobotCompany", serialNumber: "001" };

// Create instance of AGV Client "001" with minimal options: communication namespace and broker endpoint address.
const agvClient = new AgvClient(agvId001, { interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" }, vdaVersion: "2.0.0" });

// Start client interaction, connect to MQTT broker.
await agvClient.start();

// Observe Order objects emitted by the Master Control Client.
await agvClient.subscribe(Topic.Order, order => {
    console.log("Order object received: %o", order);

    // Start order handling according to VDA 5050 specification and
    // report order state changes by publishing State objects.
        agvClient.publish(Topic.State, currentState);
});

// Periodically publish Visualization messages with AgvPosition and Velocity.
setInterval(
    () => agvClient.publish(Topic.Visualization,
        { agvPosition: currentPosition, velocity: currentVelocity },
        { dropIfOffline: true }),
    1000);
```

### VDA 5050 protocol extensions

The library supports VDA 5050 protocol extensions on two levels:

* Custom, non-predefined instant, node, and edge actions are handled by
  providing custom AGV adapters that support them.
* Custom extension topics and object types can be registered with Master
  Control and AGV Control clients.

The following example shows how to define and use an extension topic for inbound
and outbound communication on a Master Controller:

```ts
// Create instance of Master Controller with minimal client options: communication namespace and broker endpoint address.
const masterController = new MasterController({ interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" }, vdaVersion: "2.0.0" });

// Define extension object type including header properties.
interface MyExtensionObject extends Header {
    key1: number;
    key2: string;
}

// Define a validator function for the extension topic/object (optional).
const myExtensionValidator: ExtensionValidator = (topic, object) => {
    if (typeof object?.key1 !== "number" || typeof object?.key2 !== "string") {
        throw new TypeError("Extension object is not valid");
    }
};

// Register extension topic with validator for both inbound (subscribe) and outbound (publish) communication.
masterController.registerExtensionTopic("myExtension", true, true, myExtensionValidator);

// Start client interaction, connect to MQTT broker.
await masterController.start();

// Observe myExtension messages from all AGVs manufactured by "RobotCompany".
await masterController.subscribe("myExtension",
    { manufacturer: "RobotCompany" },
    (object: ExtensionObject, subject: AgvId, topic: string) => console.log("Extension topic %s with object %o received from AGV %o", topic, object, subject));

// Publish myExtension object to AGV "001".
await masterController.publish("myExtension",
    { manufacturer: "RobotCompany", serialNumber: "001" },
    { key1: 42, key2: "foo" });
```

### Programming guidelines

For the sake of brevity the examples shown in this document do not include error
handling. You should carefully follow best practices when using the library:

* The asynchronous publish/subscribe/unsubscribe methods throw *synchronously*
  on *programming errors*, i.e. non-operational errors like passing invalid
  arguments or invoking the function while the client is not started. In
  contrast, *operational errors* are always signaled by rejecting the returned
  promise.
* Always catch and handle errors that might be thrown in your own subscription
  and event handler callback code.
* Do not perform long-lasting operations in subscription and event callbacks,
  prefer to execute them asynchronously instead.

To turn on debug output for this library, set the `DEBUG` environment variable
to `vda-5050:*`. To enable low-level MQTT debugging, use `vda-5050:*,mqttjs*`.
Use `*` to debug all debug-enabled modules in your application.

## Contributing

If you like this package, please consider &#x2605; starring [the project on
github](https://github.com/coatyio/vda-5050-lib.js). Contributions are
welcome and appreciated.

The recommended practice described in the [contribution
guidelines](https://github.com/coatyio/coaty-js/blob/master/CONTRIBUTING.md) of
the Coaty JS framework also applies here.

To release a new version of this package, run `npm run release`. This includes
automatic version bumping, generation of a conventional changelog based on git
commit history, git tagging and pushing the release, and publishing the package
on npm registry. For a dry test run, invoke `npm run release:dry`.

## License

Code and documentation copyright 2021 Siemens AG.

Code is licensed under the [MIT License](https://opensource.org/licenses/MIT).

Documentation is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-sa/4.0/).
