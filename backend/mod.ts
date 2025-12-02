// backend/mod.ts

import BTMSTopicManager from './src/topic-managers/BTMSTopicManager.js'
import BTMSLookupServiceFactory from './src/lookup-services/BTMSLookupServiceFactory.js'

// NEW — overlay history route
import createBtmsHistoryRouter from './src/routes/btmsHistory.js'

/**
 * Topic Managers exposed to the overlay engine
 */
export const topicManagers = {
  tm_btms: BTMSTopicManager
}

/**
 * Lookup services exposed to the overlay engine
 */
export const lookupServices = {
  ls_btms: BTMSLookupServiceFactory
}

/**
 * Router registration.
 *
 * The server (usually backend/src/server.ts) will call:
 *
 *   import { registerRoutes } from "./mod.ts"
 *   registerRoutes(app, db)
 *
 * This attaches:
 *   GET /overlay/ls_btms/history?identityKey=<hex>
 */
export function registerRoutes(app, db) {
  // 🔥 NEW: expose overlay history endpoint
  app.use(createBtmsHistoryRouter(db))
}
