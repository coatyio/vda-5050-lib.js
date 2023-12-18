/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import {
    AgvClient,
    AgvController,
    AgvId,
    AgvPosition,
    BlockingType,
    ClientOptions,
    ExtensionObject,
    ExtensionValidator,
    Header,
    Headerless,
    MasterControlClient,
    MasterController,
    Order,
    State,
    Topic,
    Velocity,
    VirtualAgvAdapter,
    VirtualAgvAdapterOptions,
} from "../../src";

// tslint:disable: max-line-length

/* Control Logic Abstraction Layer – Master Controller */

(async () => {

    // Create instance of Master Controller with minimal client options: communication namespace and broker endpoint address.
    const masterController = new MasterController({ interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" } }, {});

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

})();

/* Control Logic Abstraction Layer – AGV Controller */

(async () => {

    // Use minimal client options: communication namespace and broker endpoint address.
    const agvClientOptions: ClientOptions = { interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" } };

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

})();

/* Pub-Sub abstraction layer - Master Control Client */

(async () => {

    // Create instance of Master Control Client with minimal options: communication namespace and broker endpoint address.
    const mcClient = new MasterControlClient({ interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" } });

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
    const stateSubscriptionId = await mcClient.subscribe(Topic.State, agvId001, state => {
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

})();

/* Pub-Sub abstraction layer - AGV Client */

(async () => {
    const currentState = {} as State;
    const currentPosition = {} as AgvPosition;
    const currentVelocity = {} as Velocity;

    // The target AGV.
    const agvId001: AgvId = { manufacturer: "RobotCompany", serialNumber: "001" };

    // Create instance of AGV Client "001" with minimal options: communication namespace and broker endpoint address.
    const agvClient = new AgvClient(agvId001, { interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" } });

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

})();

/* Custom VDA 5050 extension topics and object types */

(async () => {

    // Create instance of Master Controller with minimal client options: communication namespace and broker endpoint address.
    const masterController = new MasterController({ interfaceName: "logctx42", transport: { brokerUrl: "mqtt://mybroker.com:1883" } }, {});

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

})();
