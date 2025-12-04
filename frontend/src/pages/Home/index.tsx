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
  logWithTimestamp(`[BTMS:${HOME_SOURCE_TAG}] ${label}`, ...rest)
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
        const assetId = (msg as any)?.assetId
        if (!assetId) continue

        countMap[assetId] = (countMap[assetId] || 0) + 1

        const rawAmount = (msg as any).amount ?? 0
        const numericAmount = Number(rawAmount) || 0
        amountMap[assetId] = (amountMap[assetId] || 0) + numericAmount
      }

      homeDebug('refreshIncoming: maps built', { countMap, amountMap })

      setIncomingByAsset(countMap)
      setIncomingAmountsByAsset(amountMap)
      lastIncomingFetchRef.current = now
    } catch (err: any) {
      homeDebug('refreshIncoming ERROR', err?.message)
      lastIncomingFetchRef.current = now
    }
  }

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

  // --------------------------------------------------------------
  // MERGE wallet tokens + incoming messages (STRICT, NO STALE DATA)
  // --------------------------------------------------------------
  // --------------------------------------------------------------
  // MERGE wallet tokens + incoming messages (STRICT, CORRECT TYPES)
  // --------------------------------------------------------------
  const mergedTokens: Asset[] = useMemo(() => {
    const byId: Record<string, Asset> = {}

    // ----------------------------------------------------------
    // 1. Normal wallet tokens (always present)
    // ----------------------------------------------------------
    for (const w of walletTokens) {
      const incomingCount = incomingByAsset[w.assetId] ?? 0
      const incomingAmount = incomingAmountsByAsset[w.assetId] ?? 0

      const hasPendingIncoming: boolean = incomingCount > 0
      const incoming: boolean = hasPendingIncoming

      byId[w.assetId] = {
        ...w,
        hasPendingIncoming,
        incoming, // BOOLEAN (TS FIXED)
        incomingAmount // NUMBER (safe)
      }
    }

    // ----------------------------------------------------------
    // 2. Incoming for tokens NOT already in walletTokens
    // ----------------------------------------------------------
    for (const assetId of Object.keys(incomingByAsset)) {
      if (!byId[assetId]) {
        const incomingCount = incomingByAsset[assetId] ?? 0
        const incomingAmount = incomingAmountsByAsset[assetId] ?? 0

        if (incomingCount <= 0) continue

        const hasPendingIncoming: boolean = true
        const incoming: boolean = true

        byId[assetId] = {
          assetId,
          name: assetId,
          balance: 0,
          metadata: '',
          hasPendingIncoming,
          incoming, // BOOLEAN
          incomingAmount // NUMBER
        }
      }
    }

    // ----------------------------------------------------------
    // 3. Final sorting: tokens WITH real incoming first
    // ----------------------------------------------------------
    const arr = Object.values(byId).sort((a, b) => {
      const aInc = a.incoming ? 1 : 0
      const bInc = b.incoming ? 1 : 0
      if (aInc !== bInc) return bInc - aInc
      return a.assetId.localeCompare(b.assetId)
    })

    homeDebug('mergedTokens (TYPES FIXED)', { merged: arr })
    return arr
  }, [walletTokens, incomingByAsset, incomingAmountsByAsset])

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
                    const incomingCount = incomingByAsset[token.assetId] || 0
                    const incomingAmount = incomingAmountsByAsset[token.assetId] || 0

                    const walletEntry = walletTokens.find(w => w.assetId === token.assetId)
                    const hasWalletBalance = !!walletEntry
                    const walletBalance = walletEntry ? walletEntry.balance : 0

                    const incomingOnly = !hasWalletBalance && incomingCount > 0
                    const hasPendingIncoming = !!token.hasPendingIncoming || incomingCount > 0

                    const displayBalance = walletBalance
                    const incomingBadge = hasPendingIncoming ? incomingCount : 0
                    const incomingAmountForRow = hasPendingIncoming ? incomingAmount : 0

                    const balanceNode = hasWalletBalance ? (
                      displayBalance
                    ) : (
                      <span style={{ opacity: 0.5 }}>{displayBalance}</span>
                    )

                    homeDebug('rowState', {
                      assetId: token.assetId,
                      hasWalletBalance,
                      walletBalance,
                      incomingCount,
                      incomingAmount,
                      tokenHasPendingIncoming: token.hasPendingIncoming,
                      hasPendingIncoming,
                      incomingOnly
                    })

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
                          {hasWalletBalance ? (
                            <Send
                              assetId={token.assetId}
                              asset={token}
                              onReloadNeeded={async () => {
                                await refreshAssets()
                                await refreshIncoming(true)
                              }}
                            />
                          ) : (
                            <Button
                              variant="outlined"
                              size="small"
                              disabled
                              sx={{ opacity: 0.4, cursor: 'not-allowed' }}
                            >
                              Send
                            </Button>
                          )}
                        </TableCell>

                        {/* RECEIVE COLUMN — FIXED */}
                        {/* RECEIVE COLUMN – correct disabled style */}
                        <TableCell align="right">
                          {hasPendingIncoming ? (
                            <Receive
                              assetId={token.assetId}
                              asset={token}
                              badge={incomingBadge}
                              incomingAmount={incomingAmountForRow}
                              onReloadNeeded={async () => {
                                await refreshAssets()
                                await refreshIncoming(true)
                              }}
                              {...(incomingOnly ? { fromMessageBoxOnly: true } : {})}
                            />
                          ) : (
                            <Button
                              variant="outlined"
                              size="small"
                              disabled
                              sx={{ opacity: 0.4, cursor: 'not-allowed' }}
                            >
                              Receive
                            </Button>
                          )}
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
