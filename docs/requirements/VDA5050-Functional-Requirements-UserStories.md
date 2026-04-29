# VDA 5050 — Functional Requirements, User Stories & Test Cases

## 1. Cross-Version Differences Summary

### 1.1 V1.1 → V2.0 Changes

| Area | Change | Impact |
|------|--------|--------|
| **Factsheet topic** | New mandatory topic for AGV self-description | New message type, pub/sub, validation |
| **QoS differentiation** | `connection` topic uses QoS 1; all others QoS 0 | Transport-layer change |
| **Edge.distance → Edge.length** | Field rename | Schema + type breaking change |
| **Edge.orientationType** | New optional enum `OrientationType` | New enum, edge validation |
| **ControlPoint.weight** | Changed from required → optional | Schema relaxation |
| **InstantActions field** | Renamed from `instantActions` → `actions` | Breaking schema change |
| **ActionParameter naming** | `ActionParameter` → `ActionActionParameter` | Type rename |
| **Topic characters** | `$` and `/` forbidden in topic fields | Validation constraint |

### 1.2 V2.0 → V2.1 Changes

| Area | Change | Impact |
|------|--------|--------|
| **Index signatures removed** | Strict typing (no `[property: string]: any`) | Tighter validation |
| **Corridor support** | New `Corridor` type on Edge (`leftWidth`, `rightWidth`, `corridorRefPoint`) | New concept, new types |
| **VehicleConfig + Network** | New factsheet fields for network/version config | Factsheet expansion |
| **Error.errorHint** | New optional field | State expansion |
| **State.maps** | New optional field for map tracking | Map management support |
| **InstantActions backward compat** | Both `actions` and `instantActions` fields accepted | Dual-field support |
| **CorridorRefPoint enum** | New enum: CONTOUR, KINEMATICCENTER | Corridor configuration |
| **ActionParameter naming** | Reverted to `ActionParameter` (from V2.0's `ActionActionParameter`) | Type rename revert |

### 1.3 V2.1 → V3.0 Changes (Major)

| Area | Change | Impact |
|------|--------|--------|
| **Terminology** | AGV → Mobile Robot, Master Control → Fleet Control | All naming across spec |
| **New topics: `zoneSet`, `responses`** | Zone management & request/response mechanism | 2 new message types |
| **Zones concept** | Full zone management with types, sets, interactive zones | Major new feature |
| **Request/Response mechanism** | Mobile robot can request edge/zone grants | New communication pattern |
| **ConnectionState** | `CONNECTIONBROKEN` → `CONNECTION_BROKEN`; new: `HIBERNATING` | Enum value changes |
| **BlockingType split** | Separate `PurpleBlockingType` for instant actions (NONE only) | Type specialization |
| **ActionStatus.RETRIABLE** | New status for retryable failed actions | New enum value |
| **ErrorLevel expansion** | New: `URGENT`, `CRITICAL` (4-level system) | Error classification |
| **OperatingMode expansion** | `TEACHIN` → `TEACH_IN`; new: `INTERVENED`, `STARTUP` | Enum renaming + additions |
| **EStop → ActiveEmergencyStop** | `AUTOACK` removed | Interface + enum rename |
| **Action split** | Separate `InstantActionsAction`, `EdgeAction` types | Type specialization |
| **Edge field renames** | `maxSpeed` → `maximumSpeed`, `maxHeight` → `maximumMobileRobotHeight`, etc. | Breaking field renames |
| **Edge: startNodeId/endNodeId removed** | Node identity inferred from sequence | Structural change |
| **Node: nodeDescription → nodeDescriptor** | Field rename | Breaking change |
| **AllowedDeviationXY** | Number → ellipse object (`a`, `b`, `theta`) | Type structure change |
| **AgvPosition → MobileRobotPosition** | `positionInitialized` → `localized` | Interface rename + field change |
| **BatteryState → PowerSupply** | `batteryCharge` → `stateOfCharge`, `reach` → `range` | Interface rename + field changes |
| **SafetyStatus → SafetyState** | `eStop` → `activeEmergencyStop` | Interface rename + field change |
| **Factsheet fields required** | Many optional fields now required | Stricter factsheet |
| **PhysicalParameters renames** | All `max/min` → `maximum/minimum` prefixes | Naming convention change |
| **ProtocolLimits typed** | Loose `any` → typed `MaximumArrayLengths`/`MaximumStringLengths` | Strict typing |
| **Enums → strings** | `AgvClass`, `AgvKinematic`, `LocalizationType`, etc. → extensible strings | Flexibility increase |
| **Visualization expanded** | `intermediatePath`, `plannedPath`, `referenceStateHeaderId` | New visualization data |
| **Index signatures restored** | V3.0 re-adds `[property: string]: any` | Extensibility restored |
| **Corridor expansion** | `releaseRequired`, `releaseLossBehavior` fields | Corridor enhancement |
| **Trajectory relaxation** | `degree` and `knotVector` optional | Schema relaxation |
| **Error translations** | `errorDescriptionTranslations`, `errorHintTranslations` | i18n support |
| **Header removed as export** | No separate `Header` interface | Structural simplification |
| **ActionScope.ZONE** | New action scope for zone-bound actions | Zone integration |
| **Map interface** | Typed `Map` object replaces `any[]` | Strict map typing |
| **PlannedPath** | New interface for sharing freely navigating robot paths | Path sharing |

---

## 2. Functional Requirements

### FR-01: Multi-Version Protocol Support
The library SHALL support VDA 5050 versions 1.1, 2.0, 2.1, and 3.0 simultaneously, selectable via a configuration option (`vdaVersion`).

**Relevance to lib**: **HIGH** — Core architecture. Already implemented via `VdaVersion` type union and per-version validators/types.

### FR-02: MQTT Transport Layer
The library SHALL communicate via MQTT (minimum version 3.1.1) with configurable broker connections, supporting both local and cloud-based brokers.

**Relevance to lib**: **HIGH** — Core transport. Implemented in `Client` base class.

### FR-03: Topic-Based Pub/Sub Communication
The library SHALL support publish/subscribe on all standard VDA 5050 topics (order, instantActions, state, visualization, connection, factsheet) and additionally zoneSet and responses for V3.0.

**Relevance to lib**: **HIGH** — Implemented via `Topic` enum and `SubscriptionManager`.

### FR-04: MQTT QoS Differentiation
The library SHALL use QoS 0 for topics order, instantActions, state, factsheet, visualization, zoneSet, responses, and QoS 1 for the connection topic (V2.0+).

**Relevance to lib**: **HIGH** — Transport reliability. Implemented in `Client`.

### FR-05: MQTT Topic Structure
The library SHALL construct MQTT topics following the pattern `interfaceName/majorVersion/manufacturer/serialNumber/topic` with configurable components.

**Relevance to lib**: **HIGH** — Implemented in `SubscriptionManager`.

### FR-06: Extension Topics
The library SHALL support custom extension topics beyond the standard VDA 5050 topics, identified via `isExtensionTopic()`.

**Relevance to lib**: **MEDIUM** — Extensibility feature. Implemented.

### FR-07: JSON Schema Validation
The library SHALL validate all inbound and outbound messages against the appropriate JSON schema for the configured VDA version.

**Relevance to lib**: **HIGH** — Data integrity. Implemented with per-version validators.

### FR-08: Protocol Header Management
The library SHALL automatically generate and manage protocol headers (headerId, timestamp, version, manufacturer, serialNumber) for all outbound messages.

**Relevance to lib**: **HIGH** — Implemented in `Client.publishTopic()`.

### FR-09: Connection State Management
The library SHALL manage AGV/mobile robot connection states (ONLINE, OFFLINE, CONNECTIONBROKEN/CONNECTION_BROKEN) using MQTT Last Will and Testament, and support HIBERNATING in V3.0.

**Relevance to lib**: **HIGH** — Implemented in `Client` and `MasterControlClient`.

### FR-10: Order Processing Pipeline
The library SHALL support receiving, validating, and processing orders containing node-edge-graph segments with base and horizon nodes/edges.

**Relevance to lib**: **HIGH** — Core of `AgvController`.

### FR-11: Order Updates
The library SHALL support order updates via matching `orderId` + incrementing `orderUpdateId`, extending the horizon into the base.

**Relevance to lib**: **HIGH** — Implemented in `AgvController` order processing.

### FR-12: Order Cancellation
The library SHALL support order cancellation via the `cancelOrder` instant action, allowing the AGV to stop at the last released node.

**Relevance to lib**: **HIGH** — Implemented in `AgvController`.

### FR-13: Order Rejection
The library SHALL reject malformed orders, orders with unsupported actions/fields, or orders with lower `orderUpdateId` than current, reporting appropriate errors.

**Relevance to lib**: **HIGH** — Validation logic in `AgvController`.

### FR-14: Action Execution
The library SHALL support execution of node actions, edge actions, and instant actions with states: WAITING → INITIALIZING → RUNNING/PAUSED → FINISHED/FAILED.

**Relevance to lib**: **HIGH** — Implemented in `AgvController` + `AgvAdapter`.

### FR-15: Action Blocking Types
The library SHALL respect action blocking types (NONE, SOFT, HARD) to control concurrent action/driving execution. V3.0 adds SINGLE type.

**Relevance to lib**: **HIGH** — Implemented in `AgvController`.

### FR-16: RETRIABLE Action Status (V3.0)
The library SHALL support the RETRIABLE action status for actions that failed but can be retried.

**Relevance to lib**: **MEDIUM** — V3.0 feature. Should be handled in V3.0 type definitions and controller logic.

### FR-17: State Reporting
The library SHALL publish vehicle state at configurable intervals and upon state changes, including position, battery, safety, order progress, action states, errors, and information.

**Relevance to lib**: **HIGH** — Core of `AgvController` state publishing.

### FR-18: Node/Edge Traversal Tracking
The library SHALL track node traversal and edge entry/exit, updating `lastNodeId`, `lastNodeSequenceId`, `nodeStates[]`, and `edgeStates[]` accordingly.

**Relevance to lib**: **HIGH** — Implemented in `AgvController`.

### FR-19: Visualization Topic
The library SHALL support higher-frequency position reporting on the visualization topic, separate from the state topic.

**Relevance to lib**: **MEDIUM** — Implemented. V3.0 adds `intermediatePath`, `plannedPath`, `referenceStateHeaderId`.

### FR-20: Factsheet Support (V2.0+)
The library SHALL support publishing/subscribing to the factsheet topic containing AGV/mobile robot self-description (geometry, loads, physical parameters, protocol features/limits, type specification).

**Relevance to lib**: **HIGH** — Implemented. V2.1 adds vehicleConfig; V3.0 makes many fields required.

### FR-21: Corridor Support (V2.1+)
The library SHALL support corridor definitions on edges with `leftWidth`, `rightWidth`, and reference point configuration.

**Relevance to lib**: **MEDIUM** — Type-level support. V3.0 adds `releaseRequired`, `releaseLossBehavior`.

### FR-22: Zone Management (V3.0)
The library SHALL support the zoneSet topic for transferring zone configurations (speed zones, crossing zones, interaction zones) from fleet control to mobile robots.

**Relevance to lib**: **MEDIUM** — V3.0 only. Types defined; pub/sub via `Topic.ZoneSet`.

### FR-23: Request/Response Mechanism (V3.0)
The library SHALL support the responses topic for fleet control to reply to mobile robot state requests (edge requests, zone requests).

**Relevance to lib**: **MEDIUM** — V3.0 only. Types defined; pub/sub via `Topic.Responses`.

### FR-24: Map Management (V2.1+)
The library SHALL support map state tracking via `State.maps` and map-related actions (`downloadMap`, `enableMap`, `deleteMap`).

**Relevance to lib**: **LOW-MEDIUM** — Type-level support; action semantics in adapter.

### FR-25: Error Reporting
The library SHALL support structured error reporting with levels (WARNING, FATAL; plus URGENT, CRITICAL in V3.0), error types, references, and descriptions.

**Relevance to lib**: **HIGH** — Implemented. V3.0 adds translation support and new levels.

### FR-26: AGV Adapter Abstraction
The library SHALL provide a pluggable adapter interface (`AgvAdapter`) allowing custom vehicle integration with the `AgvController`.

**Relevance to lib**: **HIGH** — Core extensibility. `VirtualAgvAdapter` serves as reference implementation.

### FR-27: Master Controller Order Lifecycle
The library SHALL provide a `MasterController` with event-driven callbacks for order lifecycle management (processed, node traversed, edge traversing/traversed).

**Relevance to lib**: **HIGH** — Implemented in `MasterController`.

### FR-28: Fleet-Wide Subscriptions
The library SHALL support wildcard AGV subscriptions on `MasterControlClient`, allowing fleet-wide state/connection monitoring.

**Relevance to lib**: **HIGH** — Implemented via `AgvId` wildcards.

### FR-29: Backward Compatibility
The library SHALL maintain backward compatibility within the same major version, supporting both `actions` and `instantActions` field names in the instantActions topic (V2.1).

**Relevance to lib**: **MEDIUM** — Implemented as dual-field support.

### FR-30: Planned Path Sharing (V3.0)
The library SHALL support `plannedPath` and `intermediatePath` in state and visualization messages for freely navigating mobile robots.

**Relevance to lib**: **LOW** — Type-level support; visualization enhancement.

### FR-31: Error Translations (V3.0)
The library SHALL support multi-language error descriptions via `errorDescriptionTranslations` and `errorHintTranslations`.

**Relevance to lib**: **LOW** — Type-level support.

### FR-32: Enum Value Changes (V3.0)
The library SHALL handle renamed enum values (e.g., `CONNECTIONBROKEN` → `CONNECTION_BROKEN`, `TEACHIN` → `TEACH_IN`, `AUTOACK` removal) per version.

**Relevance to lib**: **HIGH** — Must be correct per-version; handled by separate type files.

### FR-33: PowerSupply / BatteryState Abstraction
The library SHALL support both `batteryState` (V1.1–V2.1) and `powerSupply` (V3.0) interfaces with field mapping.

**Relevance to lib**: **HIGH** — Type-level support per version file.

### FR-34: Safety State
The library SHALL support both `safetyStatus` (V1.1–V2.1) with `eStop` and `safetyState` (V3.0) with `activeEmergencyStop`.

**Relevance to lib**: **HIGH** — Type-level support per version file.

---

## 3. Relevance Matrix

| Req | Priority | Implemented | Notes |
|-----|----------|-------------|-------|
| FR-01 | Critical | Yes | Core multi-version architecture |
| FR-02 | Critical | Yes | MQTT via `mqtt` npm package |
| FR-03 | Critical | Yes | Topic enum + subscription manager |
| FR-04 | High | Yes | QoS routing in Client |
| FR-05 | High | Yes | SubscriptionManager topic construction |
| FR-06 | Medium | Yes | isExtensionTopic utility |
| FR-07 | Critical | Yes | Per-version JSON schema validators |
| FR-08 | High | Yes | Auto-header in publishTopic |
| FR-09 | High | Yes | LWT + connection tracking |
| FR-10 | Critical | Yes | AgvController order pipeline |
| FR-11 | Critical | Yes | Order update processing |
| FR-12 | High | Yes | cancelOrder instant action |
| FR-13 | High | Yes | Validation + error reporting |
| FR-14 | Critical | Yes | Action state machine |
| FR-15 | High | Yes | Blocking type enforcement |
| FR-16 | Medium | Partial | V3.0 type exists; controller logic TBD |
| FR-17 | Critical | Yes | State publishing in AgvController |
| FR-18 | Critical | Yes | Node/edge traversal tracking |
| FR-19 | Medium | Yes | Visualization topic support |
| FR-20 | High | Yes | Factsheet pub/sub |
| FR-21 | Medium | Yes | Corridor types defined |
| FR-22 | Medium | Yes (types) | ZoneSet topic + types for V3.0 |
| FR-23 | Medium | Yes (types) | Responses topic + types for V3.0 |
| FR-24 | Low-Med | Partial | Map types in state; actions in adapter |
| FR-25 | High | Yes | Error reporting + levels |
| FR-26 | Critical | Yes | AgvAdapter interface |
| FR-27 | High | Yes | MasterController callbacks |
| FR-28 | High | Yes | Wildcard AgvId subscriptions |
| FR-29 | Medium | Yes | Dual-field instantActions |
| FR-30 | Low | Yes (types) | PlannedPath types defined |
| FR-31 | Low | Yes (types) | Translation types defined |
| FR-32 | High | Yes | Per-version enum definitions |
| FR-33 | High | Yes | Per-version type files |
| FR-34 | High | Yes | Per-version type files |

---

## 4. User Stories

### US-01: Multi-Version Client Configuration
**As a** system integrator  
**I want to** configure the library with a specific VDA 5050 version (1.1, 2.0, 2.1, or 3.0)  
**So that** all messages are validated and structured according to the correct specification version.

**Acceptance Criteria:**
- AC-01.1: Setting `vdaVersion: "1.1.0"` uses V1.1 schemas and types
- AC-01.2: Setting `vdaVersion: "3.0.0"` uses V3.0 schemas and types
- AC-01.3: Invalid version string is rejected at construction time
- AC-01.4: Version is embedded in MQTT topic path

### US-02: AGV Client Publishing
**As an** AGV software developer  
**I want to** create an AGV client bound to my vehicle's identity  
**So that** I can publish state, visualization, connection, and factsheet messages.

**Acceptance Criteria:**
- AC-02.1: AgvClient auto-populates manufacturer/serialNumber headers
- AC-02.2: Published messages pass JSON schema validation for the configured version
- AC-02.3: headerId increments with each published message per topic
- AC-02.4: Timestamp is ISO 8601 UTC format

### US-03: Master Control Subscription
**As a** fleet control developer  
**I want to** subscribe to state messages from all AGVs using wildcard subscriptions  
**So that** I can monitor the entire fleet.

**Acceptance Criteria:**
- AC-03.1: Subscribing with partial AgvId receives messages from all matching AGVs
- AC-03.2: Each received message invokes the subscription handler with correct AgvId
- AC-03.3: Connection tracking automatically maintains online/offline status per AGV

### US-04: Order Assignment and Tracking
**As a** fleet control developer  
**I want to** assign orders to AGVs and receive lifecycle callbacks  
**So that** I can track order progress and react to state changes.

**Acceptance Criteria:**
- AC-04.1: MasterController publishes valid order messages
- AC-04.2: onOrderProcessed callback fires when AGV completes or rejects order
- AC-04.3: onNodeTraversed callback fires for each node the AGV passes
- AC-04.4: onEdgeTraversing/onEdgeTraversed callbacks fire for edge transitions
- AC-04.5: Order updates with higher orderUpdateId extend the route

### US-05: Order Execution on AGV
**As an** AGV controller  
**I want to** receive and execute orders (node-edge-graph traversal with actions)  
**So that** my vehicle fulfills transport requests.

**Acceptance Criteria:**
- AC-05.1: Valid orders are accepted and traversal begins from the first base node
- AC-05.2: Actions on nodes execute with correct blocking type semantics
- AC-05.3: Edge traversal respects max speed, orientation, and corridor constraints
- AC-05.4: State is published reflecting current position, node/edge states, and action states
- AC-05.5: Malformed or incompatible orders are rejected with appropriate error

### US-06: Order Cancellation
**As a** fleet control operator  
**I want to** cancel a running order via instant action  
**So that** the AGV stops safely at the last released node.

**Acceptance Criteria:**
- AC-06.1: `cancelOrder` instant action transitions the order to canceling state
- AC-06.2: AGV finishes current edge traversal and stops at next node
- AC-06.3: Running actions on the current node are canceled or allowed to finish
- AC-06.4: AGV reports empty order state after cancellation completes
- AC-06.5: New orders can be assigned after cancellation

### US-07: Instant Action Execution
**As a** fleet control developer  
**I want to** send instant actions to an AGV at any time  
**So that** I can trigger immediate operations like startPause, stopPause, or cancelOrder.

**Acceptance Criteria:**
- AC-07.1: Instant actions are received and processed regardless of order state
- AC-07.2: Action state transitions are reported in state messages
- AC-07.3: V2.1 accepts both `actions` and `instantActions` field names
- AC-07.4: V3.0 instant actions use `PurpleBlockingType.NONE` blocking

### US-08: Connection Monitoring via LWT
**As a** fleet control system  
**I want to** automatically detect AGV disconnection via MQTT Last Will  
**So that** I can handle communication failures.

**Acceptance Criteria:**
- AC-08.1: AGV publishes `ONLINE` connection state on connect
- AC-08.2: Broker publishes `CONNECTIONBROKEN`/`CONNECTION_BROKEN` on unexpected disconnect
- AC-08.3: AGV publishes `OFFLINE` on graceful disconnect
- AC-08.4: V3.0 supports `HIBERNATING` state
- AC-08.5: Connection topic uses QoS 1

### US-09: Factsheet Exchange
**As an** integrator  
**I want to** retrieve the AGV factsheet describing its capabilities  
**So that** I can configure the fleet control accordingly.

**Acceptance Criteria:**
- AC-09.1: AGV publishes factsheet with geometry, load specs, physical parameters
- AC-09.2: Protocol features list supported actions with parameters and scopes
- AC-09.3: Protocol limits specify max string/array lengths and timing constraints
- AC-09.4: V2.1 includes vehicleConfig with network configuration
- AC-09.5: V3.0 makes most factsheet fields required (not optional)

### US-10: Corridor Navigation (V2.1+)
**As an** AGV controller receiving orders with corridor edges  
**I want to** interpret corridor width and reference point configuration  
**So that** my vehicle navigates within the defined corridor boundaries.

**Acceptance Criteria:**
- AC-10.1: Edge with corridor data is accepted and corridor dimensions are available
- AC-10.2: `corridorRefPoint` (V2.1) / `corridorReferencePoint` (V3.0) selects reference frame
- AC-10.3: V3.0 `releaseRequired` and `releaseLossBehavior` are handled

### US-11: Zone Management (V3.0)
**As a** fleet control system  
**I want to** send zone set configurations to mobile robots  
**So that** they respect speed limits, crossing rules, and interaction zones.

**Acceptance Criteria:**
- AC-11.1: ZoneSet message is published on the zoneSet topic
- AC-11.2: Mobile robot validates and stores zone sets
- AC-11.3: Zone requests appear in state with status tracking
- AC-11.4: Speed zones, crossing zones, and interaction zones are differentiated

### US-12: Request/Response Mechanism (V3.0)
**As a** mobile robot  
**I want to** request edge grants or zone interaction grants from fleet control  
**So that** I can proceed through controlled areas.

**Acceptance Criteria:**
- AC-12.1: Edge requests with corridor `releaseRequired` are included in state
- AC-12.2: Zone requests for interactive zones appear in state
- AC-12.3: Fleet control publishes response messages granting/denying requests
- AC-12.4: Mobile robot processes granted responses and continues navigation

### US-13: Schema Validation per Version
**As a** developer  
**I want to** have inbound messages validated against the correct schema  
**So that** malformed or incompatible messages are rejected with clear errors.

**Acceptance Criteria:**
- AC-13.1: V1.1 messages with V2.0-only fields are rejected when configured for V1.1
- AC-13.2: V3.0 messages with zoneSet data validate correctly
- AC-13.3: Validation errors are reported with field path and error description
- AC-13.4: Extension topics bypass standard schema validation

### US-14: Virtual AGV Simulation
**As a** developer testing fleet control logic  
**I want to** use a virtual AGV adapter that simulates driving, battery, and actions  
**So that** I can test without physical hardware.

**Acceptance Criteria:**
- AC-14.1: VirtualAgvAdapter simulates position updates during edge traversal
- AC-14.2: Battery state decreases during operation
- AC-14.3: Predefined actions (pick, drop, charge, etc.) execute with realistic timing
- AC-14.4: Safety states and operating modes are simulatable

### US-15: Error Reporting with Levels
**As an** AGV controller  
**I want to** report errors with appropriate severity levels  
**So that** fleet control can prioritize and handle issues.

**Acceptance Criteria:**
- AC-15.1: V1.1–V2.1 support WARNING and FATAL error levels
- AC-15.2: V3.0 additionally supports URGENT and CRITICAL levels
- AC-15.3: Errors include references to related objects (orderId, actionId, etc.)
- AC-15.4: V2.1+ supports `errorHint` for resolution guidance
- AC-15.5: V3.0 supports `errorDescriptionTranslations` for i18n

### US-16: Action State Machine
**As an** AGV controller  
**I want to** manage action lifecycle through defined states  
**So that** fleet control has accurate real-time action status.

**Acceptance Criteria:**
- AC-16.1: Actions transition: WAITING → INITIALIZING → RUNNING → FINISHED
- AC-16.2: Actions can transition to PAUSED from RUNNING and back
- AC-16.3: Actions can transition to FAILED from any active state
- AC-16.4: V3.0 supports RETRIABLE status for failed-but-retryable actions
- AC-16.5: Action result descriptions are reported in `resultDescription`

### US-17: AGV Position and Safety State
**As a** fleet control system  
**I want to** receive accurate position, velocity, and safety information  
**So that** I can make traffic control decisions.

**Acceptance Criteria:**
- AC-17.1: V1.1–V2.1 report `agvPosition` with `positionInitialized`
- AC-17.2: V3.0 reports `mobileRobotPosition` with `localized`
- AC-17.3: Safety status includes e-stop state and field violation
- AC-17.4: Velocity reports omega, vx, vy components

### US-18: Battery/Power Supply Management
**As a** fleet control system  
**I want to** monitor AGV energy state  
**So that** I can schedule charging orders.

**Acceptance Criteria:**
- AC-18.1: V1.1–V2.1 report `batteryState` with `batteryCharge`, `reach`, `charging`
- AC-18.2: V3.0 reports `powerSupply` with `stateOfCharge`, `range`, `batteryCurrent`
- AC-18.3: Battery voltage is reported when available

### US-19: Topic Character Validation
**As a** library user  
**I want** manufacturer and serialNumber fields validated against allowed characters  
**So that** MQTT topics are well-formed.

**Acceptance Criteria:**
- AC-19.1: Characters `/`, `$`, `+`, `#` are rejected in topic fields
- AC-19.2: Only `A-Z a-z 0-9 _ - . :` are recommended for IDs
- AC-19.3: V3.0 additionally bans MQTT wildcards `+` and `#`

### US-20: Planned Path Visualization (V3.0)
**As a** visualization system  
**I want to** receive planned path data from freely navigating mobile robots  
**So that** I can display future trajectories.

**Acceptance Criteria:**
- AC-20.1: `plannedPath` with polyline segments is included in visualization messages
- AC-20.2: `intermediatePath` shows immediate path between nodes
- AC-20.3: `referenceStateHeaderId` links visualization to corresponding state message

---

## 5. Test Case Requirements

### TC-01: Client Construction & Version Selection
| ID | Test | Expected |
|----|------|----------|
| TC-01.1 | Construct client with `vdaVersion: "1.1.0"` | Client created, uses V1.1 validators |
| TC-01.2 | Construct client with `vdaVersion: "2.0.0"` | Client created, uses V2.0 validators |
| TC-01.3 | Construct client with `vdaVersion: "2.1.0"` | Client created, uses V2.1 validators |
| TC-01.4 | Construct client with `vdaVersion: "3.0.0"` | Client created, uses V3.0 validators |
| TC-01.5 | Construct client with invalid version | Error thrown |

### TC-02: MQTT Topic Construction
| ID | Test | Expected |
|----|------|----------|
| TC-02.1 | Topic for V2.0 order | `uagv/v2/manufacturer/serial/order` |
| TC-02.2 | Topic for V3.0 order | `vda5050/v3/manufacturer/serial/order` |
| TC-02.3 | Topic for V3.0 zoneSet | `vda5050/v3/manufacturer/serial/zoneSet` |
| TC-02.4 | Topic for V3.0 responses | `vda5050/v3/manufacturer/serial/responses` |
| TC-02.5 | Topic with `/` in manufacturer | Rejected |
| TC-02.6 | Wildcard subscription for all AGVs | Correct MQTT wildcard pattern |

### TC-03: Order Validation
| ID | Test | Expected |
|----|------|----------|
| TC-03.1 | Valid order with base nodes only | Accepted |
| TC-03.2 | Valid order with base + horizon | Accepted |
| TC-03.3 | Order missing required `orderId` | Rejected with validation error |
| TC-03.4 | Order update with higher orderUpdateId | Accepted, extends route |
| TC-03.5 | Order update with lower orderUpdateId | Rejected, error reported |
| TC-03.6 | Order with V3.0 corridor including `releaseRequired` | Accepted on V3.0 |
| TC-03.7 | V1.1 order with `distance` field on edge | Accepted on V1.1; `length` on V2.0+ |

### TC-04: Action Processing
| ID | Test | Expected |
|----|------|----------|
| TC-04.1 | Node action with HARD blocking | Action blocks driving and other actions |
| TC-04.2 | Node action with SOFT blocking | Action blocks driving, allows other SOFT/NONE |
| TC-04.3 | Node action with NONE blocking | Action runs concurrently |
| TC-04.4 | V3.0 SINGLE blocking | Allows driving but blocks other actions |
| TC-04.5 | Action state WAITING → INITIALIZING → RUNNING → FINISHED | All transitions reported |
| TC-04.6 | Action fails with FAILED status | Error reported, action state FAILED |
| TC-04.7 | V3.0 action fails with RETRIABLE status | State shows RETRIABLE |
| TC-04.8 | Cancel running action | Action transitions to FAILED |

### TC-05: Instant Actions
| ID | Test | Expected |
|----|------|----------|
| TC-05.1 | `cancelOrder` instant action | Order cancellation initiated |
| TC-05.2 | `startPause` instant action | AGV pauses, operatingMode changes |
| TC-05.3 | `stopPause` instant action | AGV resumes |
| TC-05.4 | V2.1 message with `instantActions` field name | Accepted |
| TC-05.5 | V2.1 message with `actions` field name | Accepted |
| TC-05.6 | Instant action with no active order | Processed (non-order actions) |
| TC-05.7 | V3.0 instant action blocking type is NONE | Validated correctly |

### TC-06: Connection Management
| ID | Test | Expected |
|----|------|----------|
| TC-06.1 | AGV connects to broker | Publishes ONLINE connection state |
| TC-06.2 | AGV disconnects gracefully | Publishes OFFLINE |
| TC-06.3 | AGV disconnects unexpectedly | Broker delivers CONNECTIONBROKEN (V2.1) |
| TC-06.4 | V3.0 unexpected disconnect | State is CONNECTION_BROKEN |
| TC-06.5 | V3.0 HIBERNATING state | Published and received correctly |
| TC-06.6 | Connection topic uses QoS 1 | Verified at MQTT level |

### TC-07: State Publishing
| ID | Test | Expected |
|----|------|----------|
| TC-07.1 | State includes all required fields for V1.1 | Schema validates |
| TC-07.2 | State includes all required fields for V2.0 | Schema validates |
| TC-07.3 | State includes all required fields for V2.1 | Schema validates |
| TC-07.4 | State includes all required fields for V3.0 | Schema validates |
| TC-07.5 | V2.1 state with maps array | Accepted |
| TC-07.6 | V3.0 state with powerSupply instead of batteryState | Validated correctly |
| TC-07.7 | V3.0 state with safetyState instead of safetyStatus | Validated correctly |
| TC-07.8 | V3.0 state with edgeRequests | Validated correctly |
| TC-07.9 | V3.0 state with zoneRequests | Validated correctly |

### TC-08: Factsheet
| ID | Test | Expected |
|----|------|----------|
| TC-08.1 | V2.0 factsheet with all optional fields | Validated |
| TC-08.2 | V2.1 factsheet with vehicleConfig + network | Validated |
| TC-08.3 | V3.0 factsheet with required fields omitted | Rejected |
| TC-08.4 | V3.0 factsheet with mobileRobotGeometry | Validated |
| TC-08.5 | Factsheet protocol features list actions with scopes | Parsed correctly |

### TC-09: Error Handling
| ID | Test | Expected |
|----|------|----------|
| TC-09.1 | Report WARNING error | Error in state with level WARNING |
| TC-09.2 | Report FATAL error | Error in state with level FATAL |
| TC-09.3 | V3.0 report URGENT error | Error in state with level URGENT |
| TC-09.4 | V3.0 report CRITICAL error | Error in state with level CRITICAL |
| TC-09.5 | Error with errorReference | Reference included in error object |
| TC-09.6 | V2.1+ error with errorHint | Hint included |
| TC-09.7 | V3.0 error with translations | Translations array included |

### TC-10: Node/Edge Traversal
| ID | Test | Expected |
|----|------|----------|
| TC-10.1 | AGV reaches first node | lastNodeId updated, node actions triggered |
| TC-10.2 | AGV enters edge | edgeStates updated, edge actions triggered |
| TC-10.3 | AGV reaches next node | Previous edge removed from edgeStates |
| TC-10.4 | AGV at last released node | Driving stops, base request sent if horizon exists |
| TC-10.5 | Order update releases horizon | Driving resumes through new base nodes |

### TC-11: Order Cancellation Flow
| ID | Test | Expected |
|----|------|----------|
| TC-11.1 | Cancel order while on edge | AGV completes edge, stops at next node |
| TC-11.2 | Cancel order while on node | AGV stops, clears remaining route |
| TC-11.3 | Cancel with running actions | Actions canceled or completed per type |
| TC-11.4 | Assign new order after cancel | New order accepted and executed |
| TC-11.5 | Cancel when no order active | Error reported |

### TC-12: Virtual AGV Adapter
| ID | Test | Expected |
|----|------|----------|
| TC-12.1 | Simulate edge traversal | Position interpolated over time |
| TC-12.2 | Simulate battery drain | Battery charge decreases |
| TC-12.3 | Simulate pick action | Load attached to AGV state |
| TC-12.4 | Simulate drop action | Load removed from AGV state |
| TC-12.5 | Simulate charge action | Battery charge increases |

### TC-13: Fleet-Wide Monitoring
| ID | Test | Expected |
|----|------|----------|
| TC-13.1 | Subscribe to all AGV states | Receives state from multiple AGVs |
| TC-13.2 | Track connection for all AGVs | AgvIdMap tracks online/offline per AGV |
| TC-13.3 | Filter by manufacturer | Only matching AGV messages received |

### TC-14: Zone Management (V3.0)
| ID | Test | Expected |
|----|------|----------|
| TC-14.1 | Publish valid zoneSet | Message validated and delivered |
| TC-14.2 | ZoneSet with speed zone | Zone type and parameters correct |
| TC-14.3 | ZoneSet with crossing zone | Zone type correct |
| TC-14.4 | ZoneSet with interaction zone | Zone type and interaction rules correct |
| TC-14.5 | Invalid zoneSet schema | Rejected with validation error |

### TC-15: Responses (V3.0)
| ID | Test | Expected |
|----|------|----------|
| TC-15.1 | Publish response for edge request | Response delivered with grant status |
| TC-15.2 | Publish response for zone request | Response delivered with grant status |
| TC-15.3 | Response with unknown requestId | Handled gracefully |

### TC-16: Cross-Version Enum Compatibility
| ID | Test | Expected |
|----|------|----------|
| TC-16.1 | V2.1 ConnectionState.CONNECTIONBROKEN | Validates correctly |
| TC-16.2 | V3.0 ConnectionState.CONNECTION_BROKEN | Validates correctly |
| TC-16.3 | V2.1 OperatingMode.TEACHIN | Validates correctly |
| TC-16.4 | V3.0 OperatingMode.TEACH_IN | Validates correctly |
| TC-16.5 | V2.1 EStop enum values | Validates correctly |
| TC-16.6 | V3.0 ActiveEmergencyStop enum values | Validates correctly |
| TC-16.7 | V3.0 ActionStatus.RETRIABLE | Validates correctly |
| TC-16.8 | V3.0 BlockingType.SINGLE | Validates correctly |

### TC-17: Edge Field Compatibility
| ID | Test | Expected |
|----|------|----------|
| TC-17.1 | V1.1 edge with `distance` | Validates on V1.1 |
| TC-17.2 | V2.0+ edge with `length` | Validates on V2.0+ |
| TC-17.3 | V2.1 edge with corridor | Validates with corridor data |
| TC-17.4 | V3.0 edge without startNodeId/endNodeId | Validates (fields removed) |
| TC-17.5 | V3.0 edge with maximumSpeed | Validates (renamed from maxSpeed) |

### TC-18: Visualization
| ID | Test | Expected |
|----|------|----------|
| TC-18.1 | Publish visualization at high frequency | Messages delivered |
| TC-18.2 | V3.0 visualization with plannedPath | Validated correctly |
| TC-18.3 | V3.0 visualization with intermediatePath | Validated correctly |
| TC-18.4 | V3.0 visualization with referenceStateHeaderId | Links to state message |

---

## 6. Traceability Matrix

| User Story | Functional Req | Test Cases |
|------------|---------------|------------|
| US-01 | FR-01, FR-07 | TC-01, TC-13 |
| US-02 | FR-02, FR-08 | TC-02, TC-07 |
| US-03 | FR-03, FR-28 | TC-02, TC-13 |
| US-04 | FR-10, FR-11, FR-27 | TC-03, TC-04, TC-10 |
| US-05 | FR-10, FR-14, FR-15 | TC-03, TC-04, TC-10 |
| US-06 | FR-12 | TC-05, TC-11 |
| US-07 | FR-14, FR-29 | TC-05 |
| US-08 | FR-09, FR-04 | TC-06 |
| US-09 | FR-20 | TC-08 |
| US-10 | FR-21 | TC-03, TC-17 |
| US-11 | FR-22 | TC-14 |
| US-12 | FR-23 | TC-15 |
| US-13 | FR-07 | TC-03, TC-07, TC-08 |
| US-14 | FR-26 | TC-12 |
| US-15 | FR-25 | TC-09 |
| US-16 | FR-14, FR-16 | TC-04 |
| US-17 | FR-17, FR-34 | TC-07, TC-16 |
| US-18 | FR-33 | TC-07 |
| US-19 | FR-05 | TC-02 |
| US-20 | FR-19, FR-30 | TC-18 |
