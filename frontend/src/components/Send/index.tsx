// src/components/Send/index.tsx

// React / UI (btms-ui)
import React, { useState } from "react";
import {
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { toast } from "react-toastify";
import useStyles from "./send-style";

// app utils (btms-ui)
import BTMS, { sendBTMSToken } from "../../utils/BTMS";

// sdk / types
import type { Asset } from "../../btmsTypes";
import { SatoshiValue } from "@bsv/sdk";

// Local shape for the send args the core expects
type SendArgs = {
  assetId: string;
  recipient: string;
  amount: SatoshiValue;
};

interface SendProps {
  assetId: string;
  asset: Asset;
  onReloadNeeded?: () => void;
}

const Send: React.FC<SendProps> = ({
  assetId,
  asset,
  onReloadNeeded = () => {},
}) => {
  const classes = useStyles();
  const [recipient, setRecipient] = useState("");
  const [quantity, setQuantity] = useState("");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendCancel = () => {
    setQuantity("");
    setRecipient("");
    setOpen(false);
  };

  const handleSend = async () => {
    try {
      setLoading(true);
      const qty = Number(quantity);

      if (recipient.trim() === "") {
        toast.error("Enter recipient identity key!");
      } else if (recipient.length < 66) {
        toast.error(
          "The recipient identity key must be at least 66 characters long!",
        );
      } else if (quantity.trim() === "" || Number.isNaN(qty)) {
        toast.error("Enter a quantity of tokens to send!");
      } else if (qty > asset.balance) {
        toast.error("Oops! That is too many tokens!");
      } else {
        // Pass only the essentials; sendBTMSToken will delegate to BTMS.send,
        // which auto-selects an outpoint for this assetId and hydrates the BEEF.
        const args: SendArgs = {
          assetId,
          recipient,
          amount: qty,
        };

        await sendBTMSToken(args);

        try {
          onReloadNeeded();
        } catch (_) {}
        toast.success(`You sent ${qty} ${asset.name}!`);
        setOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outlined"
        color="secondary"
      >
        Send
      </Button>
      <Dialog open={open} onClose={handleSendCancel} color="primary">
        <DialogTitle variant="h4" sx={{ fontWeight: "bold" }}>
          Send {asset.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6">Recipient Identity Key:</Typography>
          <Typography variant="subtitle2">
            Get this from the person who will receive the token
          </Typography>
          <TextField
            className={classes.form}
            value={recipient}
            variant="outlined"
            color="secondary"
            fullWidth
            helperText="Required"
            onChange={(e) =>
              setRecipient(e.target.value.replace(/[^0-9a-f]/gi, ""))
            }
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
            helperText="Required"
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
          />
        </DialogContent>
        <DialogActions className={classes.button}>
          <Button
            disabled={loading}
            color="secondary"
            variant="outlined"
            onClick={handleSendCancel}
          >
            Cancel
          </Button>
          <Button
            disabled={loading}
            color="secondary"
            variant="outlined"
            onClick={handleSend}
          >
            Send Now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Send;
