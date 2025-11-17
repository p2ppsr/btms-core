import React, { useEffect, useState, useCallback } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "react-toastify";
import btmsModule from "../../btmsClient";
import type { IncomingPayment } from "../../btmsTypes";
import { SatoshiValue } from "@bsv/sdk";

type ReceiveProps = {
  assetId?: string;
  asset?: { name?: string };
  badge?: number | boolean;
  incomingAmount?: SatoshiValue;
  onReloadNeeded?: () => Promise<void> | void;
  fromMessageBoxOnly?: boolean;
};

type BTMSClient = {
  listIncomingPayments: (
    assetId?: string,
  ) => Promise<IncomingPayment[] | unknown>;
  acceptIncomingPayment: (
    assetId: string,
    payment: IncomingPayment,
  ) => Promise<unknown>;
  refundIncomingTransaction: (
    assetId: string,
    payment: IncomingPayment,
  ) => Promise<unknown>;
};

const btms = btmsModule as Partial<BTMSClient>;

const Receive: React.FC<ReceiveProps> = ({
  assetId,
  asset,
  badge = false,
  incomingAmount,
  onReloadNeeded = () => {},
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // null = still loading
  const [identityKey, setIdentityKey] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingPayment[]>([]);

  // 1) get identity from the wallet the old way: window.walletClient.getPublicKey({ identityKey: true })
  //    our updated src/btmsClient.ts patches btms-core usage so the backend won't crash.
  useEffect(() => {
    let cancelled = false;

    const loadIdentityKey = async () => {
      try {
        if (typeof window === "undefined") {
          if (!cancelled) setIdentityKey("");
          return;
        }

        const win = window as typeof window & {
          walletClient?: {
            getPublicKey?: (args: {
              identityKey: true;
            }) => Promise<string | { publicKey?: string }>;
          };
        };
        const wallet = win.walletClient;

        if (!wallet || typeof wallet.getPublicKey !== "function") {
          console.log("[Receive] no walletClient on window, identity empty");
          if (!cancelled) setIdentityKey("");
          return;
        }

        // this mirrors the original “old world” receiver
        const raw = await wallet.getPublicKey({ identityKey: true });
        const key = typeof raw === "string" ? raw : raw?.publicKey || "";

        if (!cancelled) {
          setIdentityKey(key);
        }
      } catch (err) {
        console.error("[Receive] could not load identity key", err);
        if (!cancelled) {
          setIdentityKey("");
        }
      }
    };

    loadIdentityKey();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) incoming loader — now always call the real BTMS singleton
  const loadIncoming = useCallback(async (desiredAssetId?: string) => {
    if (!btms || typeof btms.listIncomingPayments !== "function") {
      toast.error("BTMS not available in frontend");
      return;
    }
    setLoading(true);
    try {
      const msgs = desiredAssetId
        ? await btms.listIncomingPayments(desiredAssetId)
        : await btms.listIncomingPayments();

      const clean: IncomingPayment[] = Array.isArray(msgs)
        ? (msgs as IncomingPayment[])
        : [];
      setIncoming(clean);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to load incoming payments";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = async () => {
    setOpen(true);
    await loadIncoming(assetId);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleCopy = () => {
    if (!identityKey) return;
    navigator.clipboard.writeText(identityKey).catch(() => {});
    toast.success("Identity key copied");
  };

  const handleRefresh = async () => {
    await loadIncoming(assetId);
    await Promise.resolve(onReloadNeeded());
  };

  const handleAccept = async (payment: IncomingPayment) => {
    if (!btms || typeof btms.acceptIncomingPayment !== "function") {
      toast.error("BTMS acceptIncomingPayment not available");
      return;
    }

    try {
      setLoading(true);
      await btms.acceptIncomingPayment(assetId || "", payment);
      // refresh lists + parent
      await loadIncoming(assetId);
      await Promise.resolve(onReloadNeeded());
      toast.success(
        `${payment.amount} ${asset?.name ?? "tokens"} successfully received (message acknowledged).`,
      );
      setOpen(false);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to accept payment";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (payment: IncomingPayment) => {
    if (!btms || typeof btms.refundIncomingTransaction !== "function") {
      toast.error("BTMS refundIncomingTransaction not available");
      return;
    }

    try {
      setLoading(true);
      await btms.refundIncomingTransaction(assetId || "", payment);
      await loadIncoming(assetId);
      await Promise.resolve(onReloadNeeded());
      toast.success(
        `You refunded ${payment.amount} ${asset?.name ?? "tokens"}.`,
      );
      setOpen(false);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to refund payment";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const currentCount = incoming.length;
  const badgeVisible =
    typeof badge === "number"
      ? badge > 0
      : typeof incomingAmount === "number"
        ? incomingAmount > 0
        : !!badge;

  console.log("[Receive] rendering, identityKey =", identityKey);

  const identityDisplay =
    identityKey === null
      ? "(loading...)"
      : identityKey === ""
        ? "(no identity from wallet)"
        : identityKey;

  return (
    <>
      <Badge color="error" variant={badgeVisible ? "dot" : "standard"}>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          onClick={handleOpen}
        >
          Receive
        </Button>
      </Badge>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="lg"
        aria-labelledby="receive-dialog-title"
      >
        <DialogTitle id="receive-dialog-title">
          Receive {asset?.name ?? "Asset"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container direction="column" spacing={2}>
            <Grid item>
              <Typography variant="subtitle1">Your Identity Key</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Give this to the person sending you the tokens.
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ wordBreak: "break-all", mr: 1 }}
                >
                  {identityDisplay}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  disabled={!identityKey}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Paper>
            </Grid>

            <Grid
              item
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography variant="subtitle1">
                Incoming / receivable payments for{" "}
                <strong>{asset?.name ?? assetId ?? "(unknown asset)"}</strong>
              </Typography>
              <Button
                variant="text"
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>

            <Grid item>
              <Typography variant="caption" color="text.secondary">
                {currentCount} message{currentCount === 1 ? "" : "s"} · total
                reported tokens:{" "}
                {incoming.reduce((sum, p) => sum + (p.amount || 0), 0)}
              </Typography>
            </Grid>

            <Grid item>
              {incoming.length === 0 ? (
                <Typography variant="body2">
                  No incoming payments for this asset.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>TXID</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {incoming.map((pmt) => (
                      <TableRow key={pmt.messageId}>
                        <TableCell>{pmt.sender || "(unknown)"}</TableCell>
                        <TableCell>
                          {pmt.amount} {asset?.name ?? ""}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 160 }}>
                          <Typography
                            variant="body2"
                            sx={{ wordBreak: "break-all" }}
                          >
                            {pmt.txid || "(no txid)"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            onClick={() => handleAccept(pmt)}
                            size="small"
                            disabled={loading}
                          >
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleRefund(pmt)}
                            size="small"
                            color="warning"
                            disabled={loading}
                          >
                            Refund
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Receive;
