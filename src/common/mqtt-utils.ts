/*! Copyright (c) 2021 Siemens AG. Licensed under the MIT License. */

const MAX_MQTT_TOPIC_UTF8_COUNT = 65535;

export function assertMqttTopicLength(mqttTopic: string) {
    if (mqttTopic.length * 4 > MAX_MQTT_TOPIC_UTF8_COUNT) {
        assertMqttTopicUtf8Count(getUtf8BytesCount(mqttTopic));
    }
}

export function assertMqttTopicUtf8Count(utf8Count: number) {
    if (utf8Count > MAX_MQTT_TOPIC_UTF8_COUNT) {
        throw new Error(`MQTT topic exceeds maximum allowed UTF-8 byte length`);
    }
}

export function getUtf8BytesCount(str: string) {
    // Returns the UTF-8 byte length of a JavaScript UTF-16 string that is not malformed.
    // (see https://tools.ietf.org/html/rfc3629#section-3).
    // Note: handles UTF-16 surrogate pairs but not grapheme clusters (like emojis).
    let count = 0;
    const strLen = str.length;
    for (let i = 0; i < strLen; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x007F) {
            count++;
        } else if (code <= 0x07FF) {
            count += 2;
        } else if (code <= 0xD7FF) {
            count += 3;
        } else if (code <= 0xDFFF) {
            // 0xD800 - 0xDBFF: High surrogates.
            // 0xDC00 - 0xDFFF: Low surrogates.
            count += 2;
        } else {
            // 0xE000 - 0xFFFF: 3 bytes in UTF-8.
            count += 3;
        }
    }
    return count;
}
