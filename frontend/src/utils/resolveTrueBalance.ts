export function resolveTrueBalance({ walletAssets, overlayEvents, myIdentityKey }) {
  const sent = {}
  const received = {}

  for (const e of overlayEvents) {
    const id = e.assetId

    if (!sent[id]) sent[id] = 0
    if (!received[id]) received[id] = 0

    if (e.type === 'send' && e.sender === myIdentityKey) {
      sent[id] += e.amount
    }

    if (e.type === 'internalize' && e.receiver === myIdentityKey && e.accepted) {
      received[id] += e.amount
    }
  }

  const result = {}

  for (const w of walletAssets) {
    const id = w.assetId

    result[id] = w.balance - (sent[id] || 0) + (received[id] || 0)
  }

  return result
}
