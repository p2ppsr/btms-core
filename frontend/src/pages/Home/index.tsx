import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Grid,
  Typography,
  Button,
  LinearProgress,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Container,
  Box
} from '@mui/material'
import { toast } from 'react-toastify'
import useStyles from './home-style'
import Receive from '../../components/Receive'
import Send from '../../components/Send'
import { Asset, btms } from '../../btms/index'
import { logWithTimestamp } from '../../utils/logging'

interface HomeProps {
  history: {
    push: (path: string) => void
  }
}

const HOME_DEBUG = true

const HOME_SOURCE_TAG = 'frontend/src/btms/index.ts@debug-hmr-39'

function homeDebug(label: string, ...rest: any[]) {
  if (!HOME_DEBUG) return
  //if (label.startsWith('listAssets')) {
  logWithTimestamp(`[BTMS:${HOME_SOURCE_TAG}] ${label}`, ...rest)
  //}
}

const INCOMING_REFRESH_MS = 30000

const Home: React.FC<HomeProps> = ({ history }) => {
  const classes = useStyles()
  const [walletTokens, setWalletTokens] = useState<Asset[]>([])
  const [tokensLoading, setTokensLoading] = useState(true)

  const [incomingByAsset, setIncomingByAsset] = useState<Record<string, number>>({})
  const [incomingAmountsByAsset, setIncomingAmountsByAsset] = useState<Record<string, number>>({})

  const lastIncomingFetchRef = useRef<number>(0)

  useEffect(() => {
    btms.onAssetsChanged(assets => setWalletTokens(assets))
  }, [])

  // ------------------------
  // Refresh wallet assets
  // ------------------------
  const refreshAssets = async () => {
    try {
      const assets = await btms.listAssets()
      homeDebug('refreshAssets got', assets)
      setWalletTokens(assets)
    } catch (err: any) {
      homeDebug('refreshAssets ERROR', err?.message)
      toast.error(err?.message || 'Error refreshing assets')
    }
  }

  // ------------------------
  // Refresh incoming
  // ------------------------
  const refreshIncoming = async (force = false) => {
    const now = Date.now()
    if (!force && now - lastIncomingFetchRef.current < INCOMING_REFRESH_MS) {
      return
    }

    try {
      const incoming = await btms.listIncomingPayments()
      if (!Array.isArray(incoming)) {
        lastIncomingFetchRef.current = now
        return
      }

      const countMap: Record<string, number> = {}
      const amountMap: Record<string, number> = {}

      for (const msg of incoming) {
        const assetId = (msg as any)?.assetId || (msg as any)?.token?.assetId || undefined

        if (!assetId) continue

        countMap[assetId] = (countMap[assetId] || 0) + 1

        const rawAmount = (msg as any).amount ?? (msg as any).token?.amount ?? (msg as any).token?.quantity ?? 0

        const numericAmount = Number(rawAmount) || 0
        amountMap[assetId] = (amountMap[assetId] || 0) + numericAmount
      }

      setIncomingByAsset(countMap)
      setIncomingAmountsByAsset(amountMap)
      lastIncomingFetchRef.current = now
    } catch (err: any) {
      homeDebug('refreshIncoming ERROR', err?.message)
      lastIncomingFetchRef.current = now
    }
  }

  // ------------------------
  // STARTUP — SINGLE LOAD
  // ------------------------
  useEffect(() => {
    ;(async () => {
      homeDebug('mount: loading')
      try {
        await refreshAssets()
        await refreshIncoming(true)
      } catch (err: any) {
        toast.error(err?.message || 'Something went wrong!')
      } finally {
        setTokensLoading(false)
      }
    })()
  }, [])

  // ------------------------
  // Merge wallet + incoming synthetic
  // ------------------------
  const mergedTokens: Asset[] = useMemo(() => {
    const byId: Record<string, Asset> = {}

    // Wallet assets
    for (const a of walletTokens) {
      const incomingCount = incomingByAsset[a.assetId] || 0
      const incomingAmount = incomingAmountsByAsset[a.assetId] || 0

      byId[a.assetId] = {
        ...a,
        incoming: incomingCount as any,
        ...(incomingAmount ? { incomingAmount: incomingAmount as any } : {})
      } as any
    }

    // Incoming-only
    for (const assetId of Object.keys(incomingByAsset)) {
      if (!byId[assetId]) {
        const incomingCount = incomingByAsset[assetId] || 0
        const incomingAmount = incomingAmountsByAsset[assetId] || 0

        byId[assetId] = {
          assetId,
          balance: 0 as any,
          name: assetId,
          metadata: '',
          incoming: incomingCount as any,
          ...(incomingAmount ? { incomingAmount: incomingAmount as any } : {})
        } as any
      }
    }

    const arr = Object.values(byId).sort((a, b) => {
      const aIncoming = incomingByAsset[a.assetId] ? 1 : 0
      const bIncoming = incomingByAsset[b.assetId] ? 1 : 0
      if (aIncoming !== bIncoming) return bIncoming - aIncoming
      return a.assetId.localeCompare(b.assetId)
    })

    return arr
  }, [walletTokens, incomingByAsset, incomingAmountsByAsset])

  // ------------------------
  // Render
  // ------------------------
  return (
    <div>
      <Container>
        <Grid container>
          <Grid item container direction="column" alignItems="center">
            <Grid item className={classes.title}>
              <Typography variant="h2" sx={{ fontWeight: 'bold' }}>
                BTMS
              </Typography>
            </Grid>
            <Grid item className={classes.sub_title}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Basic Tokenization Management System
              </Typography>
            </Grid>
          </Grid>

          <Grid item container alignItems="flex-start" className={classes.table_title} direction="column">
            <Grid item>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                My Tokens
              </Typography>
            </Grid>
            <Grid item alignSelf="flex-end">
              {mergedTokens.length >= 1 && (
                <Button component={Link} to="/mint" variant="outlined" color="secondary">
                  + New Token
                </Button>
              )}
            </Grid>
          </Grid>
        </Grid>

        <Grid container direction="column">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="left" sx={{ fontWeight: 'bold' }} colSpan={2}>
                    Token
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Balance
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Send
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Receive
                  </TableCell>
                </TableRow>
              </TableHead>

              {tokensLoading ? (
                <TableBody>
                  <TableRow />
                </TableBody>
              ) : (
                <TableBody>
                  {mergedTokens.map((token, i) => {
                    const incomingCountRaw = incomingByAsset[token.assetId] || (token as any).incoming || 0

                    const incomingAmountRaw =
                      incomingAmountsByAsset[token.assetId] || (token as any).incomingAmount || 0

                    const isSynthetic = !walletTokens.find(w => w.assetId === token.assetId)

                    const walletBalance = (token as any).balance ?? 0
                    const hasWalletBalance = walletBalance > 0

                    const displayBalance = hasWalletBalance ? walletBalance : incomingAmountRaw

                    const incomingBadge = hasWalletBalance ? 0 : incomingCountRaw
                    const incomingAmountForRow = hasWalletBalance ? 0 : incomingAmountRaw

                    const balanceNode = hasWalletBalance ? (
                      displayBalance
                    ) : (
                      <span style={{ opacity: 0.5 }}>{displayBalance}</span>
                    )

                    return (
                      <TableRow key={i} className={classes.link}>
                        <TableCell
                          align="left"
                          style={{ cursor: 'pointer' }}
                          onClick={() => history.push(`/tokens/${token.assetId.replace('.', '_')}`)}
                        >
                          {token.assetId}
                        </TableCell>

                        <TableCell
                          align="left"
                          style={{ cursor: 'pointer' }}
                          onClick={() => history.push(`/tokens/${token.assetId.replace('.', '_')}`)}
                        >
                          {token.name || token.assetId}
                        </TableCell>

                        <TableCell align="right">{balanceNode}</TableCell>

                        <TableCell align="right">
                          {isSynthetic ? (
                            <Button
                              variant="outlined"
                              size="small"
                              disabled
                              sx={{ opacity: 0.4, cursor: 'not-allowed' }}
                            >
                              Send
                            </Button>
                          ) : (
                            <Send
                              assetId={token.assetId}
                              asset={token}
                              onReloadNeeded={async () => {
                                await refreshAssets()
                                await refreshIncoming(true)
                              }}
                            />
                          )}
                        </TableCell>

                        <TableCell align="right">
                          <Receive
                            assetId={token.assetId}
                            asset={token}
                            badge={incomingBadge}
                            incomingAmount={incomingAmountForRow}
                            onReloadNeeded={async () => {
                              await refreshAssets()
                              await refreshIncoming(true)
                            }}
                            {...(isSynthetic ? { fromMessageBoxOnly: true } : {})}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Grid>

        <Grid container alignItems="center" direction="column" className={classes.no_tokens}>
          {tokensLoading ? (
            <Box>
              <br />
              <br />
              <Typography sx={{ paddingBottom: '2em' }}>Loading tokens...</Typography>
              <br />
              <br />
              <LinearProgress color="secondary" />
            </Box>
          ) : (
            <Grid item container alignItems="center" justifyContent="center">
              {mergedTokens.length === 0 && (
                <Grid item container direction="column" sx={{ width: '12em', paddingTop: '2em' }} rowSpacing={2}>
                  <Grid item sx={{ textAlign: 'center' }}>
                    <img src="/monkey.svg" style={{ width: '100%' }} />
                  </Grid>
                  <Grid item sx={{ textAlign: 'center' }}>
                    <Typography>No tokens yet.</Typography>
                  </Grid>
                  <Grid item sx={{ textAlign: 'center', paddingTop: '0.5em' }}>
                    <Button component={Link} to="/mint" variant="outlined" color="secondary">
                      + New Token
                    </Button>
                  </Grid>
                </Grid>
              )}
            </Grid>
          )}
        </Grid>
      </Container>
    </div>
  )
}

export default Home
