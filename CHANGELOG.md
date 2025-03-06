# Changelog



# [1.6.0](https://github.com/coatyio/vda-5050-lib.js/compare/v1.5.0...v1.6.0) (2025-03-06)

State updates and error references 

### Features

* add order state callback ([80345b2](https://github.com/coatyio/vda-5050-lib.js/commit/80345b2bcb495bc100bdd494dd3c091c7cd08f0c))
* allow check for misformed error references ([d6d48fe](https://github.com/coatyio/vda-5050-lib.js/commit/d6d48fe673940d44b4c2e5e4fcadda3837130483))



# [1.5.0](https://github.com/coatyio/vda-5050-lib.js/compare/v1.4.2...v1.5.0) (2025-01-27)

Adding VDA5050 V2.1.0 Support

### Features

* add vda5050 v2.1.0 support ([8f3c8cd](https://github.com/coatyio/vda-5050-lib.js/commit/8f3c8cd1ff934020d2cd9b5555ccbd7bcb5fa578))



## [1.4.2](https://github.com/coatyio/vda-5050-lib.js/compare/v1.4.0...v1.4.2) (2024-11-21)

Release (v1.4.2)

### Bug Fixes

* insatntAction property "actions" according to vda5050 v2.0 ([65a2334](https://github.com/coatyio/vda-5050-lib.js/commit/65a2334086913b3d054f1b47e42b2a29d81dc96f))



# [1.4.0](https://github.com/coatyio/vda-5050-lib.js/compare/v1.3.1...v1.4.0) (2023-12-18)

This feature release adds support for VDA 5050 V2.0.

### Features

* add VDA5050 V2.0 support ([d9c5a16](https://github.com/coatyio/vda-5050-lib.js/commit/d9c5a165f9ad8b200bbae9595b4c828c1a959260))



## [1.3.1](https://github.com/coatyio/vda-5050-lib.js/compare/v1.3.0...v1.3.1) (2023-04-06)

This patch release fixes issue #29 concerning AgvController.

### Bug Fixes

* **agv-controller:** ensure updateErrors with mode "remove" keeps all errors except the one to be removed (fixes [#29](https://github.com/coatyio/vda-5050-lib.js/issues/29)) ([f07e9d5](https://github.com/coatyio/vda-5050-lib.js/commit/f07e9d5a746382fa19fdd722a672b7c7ec726c13))



# [1.3.0](https://github.com/coatyio/vda-5050-lib.js/compare/v1.2.2...v1.3.0) (2022-12-07)

This feature release targets the VirtualAgvAdapter only. It supports
initializing State.lastNodeId by the adapter option 'initialPosition'.
In addition, a virtual AGV now supports changing mapId within an order.

### Bug Fixes

* **adapter:** support change of mapId in order nodes by VirtualAgvAdapter ([a9e46e7](https://github.com/coatyio/vda-5050-lib.js/commit/a9e46e76b3b5220c6742cb49019cb47bb5e7cd12))


### Features

* **adapter:** support initializing 'lastNodeId' by option 'initialPosition' of VirtualAgvAdapterOptions ([ef386ab](https://github.com/coatyio/vda-5050-lib.js/commit/ef386abf6a02de3e89f57e7dffeeaa81de6d3034))



## [1.2.2](https://github.com/coatyio/vda-5050-lib.js/compare/v1.2.1...v1.2.2) (2022-10-06)

This patch release improves the charging logic of the Virtual AGV Adapter.

### Bug Fixes

* **adapter:** improve charging logic of VirtualAgvAdapter ([7ccb017](https://github.com/coatyio/vda-5050-lib.js/commit/7ccb0179922a2a62405ac41f77e60e59a6c69b1b))

## [1.2.1](https://github.com/coatyio/vda-5050-lib.js/compare/v1.2.0...v1.2.1) (2022-08-19)

This patch release fixes an issue with erroneous edge traversal
events on canceled orders.

### Bug Fixes

* **master-controller:** suppress dispatching edge traversal events on canceled orders ([7ad6372](https://github.com/coatyio/vda-5050-lib.js/commit/7ad63729e94bf15c19d661038e25f8d77826ac65))


### Performance Improvements

* **agv-controller:** optimize cancelation detection ([a18164d](https://github.com/coatyio/vda-5050-lib.js/commit/a18164d92386f58dcba81bf604d351d0590b6a9c))

# [1.2.0](https://github.com/coatyio/vda-5050-lib.js/compare/v1.1.5...v1.2.0) (2022-05-27)

This feature release supports a new action 'noop' and a new action parameter 'duration'
to control action execution of the Virtual AGV Adapter and fixes a traversal issue of this adapter.

### Bug Fixes

* **virtual-agv-adapter:** fix traversal issue where virtual AGV doesn't stop when goal is reached ([45cc428](https://github.com/coatyio/vda-5050-lib.js/commit/45cc4281c9bf2f6c80c574c489126a9fbd6043a0))


### Features

* **virtual-agv-adapter:** support new action 'noop' and an action parameter 'duration' for noop, pick/drop, start/stopCharging actions ([9a15186](https://github.com/coatyio/vda-5050-lib.js/commit/9a15186306ce38434de0a6807944d6dd32182d39))

## [1.1.5](https://github.com/coatyio/vda-5050-lib.js/compare/v1.1.4...v1.1.5) (2022-02-09)

This patch release fixes an issue regarding proper invocation of
edge-related order events in the master controller.

### Bug Fixes

* **master-controller:** correct invocation of edge-related order events for state events that report node and edge changes in one go ([36ed862](https://github.com/coatyio/vda-5050-lib.js/commit/36ed8623c4c5af4ac7dbec78dc0f255d9549febd))

## [1.1.4](https://github.com/coatyio/vda-5050-lib.js/compare/v1.1.3...v1.1.4) (2022-01-28)

This patch release fixes processing of stitching orders
by master control and vehicle plane.

### Bug Fixes

* **agv-controller:** always add orderUpdateId as error reference of order-related errors ([b219cdb](https://github.com/coatyio/vda-5050-lib.js/commit/b219cdb2ee98e1ff8c6ffa4133e75e2b1a4566da))
* **agv-controller:** for stitching orders ensure actions of first new base node are appended to current base end node ([0b1328a](https://github.com/coatyio/vda-5050-lib.js/commit/0b1328abe4f85f0f9a8a471c4d343f4e6dc58010))
* **master-controller:** fix handling of order-related events for stitching orders ([3b59d1b](https://github.com/coatyio/vda-5050-lib.js/commit/3b59d1b8243e4bd0e746236b2d630095d1d9a891))

## [1.1.3](https://github.com/coatyio/vda-5050-lib.js/compare/v1.1.2...v1.1.3) (2021-12-31)

This patch release fixes a traversal issue where a virtual AGV
directly jumps to next goal when moving parallel to x-axis or y-axis.

### Bug Fixes

* **virtual-agv-adapter:** fix traversal issue where AGV directly jumps to next goal when moving parallel to x-axis or y-axis ([ac4d6e4](https://github.com/coatyio/vda-5050-lib.js/commit/ac4d6e43aed6b9040afab860ecd45db346c1c653))

## [1.1.2](https://github.com/coatyio/vda-5050-lib.js/compare/v1.1.1...v1.1.2) (2021-10-22)

This patch release fixes an issue where a disconnected VDA 5050 client
keeps the Node.js process from terminating.

### Bug Fixes

* **client:** on disconnect do not remove all event handlers to prevent dangling asynchronous I/O operations which keep Node.js event loop from exiting ([3160ddc](https://github.com/coatyio/vda-5050-lib.js/commit/3160ddc02693bb7706fd29da6ec76fa444b5dd1f))
* **master-controller:** fix handling of validation errors for instant actions ([d146f81](https://github.com/coatyio/vda-5050-lib.js/commit/d146f819b03380af73224bba091409c1ced8b20b))

## [1.1.1](https://github.com/coatyio/vda-5050-lib.js/compare/v1.1.0...v1.1.1) (2021-10-01)

This patch release fixes an issue regarding handling of lastNodeId/lastNodeSequenceId 
in initial state changes of new orders. Both Master Controller and AGV Controller are
affected by this issue.

### Bug Fixes

* **agv-controller:** do not reset lastNodeId/lastNodeSequenceId in initial state change published for a new order ([38155b3](https://github.com/coatyio/vda-5050-lib.js/commit/38155b328152f334a13db1a4acc3aeca6d707a75))
* **master-controller:** do not assume that lastNodeId/lastNodeSequenceId are always reset when receiving an initial state change for a new order ([24a23eb](https://github.com/coatyio/vda-5050-lib.js/commit/24a23eb5391af7a1a7bd7736e998dea1ef53402e))

# [1.1.0](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.6...v1.1.0) (2021-09-16)

This release fixes a potential race condition among Master and AGV Controller, and 
features a refactored Virtual AGV Adapter for easier extensibility. 

### Bug Fixes

* **agv-controller:** fix potential race condition where instant actions or orders issued in response to an initial state message are dropped by broker as related subscriptions have not yet been registered ([15c6a0c](https://github.com/coatyio/vda-5050-lib.js/commit/15c6a0c352ce71704f65521244df5de8fd9a4bf5))
* **test:** fix issue that sporadically occurs when tests are run with broker in debug mode ([546336e](https://github.com/coatyio/vda-5050-lib.js/commit/546336efff4fc9e1227cbd57352d400691c42852))


### Features

* **adapter:** redesign VirtualAgvAdapter for easier extensibility by subclassing ([973f12d](https://github.com/coatyio/vda-5050-lib.js/commit/973f12d47150dac53f6196032400950da201bf58))

## [1.0.6](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.5...v1.0.6) (2021-07-21)

This patch release ensures that subscriptions on Orders and Instant Actions are issued by the AGV controller before publishing the initial State event.

### Bug Fixes

* **agv-controller:** ensure to issue subscriptions on Orders and Instant Actions before publishing initial State event ([7cb6a27](https://github.com/coatyio/vda-5050-lib.js/commit/7cb6a27ccd6ce1118ad267d5911c51b05fcb8899))
* **client:** do not reschedule MQTT keep-alive messages after publishing to detect broken connections more quickly ([055eff1](https://github.com/coatyio/vda-5050-lib.js/commit/055eff1f1163f56844e84b34fc57e6aa2cd9cad4))

## [1.0.5](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.4...v1.0.5) (2021-06-08)

This patch release fixes an issue in the virtual AGV adapter.

### Bug Fixes

* **adapter:** fix issue in VirtualAgvAdapter concerning update of vehicle orientation while traversing an edge ([96a1475](https://github.com/coatyio/vda-5050-lib.js/commit/96a14752f8da78c182f08d866f64efc1cf947c2e))

## [1.0.4](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.3...v1.0.4) (2021-05-21)

This patch release fixes an issue concerning client restart.

### Bug Fixes

* **client:** reject consecutive invocations of method `start` as long as broker is not reachable ([b3400e3](https://github.com/coatyio/vda-5050-lib.js/commit/b3400e38611c8118190727e1c95d56e2dd70a428))

## [1.0.3](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.2...v1.0.3) (2021-04-01)

This patch release clarifies that the library is only compatible with Node.js v11 or newer.

### Bug Fixes

* library is only compatible with Node.js v11 or newer ([7562b26](https://github.com/coatyio/vda-5050-lib.js/commit/7562b2649ba3b1e0d91f6b441ea72dc0830be243))

## [1.0.2](https://github.com/coatyio/vda-5050-lib.js/compare/v1.0.1...v1.0.2) (2021-03-03)

This patch release fixes the test coverage badge in README.

## 1.0.1 (2021-03-03)

Initial release.