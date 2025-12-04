// React / UI (btms-ui)
import React, { useState, useMemo } from 'react'
import { Typography, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { toast } from 'react-toastify'
import useStyles from './send-style'

import { Asset, btms } from '../../btms/index'
import { SatoshiValue } from '@bsv/sdk'

type SendArgs = {
  assetId: string
  recipient: string
  amount: SatoshiValue
}

interface SendProps {
  assetId: string
  asset: Asset
  onReloadNeeded?: () => void
}

const Send: React.FC<SendProps> = ({ assetId, asset, onReloadNeeded = () => {} }) => {
  const classes = useStyles()

  const [recipient, setRecipient] = useState('')
  const [quantity, setQuantity] = useState('')

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // ----------------------------
  // Dynamic UI validation
  // ----------------------------

  const qty = Number(quantity)

  const quantityValid = quantity.trim() !== '' && Number.isFinite(qty) && qty > 0 && qty <= asset.balance

  const recipientValid = recipient.trim() !== '' && recipient.length >= 66

  // Disable send button when:
  //  1. balance is 0
  //  2. invalid quantity
  //  3. invalid recipient
  const canSend = asset.balance > 0 && quantityValid && recipientValid && !loading

  const handleSendCancel = () => {
    setRecipient('')
    setQuantity('')
    setOpen(false)
  }

  const handleSend = async () => {
    try {
      setLoading(true)

      // -----------------------------
      // RE-VALIDATE ON SUBMIT
      // (no bypass possible)
      // -----------------------------
      if (!recipientValid) {
        toast.error('Invalid recipient identity key!')
        return
      }

      if (!quantityValid) {
        toast.error('Invalid amount!')
        return
      }

      await btms.send(assetId, recipient, qty)

      try {
        onReloadNeeded()
      } catch {}

      toast.success(`You sent ${qty} ${asset.name}!`)
      setOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Something went wrong!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Disable main send button if balance = 0 */}
      <Button onClick={() => setOpen(true)} variant="outlined" color="secondary" disabled={asset.balance === 0}>
        Send
      </Button>

      <Dialog open={open} onClose={handleSendCancel} color="primary">
        <DialogTitle variant="h4" sx={{ fontWeight: 'bold' }}>
          Send {asset.name}
        </DialogTitle>

        <DialogContent>
          <Typography variant="h6">Recipient Identity Key:</Typography>
          <Typography variant="subtitle2">Get this from the person who will receive the token</Typography>

          <TextField
            className={classes.form}
            value={recipient}
            variant="outlined"
            fullWidth
            helperText="Required"
            onChange={e => setRecipient(e.target.value.replace(/[^0-9a-f]/gi, ''))}
            color="secondary"
          />

          <Typography variant="h6" className={classes.sub_title}>
            Quantity:
          </Typography>

          <TextField
            className={classes.form}
            value={quantity}
            variant="outlined"
            color="secondary"
            fullWidth
            helperText={asset.balance > 0 ? `Available: ${asset.balance}` : 'You have no tokens'}
            onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))}
          />
        </DialogContent>

        <DialogActions className={classes.button}>
          <Button disabled={loading} color="secondary" variant="outlined" onClick={handleSendCancel}>
            Cancel
          </Button>

          {/* ONLY ENABLE WHEN VALID */}
          <Button disabled={!canSend} color="secondary" variant="outlined" onClick={handleSend}>
            Send Now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default Send
