/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

import { AgvId } from "..";

/**
 * Maps AGV identifiers to values of a given value type.
 *
 * An AgvIdMap object iterates its elements in insertion order; a for-of loop
 * returns an array of [agvId, value] for each iteration.
 * 
 * @category Common
 */
export class AgvIdMap<T> {

    private readonly _map: Map<string, Map<string, T>> = new Map();

    /**
     * Gets the number of AgvId - value associations.
     *
     * @returns total number of values in the map
     */
    get size() {
        let size = 0;
        this._map.forEach(map => size += map.size);
        return size;
    }

    /**
     * Gets the value associated with the given AGV identifier.
     * 
     * @param agvId an AGV identifier
     * @returns associated value or `undefined` if not existing
     */
    get(agvId: AgvId): T {
        const map = this._map.get(agvId.manufacturer);
        if (!map) {
            return undefined;
        }
        return map.get(agvId.serialNumber);
    }

    /**
     * Associates the given value with the given AGV identifier.
     * 
     * @param agvId an AGV identifier
     * @param value value to be associated
     */
    set(agvId: AgvId, value: T) {
        let map = this._map.get(agvId.manufacturer);
        if (!map) {
            map = new Map();
            this._map.set(agvId.manufacturer, map);
        }
        map.set(agvId.serialNumber, value);
    }

    /**
     * Deletes the value associated with the given AGV identifier.
     * 
     * @param agvId an AGV identifier
     */
    delete(agvId: AgvId) {
        const map = this._map.get(agvId.manufacturer);
        if (!map) {
            return;
        }
        map.delete(agvId.serialNumber);
        if (map.size === 0) {
            this._map.delete(agvId.manufacturer);
        }
    }

    /**
     * Clears all values of the AGV map.
     */
    clear() {
        this._map.clear();
    }

    *[Symbol.iterator]() {
        for (const [manufacturer, map] of this._map) {
            for (const [serialNumber, value] of map) {
                yield [{ manufacturer, serialNumber }, value] as [AgvId, T];
            }
        }
    }
}
