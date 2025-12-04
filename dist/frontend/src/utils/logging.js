"use strict";
/**
 * @file src/utils/logging.ts
 * @description
 * Browser-safe logging for BTMS frontend.
 * Removes all Node APIs (process, util, colors).
 * Works in Vite, React, Safari, Chrome, and mobile.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWithTimestamp = exports.log = void 0;
let lastLogTime = performance.now();
// Browser-safe config: always allow logs unless overridden
let loggingConfig = { default: true };
exports.log = {
    info: (...args) => console.log('[info]', ...args),
    warn: (...args) => console.warn('[warn]', ...args),
    error: (...args) => console.error('[error]', ...args)
};
// Simple color approximations for browser console
const colorForElapsed = (elapsed) => {
    if (elapsed > 1.0)
        return 'color: red;';
    if (elapsed > 0.5)
        return 'color: orange;';
    if (elapsed > 0.3)
        return 'color: goldenrod;';
    return 'color: inherit;';
};
// Browser-safe object formatter (no util.inspect)
const safeFormat = (val) => {
    if (typeof val === 'object' && val !== null) {
        try {
            return JSON.stringify(val, null, 2);
        }
        catch {
            return '[unserializable object]';
        }
    }
    return val;
};
const logWithTimestamp = (file = 'unknown', message = 'No message', ...args) => {
    const enabled = loggingConfig[file] !== undefined ? loggingConfig[file] : loggingConfig.default;
    if (!enabled)
        return;
    const now = performance.now();
    const elapsed = (now - lastLogTime) / 1000;
    lastLogTime = now;
    const timestamp = new Date().toISOString();
    const style = colorForElapsed(elapsed);
    console.log(`%c[${timestamp}] [${elapsed.toFixed(3)}s] [${file}]`, style, safeFormat(message), ...args.map(safeFormat));
};
exports.logWithTimestamp = logWithTimestamp;
