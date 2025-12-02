// src/components/ReceiveDialog.tsx

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Tooltip
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

/**
 * Props for the ReceiveDialog.
 *
 * @property open        Whether the dialog is visible
 * @property onClose     Called when the user dismisses the dialog
 * @property identityKey The wallet / identity public key that the sender should use
 * @property tokenSymbol Optional token symbol shown in the title (e.g. "duck")
 */
export interface ReceiveDialogProps {
  open: boolean
  onClose: () => void
  identityKey: string | null
  tokenSymbol?: string
}

const ReceiveDialog: React.FC<ReceiveDialogProps> = ({ open, onClose, identityKey, tokenSymbol }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      // console.log(
      //   "[Receive] rendering, identityKey =",
      //   identityKey ?? "<none>",
      // );
      setCopied(false)
    }
  }, [open, identityKey])

  const handleCopy = async () => {
    if (!identityKey) return
    try {
      await navigator.clipboard.writeText(identityKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.warn('Failed to copy identityKey to clipboard', err)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Receive {tokenSymbol ? `“${tokenSymbol}”` : 'Tokens'}</DialogTitle>

      <DialogContent dividers>
        <Typography variant="body1" gutterBottom>
          Share this <strong>Receive identity key</strong> with the sender. They will paste it into their BTMS “Send”
          screen to send you tokens.
        </Typography>

        <Box
          mt={2}
          p={2}
          borderRadius={1}
          sx={{
            bgcolor: 'background.default',
            border: theme => `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Box
            sx={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              wordBreak: 'break-all'
            }}
          >
            {identityKey ?? 'No identity key available'}
          </Box>

          {identityKey && (
            <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Tip: This identity key is not a password. It can be safely shared with someone who wants to send you BTMS
            tokens.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReceiveDialog
