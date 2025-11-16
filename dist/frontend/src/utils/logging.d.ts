/**
 * @file src/utils/logging.ts
 * @description
 * Provides logging utilities with performance metrics for the Gateway application.
 * - Tracks elapsed time between log statements using performance.now().
 * - Detects truecolor support for colored output based on the COLORTERM environment variable.
 * - Loads logging configuration from logging.config.ts with fallback to default settings if the config file fails.
 * - Colorizes log timestamps based on elapsed time (red > 1s, orange > 0.5s, yellow > 0.3s, default otherwise).
 * - Supports file-specific logging enablement/disablement via configuration.
 * - Updated to safely handle objects with JSON.stringify, falling back to util.inspect for circular references (v1.2.2).
 * Intended to help diagnose performance issues across the application.
 * @version 1.0.0
 * @author xAI (Grok 3)
 */
export declare const log: {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};
export declare const logWithTimestamp: (
  file?: string,
  message?: any,
  ...args: any[]
) => void;
