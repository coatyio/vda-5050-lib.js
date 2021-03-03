/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const fse = require("fs-extra");
const lcovTotal = require("lcov-total");
const path = require("path");

function releaseCoverageReport() {
    const docsFolder = "docs/coverage/";

    try {
        fse.emptyDirSync(docsFolder);
        fse.copySync("coverage", docsFolder);

        const coveragePercent = Math.floor(lcovTotal("./coverage/lcov.info"));

        // Create a shields.io JSON endpoint for a dynamic coverage badge in the
        // project's README.md.
        const shieldsioJsonFile = path.join(docsFolder, ".coverage.shieldsio.json");
        fse.writeFileSync(shieldsioJsonFile, JSON.stringify({
            "schemaVersion": 1,
            "label": "coverage",
            "message": `${coveragePercent}%`,
            "color": "brightgreen"
        }));

        console.log("Released coverage report in", docsFolder);
        console.log("Created coverage badge info with %d% in %s", coveragePercent, shieldsioJsonFile);
    } catch (error) {
        console.error("Coverage report and badge couldn't be released to %s: %s", docsFolder, error);
    }
}

releaseCoverageReport();
