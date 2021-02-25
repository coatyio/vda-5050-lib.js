/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const glob = require("fast-glob");

module.exports = testFile => {
    return glob.sync([
        "dist/**/*.js",

        // Exclude auto-generated TS index file containing commonjs boilerplate code
        // never covered completely: Starting with TypeScript 3.9, an new
        // `__createBinding` helper function has been included into the generated
        // `index.js` file. However, it contains a branch that is never taken with the
        // target version "es2018" as specified in TS config options.
        "!dist/index.js",

        // Exclude auto-generated validation functions.
        "!dist/common/vda-5050-validators.js",

        // Exclude test utility functions from coverage.
        "!dist/test/**/*.js",
    ]);
};
