/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// Overridden configuration options for vda-5050 test broker.
//
// Configuration options can be represented in a JSON file or in a
// JavaScript file with options exported by `module.exports = {
// ...<configOptions> }`.
//
// For option details, see https://github.com/moscajs/aedes-cli#usage
module.exports = {
    // SERVERS
    protos: ["tcp", "ws"],
    host: "127.0.0.1",
    port: 1888,
    wsPort: 9888,
};
