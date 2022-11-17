/*! Copyright (c) 2021 Siemens AG */

import Debug from "debug";
import * as fs from "fs-extra";
import * as util from "util";
import {
    ActionStatus,
    AgvController,
    AgvId,
    ClientOptions,
    Headerless,
    InstantActions,
    MasterController,
    Order,
    Topic,
    VirtualAgvAdapter,
    VirtualAgvAdapterOptions,
} from "vda-5050-lib";

interface TestConfig {
    testOptions: {
        breakOnError?: boolean,
        logEvents?: boolean,
        logConnectionState?: boolean,
        logState?: boolean,
        logVisualization?: boolean,
        logMqtt?: boolean,
        logConfig?: boolean;
        runVirtualAgv?: boolean,
    };
    communicationOptions: ClientOptions;
    agv: AgvId;
    topics: Array<Headerless<Order> | Headerless<InstantActions>>;
}

const CONFIG: TestConfig = getConfig();

const LOG_PREFIX = "test";

// Enable all test namespaces for logging.
let enabledNamespaces = `${LOG_PREFIX},${LOG_PREFIX}:*`;
if (CONFIG.testOptions.logMqtt) {
    // Turn on debug output for mqttjs library.
    enabledNamespaces += ",mqttjs*";
}
if (CONFIG.testOptions["logLib"]) {
    // Hidden option to turn on debug output for VDA 5050 library.
    enabledNamespaces += ",vda-5050:*";
}
Debug.enable(enabledNamespaces);

function logger(namespace?: string) {
    const namespaces = [LOG_PREFIX];
    if (namespace) {
        namespaces.push(namespace);
    }
    return Debug(namespaces.join(":"));
}

function getConfig(): TestConfig {
    try {
        return fs.readJsonSync(process.env.VDA_5050_DOCKER_RUNNING === "true" ?
            // Bind mounted target folder (see docker-compose.yml).
            "./config/vda-5050-test.config.json" :
            process.env.VDA_5050_TEST_CONFIG);
    } catch (error) {
        console.error("Error reading test configuration %s", error.message);
        process.exit(1);
    }
}

function logEnvVars() {
    const log = logger("ENV");
    Object.keys(process.env)
        .filter(key => key.startsWith("VDA_5050_TEST_"))
        .forEach(key => log("%s=%s", key, process.env[key]));
}

async function run() {
    try {
        logEnvVars();

        if (CONFIG.testOptions.logConfig) {
            logger("CONFIG")("%O", CONFIG);
        }

        logger()("broker URL %s", CONFIG.communicationOptions.transport.brokerUrl);
        logger()("target AGV %o", CONFIG.agv);

        const ac = await startVirtualAgvIfNeeded();

        logger()("starting master control");
        const mc = new MasterController(CONFIG.communicationOptions, { targetAgvs: CONFIG.agv });
        await mc.start();

        await trackConnectionState(mc);
        await trackState(mc);
        await trackVisualization(mc);

        await processTopics(mc);

        await mc.stop();
        ac && await ac.stop();
    } catch (error) {
        logger("ERROR")("master control could not be started. Ensure brokerUrl is correct. %o", error);
        process.exit(1);
    }
}

async function startVirtualAgvIfNeeded() {
    if (CONFIG.testOptions.runVirtualAgv) {
        logger()("starting virtual AGV");
        const agvControllerOptions = {
            agvAdapterType: VirtualAgvAdapter,
        };
        const agvAdapterOptions: VirtualAgvAdapterOptions = {};
        const ac = new AgvController(CONFIG.agv, CONFIG.communicationOptions, agvControllerOptions, agvAdapterOptions);
        await ac.start();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return ac;
    }
    return undefined;
}

async function trackConnectionState(mc: MasterController) {
    if (CONFIG.testOptions.logConnectionState === false) {
        return;
    }
    logger("CONNECTION")("tracking connection state of AGV");
    mc.trackAgvs((agvId, connectionState, timestamp) => {
        if (util.isDeepStrictEqual(agvId, CONFIG.agv)) {
            logger("CONNECTION")("%s at %s", connectionState, timestamp);
        }
    });
}

async function trackState(mc: MasterController) {
    if (!CONFIG.testOptions.logState) {
        return;
    }
    logger("STATE")("tracking state of AGV");
    await mc.subscribe(Topic.State, CONFIG.agv, state => {
        logger("STATE")("%o", state);
    });
}

async function trackVisualization(mc: MasterController) {
    if (!CONFIG.testOptions.logVisualization) {
        return;
    }
    logger("VISUALIZATION")("tracking visualization of AGV");
    await mc.subscribe(Topic.Visualization, CONFIG.agv, vis => {
        logger("VISUALIZATION")("%o", vis);
    });
}

async function processTopics(mc: MasterController) {
    for (const topic of CONFIG.topics) {
        try {
            if ("instantActions" in topic) {
                await processInstantActions(topic, mc);
            } else {
                await processOrder(topic, mc);
            }
        } catch (error) {
            if (CONFIG.testOptions.breakOnError) {
                logger()("Processing stopped as flag breakOnError is enabled");
                break;
            }
        }
    }
}

function processOrder(order: Headerless<Order>, mc: MasterController) {
    // tslint:disable-next-line: no-empty
    const log = CONFIG.testOptions.logEvents === false ? () => { } : logger("ORDER");
    return new Promise<void>(async (resolve, reject) => {
        try {
            const headeredOrder = await mc.assignOrder(CONFIG.agv, order, {
                onOrderProcessed: (withError, byCancelation, active, context) => {
                    if (withError) {
                        log("rejected orderId: %s orderUpdateId: %d with error %o",
                            context.order.orderId, context.order.orderUpdateId, withError);
                        reject(withError);
                    } else if (byCancelation) {
                        log("canceled orderId: %s orderUpdateId: %d", context.order.orderId, context.order.orderUpdateId);
                        resolve();
                    } else if (active) {
                        log("processed (still active) orderId: %s orderUpdateId: %d", context.order.orderId, context.order.orderUpdateId);
                        resolve();
                    } else {
                        log("processed (complete) orderId: %s orderUpdateId: %d", context.order.orderId, context.order.orderUpdateId);
                        resolve();
                    }
                },
                onNodeTraversed: (node, nextEdge, nextNode, context) => {
                    log("node traversed %o", node);
                },
                onEdgeTraversing: (edge, startNode, endNode, stateChanges, invocationCount, context) => {
                    log("edge traversing %o with state changes %o on invocation %d", edge, stateChanges, invocationCount);
                },
                onEdgeTraversed: (edge, startNode, endNode, context) => {
                    log("edge traversed %o", edge);
                },
                onActionStateChanged: (actionState, withError) => {
                    if (withError) {
                        log("action state changed %o with error %o", actionState, withError);
                    } else {
                        log("action state changed %o", actionState);
                    }
                },
            });
            if (headeredOrder === undefined) {
                log("discarded orderId: %s orderUpdateId: %d as active order has same orderId and orderUpdateId",
                    order.orderId, order.orderUpdateId);
            } else {
                log("assigned order %o", headeredOrder);
            }
        } catch (error) {
            log("invalid order: %s", error.message);
            reject(error);
        }
    });
}

function processInstantActions(instantActions: Headerless<InstantActions>, mc: MasterController) {
    // tslint:disable-next-line: no-empty
    const log = CONFIG.testOptions.logEvents === false ? () => { } : logger("INSTANTACTIONS");
    return new Promise<void>(async (resolve, reject) => {
        try {
            let actionsEndedCount = 0;
            const headeredActions = await mc.initiateInstantActions(CONFIG.agv, instantActions, {
                onActionStateChanged: (actionState, withError, action) => {
                    if (withError) {
                        log("action state changed %o with error %o", actionState, withError);
                    } else {
                        log("action state changed %o", actionState);
                    }
                    if (actionState.actionStatus === ActionStatus.Finished || actionState.actionStatus === ActionStatus.Failed) {
                        actionsEndedCount++;
                    }
                    if (actionsEndedCount === instantActions.instantActions.length) {
                        resolve();
                    }
                },
                onActionError: (error, action) => {
                    log("rejected action %o with error %o", action, error);
                    reject(error);
                },
            });
            log("initiated %o", headeredActions);
        } catch (error) {
            log("invalid actions: %s", error.message);
            reject(error);
        }
    });
}

run();
