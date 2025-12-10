export default `# BTMS Lookup Service

Indexes BTMS (Basic Token Management System) PushDrop tokens for efficient lookups.

## Supported Queries

### Find by Asset ID
\`\`\`json
{ "service": "ls_btms", "query": { "assetId": "MyToken" } }
\`\`\`

### Find by Outpoint
\`\`\`json
{ "service": "ls_btms", "query": { "outpoint": "txid.outputIndex" } }
\`\`\`

### Find All (use sparingly)
\`\`\`json
{ "service": "ls_btms", "query": { "findAll": true } }
\`\`\`

## Response Format
Returns an array of UTXO references:
\`\`\`json
[{ "txid": "...", "outputIndex": 0 }]
\`\`\``
