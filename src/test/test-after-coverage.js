/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const fs = require("fs");
const fse = require("fs-extra");
const lcovTotal = require("lcov-total");
const path = require("path");

function copySync(from, to) {
    fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(elem => {
        if (fs.lstatSync(path.join(from, elem)).isFile()) {
            fs.copyFileSync(path.join(from, elem), path.join(to, elem));
        } else {
            copySync(path.join(from, elem), path.join(to, elem));
        }
    });
}

function releaseCoverageReport() {
    const docsFolder = "docs/coverage";

    try {
        fse.emptyDirSync(docsFolder);
        copySync("coverage", docsFolder);

        const coveragePercent = Math.floor(lcovTotal("./coverage/lcov.info"));

        // Create a shields.io JSON endpoint for a dynamic coverage badge in the
        // project's README.md.
        const shieldsioJsonFile = path.join(docsFolder, "coverage.shieldsio.json");
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
