/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const { fork, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const mqtt = require("mqtt");

const testContextFile = path.join(os.tmpdir(), "vda-5050-test-context.json");
const defaultTestBrokerConfigFile = path.resolve(__dirname, "test-broker.config.js");
const testBrokerConfigFile = path.join(os.tmpdir(), "vda-5050-test-broker.config.js");

function startBroker() {
    const shouldUseExternalBroker = process.env.VDA5050_TEST_BROKER !== undefined;
    const shouldDebugBroker = process.env.DEBUG && process.env.DEBUG.split(",").some(m => m === "broker");
    return new Promise(resolve => {
        if (shouldUseExternalBroker) {
            // Use an external MQTT broker that is started and stopped manually.
            // Host, TCP and WS ports must be passed in the env var
            // VDA5050_TEST_BROKER=<host>:<tcp-port>:<ws-port>/path
            const [host, tcp, ws] = process.env.VDA5050_TEST_BROKER.split(":");
            const brokerUrls = [
                `mqtt://${host}:${tcp}`,
                `mqtt://${host}:${ws}`,
            ];
            fs.writeFileSync(testContextFile, JSON.stringify({
                brokerPid: "ExternalBroker",
                shouldTerminateBroker: false,
                canStopAndRestartBrokerWhileTesting: false,
                supportsMqtt5: true,
                brokerUrls,
            }));
            resolve(brokerUrls);
            return;
        }

        const brokerScriptPath = require.resolve("vda-5050-cli/lib/broker.js");
        const brokerConfig = require(defaultTestBrokerConfigFile);
        const brokerUrls = [
            `mqtt://${brokerConfig.host}:${brokerConfig.port}`,
            `mqtt://${brokerConfig.host}:${brokerConfig.wsPort}`,
        ];

        if (shouldDebugBroker) {
            brokerConfig.veryVerbose = true;
        }

        fs.writeFileSync(testBrokerConfigFile, `module.exports = ${JSON.stringify(brokerConfig)};`);

        let child;

        if (shouldDebugBroker) {
            child = spawn("node", ["./lib/broker.js", testBrokerConfigFile], {
                cwd: path.dirname(path.dirname(brokerScriptPath)),
                detached: true,
                shell: true,
                stdio: ["ignore", 1, 2]
            });
        } else {
            child = fork("./lib/broker.js", [testBrokerConfigFile], {
                cwd: path.dirname(path.dirname(brokerScriptPath)),
                detached: true,
                windowsHide: true,
                stdio: "ignore",
            });
        }

        fs.writeFileSync(testContextFile, JSON.stringify({
            brokerPid: child.pid,
            shouldTerminateBroker: shouldDebugBroker ? false : true,
            canStopAndRestartBrokerWhileTesting: shouldDebugBroker ? false : true,
            // @todo update as soon as aedes broker supports MQTT 5.0
            supportsMqtt5: false,
            brokerUrls,
        }));

        child.connected && child.disconnect();
        child.unref();

        awaitBrokerStarted(brokerUrls, resolve);
    });
}

function awaitBrokerStarted(brokerUrls, resolve) {
    // Await broker up and accepting connections.
    const client = mqtt.connect(brokerUrls[0]);
    client.once("connect", () => {
        client.end(true, () => {
            // Defer removal of event listeners to ensure proper clean up.
            setTimeout(() => client.removeAllListeners(), 0);
            resolve(brokerUrls);
        });
    });
}

async function stopBroker() {
    let options;
    try {
        options = JSON.parse(fs.readFileSync(testContextFile).toString());
        options.shouldTerminateBroker && process.kill(options.brokerPid);
    } catch { }
    try {
        fs.unlinkSync(testContextFile);
    } catch { }
    try {
        fs.unlinkSync(testBrokerConfigFile);
    } catch { }
    return options === undefined ? false : options.shouldTerminateBroker;
}

module.exports = {
    startBroker,
    stopBroker,
};
