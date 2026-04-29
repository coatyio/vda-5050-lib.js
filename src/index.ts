/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

/**
 * @module
 * @description
 * All public APIs.
 */

export * from "./common/agvid-map";
export * from "./common/client-types";
export * from "./common/client";
export * from "./common/vda-5050-types-2.1";

// Namespaced per-version type exports. Use these to access version-specific
// types without naming conflicts, e.g.: import { V30 } from "vda-5050-lib";
// then V30.Connection, V30.Order, etc.
export * as V1_1 from "./common/vda-5050-types-1.1";
export * as V2_0 from "./common/vda-5050-types-2.0";
export * as V2_1 from "./common/vda-5050-types-2.1";
export * as V3_0 from "./common/vda-5050-types-3.0";
export * from "./client/agv-client";
export * from "./client/master-control-client";
export * from "./controller/agv-controller";
export * from "./controller/master-controller";
export * from "./adapter/virtual-agv-adapter";
