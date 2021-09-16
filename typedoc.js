/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

// Typedoc options (execute "typedoc --help" in node_modules/.bin)

module.exports = {

    // Can be used to prevent TypeDoc from cleaning the output directory specified with --out.
    cleanOutputDir: false,

    // Prevent externally resolved TypeScript files from being documented.
    excludeExternals: false,

    // Prevent private members from being included in the generated documentation.
    excludePrivate: true,

    // Ignores protected variables and methods
    excludeProtected: false,

    // Specifies the location to look for included documents.
    // Use [[include:FILENAME]] in comments.
    includes: "./",

    // Add the package version to the project name
    includeVersion: true,

    readme: "none",

    // Set the name of the project that will be used in the header of the template.
    name: `vda-5050-lib for VDA 5050 version 1.1`,

    // Specifies the location the documentation should be written to.
    out: `docs/api`,

    // Specifies the entry points to be documented by TypeDoc. TypeDoc will
    // examine the exports of these files and create documentation according
    // to the exports. 
    entryPoints: [`src/index.ts`],

    // Sets the name for the default category which is used when only some
    // elements of the page are categorized. Defaults to 'Other'
    defaultCategory: "VDA 5050",

    // This flag categorizes reflections by group (within properties,
    // methods, etc). To allow methods and properties of the same category
    // to be grouped together, set this flag to false. Defaults to true.
    categorizeByGroup: false,

    // Array option which allows overriding the order categories display in.
    // A string of * indicates where categories that are not in the list
    // should appear.
    categoryOrder: ["Master Controller", "AGV Controller", "AGV Adapter", "Client", "Common", "VDA 5050", "*"],

};
