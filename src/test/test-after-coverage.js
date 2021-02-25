/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const fs = require("fs");
const lcovTotal = require("lcov-total");

function coverageSummary() {
    try {
        const coveragePercent = Math.floor(lcovTotal("./coverage/lcov.info"));

        // Create a shields.io JSON endpoint for a dynamic coverage badge in the
        // project's README.md.
        const shieldsioJsonFile = ".coverage.shieldsio.json";
        fs.writeFileSync(shieldsioJsonFile, JSON.stringify({
            "schemaVersion": 1,
            "label": "coverage",
            "message": `${coveragePercent}%`,
            "color": "brightgreen"
        }));

        console.log("Created coverage badge info with %d% in %s", coveragePercent, shieldsioJsonFile);
    } catch (error) {
        console.error("Coverage badge info could not be created: %s", error);
    }
}

coverageSummary();
