/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const { startBroker } = require("./test-broker");

console.log(`Starting MQTT broker for testing...`);

startBroker()
    .then(brokerUrls => {
        console.log(`Started MQTT broker on ${brokerUrls.join(" and ")}`);
        process.exit();
    })
    .catch(error => {
        console.log("Failed to start MQTT broker:", error.message);
        process.exit(1);
    });
