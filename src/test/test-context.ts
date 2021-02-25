/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import * as os from "os";
import * as path from "path";
import * as tp from "tap";
import * as util from "util";

import { ClientOptions, MqttTransportOptions } from "..";

/**
 * Regexp describing a valid UUID v4 string.
 */
export const UUID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}/;

/**
 * Initialize the toplevel tap test context.
 *
 * This function must be invoked in any test file *before* executing tests.
 *
 * @param tap a root-level Tap object as imported from "tap"
 */
export function initTestContext(tap: typeof tp) {
    const testContextFile = path.join(os.tmpdir(), "vda-5050-test-context.json");
    const testContext = require(testContextFile);

    Object.assign(tap.context, testContext);

    // Ensure test context is propagated to all child tests.
    tap.beforeEach((done, t) => {
        Object.assign(t.context, testContext);
        done();
    });
}

/**
 * Gets default test client options merged with the given partial options.
 * 
 * @param test a tap Test object
 * @param clientOptions overwriting partial client options (optional)
 * @returns client options for the given test
 */
export function testClientOptions(
    test: typeof tp.Test.prototype,
    clientOptions?: Partial<Omit<ClientOptions, "transport"> & { transport?: Partial<MqttTransportOptions> }>) {
    const clone = obj => JSON.parse(JSON.stringify(obj));
    const defaultClientOptions: ClientOptions = {
        // Support parallel test execution with isolated broker communication.
        interfaceName: `vda5050test${process.env.TAP_CHILD_ID}`,
        transport: {
            brokerUrl: test.context.brokerUrls[0],
        },
    };

    clientOptions = clientOptions && clone(clientOptions);
    const transportOptions = clientOptions?.transport;
    transportOptions && delete clientOptions.transport;
    const opts = Object.assign({}, defaultClientOptions, clientOptions);
    Object.assign(opts.transport, transportOptions, { wsBrokerUrl: test.context.brokerUrls[1] });
    return opts;
}

/**
 * Redirect output of a console logging function to a string array.
 *
 * @param mode the type of console to redirect
 * @param callback a function invoked whenever a new output string has been
 * generated; call the `done` function to stop redirection (optional)
 * @returns a function that, when called, stops redirection and returns an array
 * of redirected output strings ordered by console function invocations.
 */
export function consoleRedirect(
    mode: "log" | "error" | "info" | "warn" | "debug",
    callback?: (output: string[], done: () => void) => void): () => string[] {
    const output: string[] = [];
    let consoleFunc = console[mode];
    const completer = () => {
        if (consoleFunc === undefined) {
            return;
        }
        console[mode] = consoleFunc;
        consoleFunc = undefined;
        return output;
    };

    console[mode] = (data: any, ...args: any[]) => {
        output.push(util.format(data, ...args));
        if (callback) {
            callback(output, completer);
        }
    };

    return completer;
}
