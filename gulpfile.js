/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const fsextra = require("fs-extra");
const gulp = require("gulp");
const shell = require("gulp-shell");
const tsc = require("gulp-typescript");
const tslint = require("gulp-tslint");
const path = require("path");

/**
 * Clean distribution folder
 */
gulp.task("clean", () => fsextra.emptyDir("dist"));

/**
 * Transpile TS into JS code, using TS compiler in local typescript npm package.
 * Remove all comments except copyright header comments, and do not generate
 * corresponding .d.ts files (see task "transpile:dts").
 */
gulp.task("transpile:ts", () => {
    const tscConfig = require("./tsconfig.json");
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tsc(Object.assign(tscConfig.compilerOptions, {
            removeComments: true,
            declaration: false,
        })))
        .pipe(gulp.dest("dist"));
});

/**
 * Only emit TS declaration files, using TS compiler in local typescript npm
 * package. The generated declaration files include all comments so that IDEs
 * can provide this information to developers.
 */
gulp.task("transpile:dts", () => {
    const tscConfig = require("./tsconfig.json");
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tsc(Object.assign(tscConfig.compilerOptions, {
            removeComments: false,
            declaration: true,
        })))
        .dts
        .pipe(gulp.dest("dist"));
});

gulp.task("copy:js", () => {
    return gulp
        .src(["src/**/*.js"])
        .pipe(gulp.dest("dist"));
});

gulp.task("copy:assets", () => {
    return gulp
        .src([
            ".npmignore",
            "README.md",
            "LICENSE",
            "package.json",
        ])
        .pipe(gulp.dest("dist"));
});

/**
 * Lint the code
 */
gulp.task("lint", () => {
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tslint({
            configuration: "./tslint.json",
            formatter: "verbose",
        }))
        .pipe(tslint.report({
            emitError: false,
            summarizeFailureOutput: true
        }));
});

/**
 * Lint the code and fix lint errors
 */
gulp.task("lint:fix", () => {
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tslint({
            configuration: "./tslint.json",
            formatter: "verbose",
            fix: true
        }))
        .pipe(tslint.report({
            emitError: false,
            summarizeFailureOutput: true
        }));
});

/** 
 * Generate TypeDoc HTML documentation
 */
gulp.task("doc", () => {
    const typedocOptions = require(path.resolve("./typedoc.js"));
    fsextra.emptyDirSync(typedocOptions.out);
    return gulp
        .src(path.resolve("./typedoc.js"), { read: false })
        .pipe(shell(`${path.join("./node_modules/.bin/typedoc")} --options "<%= file.path %>"`));
});

gulp.task("build", gulp.series(
    "clean",
    "transpile:ts",
    "transpile:dts",
    "copy:js",
    "copy:assets",
    "lint"));

gulp.task("default", gulp.series("build"));
