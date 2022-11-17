# Example - End-to-end Testing of VDA 5050

## Table of Contents

* [Introduction](#introduction)
* [Run tests natively](#run-tests-natively)
* [Run tests against a virtual AGV](#run-tests-against-a-virtual-agv)
* [License](#license)

## Introduction

This project provides an example application for testing the [VDA
5050](https://www.vda.de/dam/VDA5050_EN_V1.1.pdf) specification _"Interface for
the communication between automated guided vehicles (AGV) and a master control"_
version 1.1 against a given VDA 5050 implementation on the vehicle plane.

The example application uses the [universal VDA-5050 JavaScript/TypeScript
library](https://github.com/coatyio/vda-5050-lib.js) to implement the master
control side of the test infrastructure.

The example application runs in Docker or natively on any Linux, Windows, or
macOS platform. Tests are configured by a configuration file as specified next.

## Configuration file format

Tests are configured by a JSON configuration file which specifies VDA 5050
instant actions and orders to be executed in series.

The path to the configuration file is specified in an environment variable named
`VDA_5050_TEST_CONFIG` (see .env file in project root folder). The path can be
absolute or relative with respect to the (Docker) host environment. A relative
path is relative to the current working directory where the (dockerized)
application is started. Within Docker this configuration file is bind mounted
into the running container and used there.

The following examples describes the JSON configuration format supplemented by
explanatory comments:

```js
{
    // Test specific options.
    // If not specified, the given default values are used.
    "testOptions": {
        // Whether to stop processing further topics in case an order or instant
        // action is invalid or rejected with an error by the vehicle plane.
        "breakOnError": false,

        // Pretty print the loaded JSON test configuration on startup.
        "logConfig": false,

        // Print order and instant action related events (default).
        "logEvents": true,

        // Print connection state changes of target AGV (default)
        "logConnectionState": true,

        // Print all state messages emitted by target AGV.
        "logState": false,

        // Print all visualization messages emitted by target AGV.
        "logVisualization": false,

        // Print MQTT subscriptions, publications, and control messages.
        // Useful for debugging MQTT transport layer.
        "logMqtt": false,

        // Whether the test application should run against a real AGV backend or
        // a predefined mocked backend, i.e. a virtual AGV supporting free 
        // autonomous navigation along edges, and a basic set of actions 
        // (see README section "Run tests against a virtual AGV" for details).
        "runVirtualAgv": false
    },

    // VDA 5050 specific communication options as defined by vda-5050-lib.
    // For reference, see API documentation on
    // https://coatyio.github.io/vda-5050-lib.js/api/interfaces/clientoptions.html
    "communicationOptions": {
        // Name of the interface specified in the MQTT topic (see option "topicFormat").
        // May also be an empty string according to VDA 5050. 
        "interfaceName": "simove", 
        "transport": {
            // Connection URL to MQTT broker (schema "protocol://host:port").
            // If run in Docker, always specify a concrete broker IP address
            // or host name, not "localhost".
            "brokerUrl": "mqtt://myhost.siemens.net:1883",

            // Defines the MQTT topic structure as a formatted string with placeholders
            // according to the VDA 5050 protocol specification.
            "topicFormat": "%interfaceName%/%majorVersion%/%manufacturer%/%serialNumber%/%topic%"
        }
    },

    // Identifies the target AGV by manufacturer and serialNumber 
    // (part of VDA 5050 object header and MQTT topic).
    "agv": {
        "manufacturer": "RobotCompany",
        "serialNumber": "001"
    },

    // An array of VDA 5050 Order or Instant Actions topic objects without header
    // properties (i.e. headerId, timestamp, version, manufacturer, serialNumber)
    // to be processed in series.
    "topics": [
        // An instant action to initialize AGV position.
        {
            "instantActions": [
                {
                    "actionType": "initPosition",
                    "actionId": "IA-001",
                    "blockingType": "HARD",
                    "actionParameters": [
                        { "key": "x", "value": 0 },
                        { "key": "y", "value": 0 },
                        { "key": "theta", "value": 0 },
                        { "key": "mapId", "value": "local" },
                        { "key": "lastNodeId", "value": "n1" }
                    ]
                }
            ]
        },

        // A pick-drop order with three base nodes; the first one represents the initial
        // AGV position, the second one the pick location, the third one the drop location.
        // The actions request the AGV to lift EUR/EPAL-pallets on floor-located stations.
        {
            "orderId": "O-001",
            "orderUpdateId": 0,
            "nodes": [
                {
                    "nodeId": "n1", "sequenceId": 0, "released": true,
                    "actions": []
                },
                {
                    "nodeId": "n2", "sequenceId": 2, "released": true,
                    "actions": [{
                        "actionId": "A-n2-001",
                        "actionType": "pick",
                        "blockingType": "HARD",
                        "actionParameters": [
                            { "key": "stationType", "value": "floor" },
                            { "key": "loadType", "value": "EPAL" }
                        ]
                    }]
                },
                {
                    "nodeId": "n3", "sequenceId": 4, "released": true,
                    "actions": [{
                        "actionId": "A-n3-001",
                        "actionType": "drop",
                        "blockingType": "HARD",
                        "actionParameters": [
                            { "key": "stationType", "value": "floor" },
                            { "key": "loadType", "value": "EPAL" }
                        ]
                    }]
                }
            ],
            "edges": [
                { "edgeId": "e12", "sequenceId": 1, "startNodeId": "n1", "endNodeId": "n2",
                  "released": true, "actions": [] },
                { "edgeId": "e23", "sequenceId": 3, "startNodeId": "n2", "endNodeId": "n3",
                  "released": true, "actions": [] }
            ]
        }
    ]
}
```

The master control component processes all specified VDA 5050 order and instant
actions topics _in series_ according to the following policy:

* An order topic is considered complete if the order is either rejected with an
  error or has traversed all base order nodes and edges (i.e. without horizon)
  _and_ completed processing all base node and edge actions (i.e. in action
  state finished or failed).
* An instantActions topic is considered complete if _all_ of its instant actions
  have either completed processing (i.e. in action state finished or failed) or
  have been rejected with an error (invalid or not executable).
* Unless the flag breakOnError has been enabled, processing of topics continues
  if an order or instant action is rejected with an error.

Due to this policy you cannot execute certain test scenarios in a _single_
configuration that require parallel processing of orders and/or instant actions.
For example, an active order that has not yet completed processing all its base
nodes/edges cannot be canceled by adding the instant action "cancelOrder" to the
topics array. However, you can extend/update/cancel an order _with_ horizon
nodes that has completed processing _all_ its base nodes/edges and corresponding
actions.

> **TIP**: To test parallel processing of an order and related instant actions,
> e.g. to pause or cancel an order, you can place these actions in distinct
> configuration files and provide shell scripts to execute them whenever you
> need it in your test scenario.

## Run tests natively

Install the latest long-term-stable (LTS) version of
[Node.js](https://nodejs.org) or at least version 14.20.0.

From within the project root folder, install dependencies (requires an Internet
connection) and build the project:

```sh
$ npm install
$ npm run build
```

> **Note**: If you are within a corporate network and cannot access the Internet
> directly, you may need to specify HTTP/HTTPS proxies so that npm can download
> dependent libraries from the public npm repository. The easiest way is to
> create an `.npmrc` file in your home folder and add two lines like this:

```txt
proxy=http://194.138.0.3:9400/
https-proxy=http://194.138.0.3:9400/
```

Before starting the test application ensure your MQTT broker is up and running.
Alternatively, you can use the MQTT broker that is part of the test application
project. Run it in a separate terminal window from within the project root
folder as follows:

```sh
# Run broker on port 1883.
$ npm run broker

# Run broker on port 1883 in verbose mode, where all MQTT
# connections, publications and subscriptions are logged on the console.
$ npm run broker:verbose
```

Finally, adjust the configuration file and start the test application from
within the project root folder as follows:

```sh
$ npm run start
```

## Run tests against a virtual AGV

You can run the test application against a predefined mocked backend, i.e. a
virtual AGV which supports free autonomous navigation along edges, and a basic
set of actions, including:

* pick/drop [node]
* initPosition [instant, node]
* startPause/stopPause [instant]
* startCharging/stopCharging [instant, node]
* cancelOrder [instant]
* stateRequest [instant]
* orderExecutionTime [custom instant]

To enable the virtual AGV interface, set the test option `"runVirtualAgv":
true` in your configuration file before starting the test application.

Note that the project includes a separate predefined configuration file for a
virtual AGV in the folder `./config/vda-5050-test-virtual.config.json`. To start
the test application with this config file _natively_, you can also use this
shortcut:

```sh
$ npm run start:virtual
```

The virtual AGV exposes the following characteristics and constraints:

* To be executable by the virtual AGV an order must specify `nodePosition` for
  all nodes except for the first one as VDA 5050 requires the vehicle to be
  already positioned on the first node (within a given deviation range). The
  property `nodeId` alone is not usable as a symbolic position.

* On initialization, the virtual AGV is positioned at `{ x: 0, y: 0, theta: 0}`
  relative to a map with mapId `local`. You can override or reset this pose
  using the instant or node action `initPosition`, specifying `x`, `y`, `theta`,
  `mapId`, `lastNodeId`, and `lastNodeSequenceId` (optional, defaults to 0) as
  action parameters.

* The virtual AGV provides a constant safety state where no e-stop is activated
  and where the protective field is never violated. The operating mode of the
  virtual AGV is always automatic, i.e. it is fully controlled by master
  control.

* The virtual AGV can only pick and carry one load at a time. Before picking
  another load the current load must have been dropped.

* A charging action is executed on a charging spot while the vehicle is
  standing, either as an instant action or as a node action. Charging mode is
  either terminated explicitely by action stopCharging or automatically when the
  battery is fully charged.

* The AGV's remaining battery reach is reported in the `State.batteryState`
  property unless the vehicle time distribution mode is active according to the
  option `vehicleTimeDistribution`. When the AGV's battery runs low it reports a
  FATAL error (see option `lowBatteryChargeThreshold`) and stops driving. The
  master control must then initiate further actions, e.g. cancel any active
  order.

* The custom action `orderExecutionTime` expects an action parameter key
  `orders` with an array of VDA 5050 headerless Order objects as parameter
  value. The action finishes immediately reporting the estimated order execution
  times in seconds as values in a comma-separated string format via the
  `resultDescription` of the corresponding action state. The calculated
  estimates include the effective duration of action processing on the order's
  nodes (taking action blocking types and concurrent actions into account) as
  well as the travel time on the order's edges, including both base and horizon
  nodes and edges.

## License

Code and documentation copyright 2022 Siemens AG.

Code is licensed under the [MIT License](https://opensource.org/licenses/MIT).

Documentation is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-sa/4.0/).
