/**
 * @file src/utils/logging.ts
 * @description
 * Browser-safe logging for BTMS frontend.
 * Removes all Node APIs (process, util, colors).
 * Works in Vite, React, Safari, Chrome, and mobile.
 */
export declare const log: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
};
export declare const logWithTimestamp: (file?: string, message?: any, ...args: any[]) => void;
