// backend/mod.ts
import BTMSTopicManager from './src/topic-managers/BTMSTopicManager.js'
import BTMSLookupServiceFactory from './src/lookup-services/BTMSLookupServiceFactory.js'

export const topicManagers = {
  tm_btms: BTMSTopicManager
}

export const lookupServices = {
  ls_btms: BTMSLookupServiceFactory
}
