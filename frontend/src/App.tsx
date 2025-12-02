// frontend/src/App.tsx
import React, { useEffect, useRef } from 'react'
import { Switch, Route } from 'react-router-dom'

import Home from './pages/Home'
import Mint from './pages/Mint'
import Tokens from './pages/Tokens'
import ExchangePage from './components/ExchangePageOrg'
import { btms, walletClient } from './btms/index' // ✅ correct import

const App: React.FC = () => {
  const lastIdentityRef = useRef<string | null>(null)

  useEffect(() => {
    let timer: any

    async function checkIdentity() {
      try {
        const { publicKey } = await walletClient.getPublicKey({
          identityKey: true
        })

        // First load OR identity changed
        if (lastIdentityRef.current !== publicKey) {
          console.log(`IDENTITY CHANGE DETECTED`, {
            old: lastIdentityRef.current,
            new: publicKey
          })

          lastIdentityRef.current = publicKey

          // BTMS refreshes assets + fires onAssetsChanged
          await btms.switchIdentityToActiveProfile()
        }
      } catch (err) {
        console.warn('Identity poll failed:', err)
      }
    }

    // Run at startup
    checkIdentity()

    // Run every 5s
    timer = setInterval(checkIdentity, 5000)

    return () => clearInterval(timer)
  }, [])

  return (
    <Switch>
      <Route exact path="/" render={props => <Home {...props} />} />
      <Route exact path="/mint" render={props => <Mint {...props} />} />
      <Route exact path="/tokens" render={props => <Tokens {...(props as any)} />} />
      <Route path="/tokens/:assetId" render={props => <Tokens {...(props as any)} />} />
      <Route path="/exchange" render={props => <ExchangePage {...props} btms={btms} />} />
      <Route render={props => <Home {...props} />} />
    </Switch>
  )
}

export default App
