// Simple logging config so btms-core's logging.js stop yelling about ./logging.config
// If logging.js wants more fields, it can still read these safely.

// frontend/src/utils/logging.config.ts
export default {
  level: 'info',
  console: true
}

const loggingConfig = {
  // turn on console logging
  enabled: true,

  // common levels: 'debug' | 'info' | 'warn' | 'error'
  level: 'info',

  // optional prefix to make BTMS logs easy to spot
  prefix: '[BTMS]'
}

//export default loggingConfig;

// // Default logging state for all files
// const defaultLogging = false

// // Specific file logging overrides
// const loggingConfig: { [file: string]: boolean } = {
//   default: defaultLogging,
//   // --- BTMS / wallet debugging we care about right now ---
//   // our big minting/BTMS file
//   'btms/index': true,
//   // if some code logs with just "btms"
//   btms: true,
// }

// export default loggingConfig
