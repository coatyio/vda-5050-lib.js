/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const { stopBroker } = require("./test-broker");

stopBroker().then(isStopped => isStopped ?
    console.log("Stopped MQTT broker for testing") :
    console.log(`To stop MQTT broker for testing, close its terminal window manually!`)
);
