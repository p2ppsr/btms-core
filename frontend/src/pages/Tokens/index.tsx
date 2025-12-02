// frontend/src/pages/Tokens/index.tsx

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Grid,
  Typography,
  Button,
  TableContainer,
  Box,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Container
} from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import { toast } from 'react-toastify'
import useStyles from './tokens-style'
import Send from '../../components/Send'
import Receive from '../../components/Receive'
import { SatoshiValue, TXIDHexString, WalletCounterparty } from '@bsv/sdk'
import { Asset, btms } from '../../btms'
import { logWithTimestamp } from '../../utils/logging'

interface TokensProps {
  match: {
    params: {
      tokenID: string
    }
  }
}

interface TokenTransaction {
  date: string
  amount: SatoshiValue
  txid: TXIDHexString
  counterparty: WalletCounterparty
}

const TOKENS_DEBUG = true

const TOKENS_SOURCE_TAG = 'frontend/src/btms/index.ts@debug-hmr-39'

function tokensDebug(label: string, ...rest: any[]) {
  if (!TOKENS_DEBUG) return
  //if (label.startsWith('listAssets')) {
  logWithTimestamp(`[BTMS:${TOKENS_SOURCE_TAG}] ${label}`, ...rest)
  //}
}

const Tokens: React.FC<TokensProps> = ({ match }) => {
  const classes = useStyles()
  let tokenID = match.params.tokenID
  if (tokenID) {
    tokenID = tokenID.replace('_', '.')
  }

  const [walletTokens, setWalletTokens] = useState<Asset[]>([])
  const [token, setToken] = useState<Asset | null>(null)
  const [transactions, setTransactions] = useState<TokenTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    btms.onAssetsChanged(assets => setWalletTokens(assets))
  }, [])

  const refresh = async () => {
    const assets = await btms.listAssets()
    const found = assets!.find(x => x.assetId === tokenID)
    if (!found) {
      setError(true)
      setLoading(false)
      toast.error('Asset not found!')
      return
    }
    setToken(found)

    if (typeof btms.getTransactions === 'function') {
      const txResult = await btms.getTransactions(tokenID, 50, 0)
      setTransactions(txResult.transactions || [])
    } else {
      setTransactions([])
    }
  }

  useEffect(() => {
    ;(async () => {
      await refresh()
      setLoading(false)
    })()
  }, [tokenID])

  if (error) {
    return (
      <div>
        <Container>
          <Grid container>
            <Grid item className={classes.back_button}>
              <Button component={Link} to="/" color="secondary">
                <ArrowBackIosNewIcon className={classes.back_icon} /> My Tokens
              </Button>
            </Grid>
          </Grid>
          <Box>
            <br />
            <br />
            <Typography align="center">Asset not found.</Typography>
          </Box>
        </Container>
      </div>
    )
  }

  if (loading || !token) {
    return (
      <div>
        <Container>
          <Grid container>
            <Grid item className={classes.back_button}>
              <Button component={Link} to="/" color="secondary">
                <ArrowBackIosNewIcon className={classes.back_icon} /> My Tokens
              </Button>
            </Grid>
          </Grid>
          <Box>
            <br />
            <br />
            <LinearProgress color="secondary" />
          </Box>
        </Container>
      </div>
    )
  }

  // Safely pull “description” if it exists on this asset
  const tokenDescription = (token as any).description || 'Token details'

  return (
    <div>
      <Container>
        <Grid container>
          <Grid item className={classes.back_button}>
            <Button component={Link} to="/" color="secondary">
              <ArrowBackIosNewIcon className={classes.back_icon} /> My Tokens
            </Button>
          </Grid>
        </Grid>

        <Grid container direction="column" sx={{ paddingTop: '1.5em' }}>
          <Grid item>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {token.name || token.assetId}
            </Typography>
          </Grid>
          <Grid item>
            <Typography variant="body1" sx={{ paddingTop: '0.5em' }}>
              {tokenDescription}
            </Typography>
          </Grid>
        </Grid>

        <Grid container sx={{ paddingTop: '1.5em', gap: '0.5em' }}>
          <Grid item>
            <Send assetId={token.assetId} asset={token} onReloadNeeded={refresh} />
          </Grid>
          <Grid item>
            <Receive assetId={token.assetId} asset={token} onReloadNeeded={refresh} />
          </Grid>
        </Grid>

        <Grid container direction="column" sx={{ paddingTop: '2.5em' }}>
          <Grid item sx={{ paddingBottom: '1em' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Transactions
            </Typography>
          </Grid>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="left" sx={{ fontWeight: 'bold' }}>
                    Date
                  </TableCell>
                  <TableCell align="left" sx={{ fontWeight: 'bold' }}>
                    Transaction Amount
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Counterparty
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Transaction ID
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell align="left" style={{ width: '0.1em' }}>
                      {tx.date}
                    </TableCell>
                    <TableCell align="left">{tx.amount}</TableCell>
                    <TableCell align="right">{tx.counterparty}</TableCell>
                    <TableCell align="right">{tx.txid}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Container>
    </div>
  )
}

export default Tokens
