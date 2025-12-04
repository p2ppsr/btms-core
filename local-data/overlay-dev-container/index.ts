import OverlayExpress from '@bsv/overlay-express'
import tm_tm_btms from '/app/src/topic-managers/BTMSTopicManager.ts'
import lsf_ls_btms from '/app/src/lookup-services/BTMSLookupServiceFactory.ts'

const main = async () => {
  const adminToken = process.env.ADMIN_BEARER_TOKEN // may be undefined
  const server = new OverlayExpress(`LARS`, process.env.SERVER_PRIVATE_KEY!, process.env.HOSTING_URL!, adminToken)

  server.configurePort(8080)
  server.configureVerboseRequestLogging(process.env.REQUEST_LOGGING === 'true')
  server.configureNetwork(process.env.NETWORK === 'mainnet' ? 'main' : 'test')
  await server.configureKnex(process.env.KNEX_URL!)
  await server.configureMongo(process.env.MONGO_URL!)
  server.configureEnableGASPSync(process.env.GASP_SYNC === 'true')

  if (process.env.ARC_API_KEY) {
    server.configureArcApiKey(process.env.ARC_API_KEY)
  }

  // Apply advanced engine config from environment
  const logTime = process.env.LOG_TIME === 'true'
  const logPrefix = process.env.LOG_PREFIX || '[LARS OVERLAY ENGINE] '
  const throwOnBroadcastFailure = process.env.THROW_ON_BROADCAST_FAIL === 'true'
  let parsedSyncConfig = {}
  if (process.env.SYNC_CONFIG_JSON) {
    try {
      parsedSyncConfig = JSON.parse(process.env.SYNC_CONFIG_JSON)
    } catch (e) {
      console.error('Failed to parse SYNC_CONFIG_JSON:', e)
    }
  }

  server.configureEngineParams({
    logTime,
    logPrefix,
    throwOnBroadcastFailure,
    syncConfiguration: parsedSyncConfig
  })
  server.configureTopicManager('tm_btms', new tm_tm_btms())
  server.configureLookupServiceWithMongo('ls_btms', lsf_ls_btms)

  await server.configureEngine()
  await server.start()
}

main()
