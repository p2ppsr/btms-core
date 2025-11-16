// frontend/src/pages/Mint/index.tsx
import React, { useState, useRef } from "react";
import {
  Container,
  Typography,
  Grid,
  Button,
  TextField,
  Paper,
  IconButton,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import useStyles from "./mint-style";

// use the shared btms instance that already has setBTMSWallet wired up
import { btms } from "../../btmsClient";

interface MintProps {
  history: {
    push: (path: string) => void;
  };
}

const Mint: React.FC<MintProps> = ({ history }) => {
  const classes = useStyles();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const urlReader = new FileReader();
      urlReader.onload = () => {
        setPhotoURL(urlReader.result as string);
      };
      urlReader.readAsDataURL(file);
    }
  };

  const mint = async () => {
    const traceId = `mint_${Date.now()}`;
    setLoading(true);
    try {
      console.log(`[${traceId}] Mint button clicked with`, {
        name,
        quantity,
        descriptionLen: description.length,
        hasImage: !!photoURL,
      });

      if (name.trim() === "") {
        toast.error("Enter a name for the token!");
        console.warn(`[${traceId}] Aborting: name missing`);
        return;
      }
      if (quantity.trim() === "" || Number.isNaN(Number(quantity))) {
        toast.error("Enter a quantity for the max number of tokens!");
        console.warn(`[${traceId}] Aborting: quantity missing or NaN`, {
          quantity,
        });
        return;
      }
      if (description.trim() === "") {
        toast.error("Enter a description for the token!");
        console.warn(`[${traceId}] Aborting: description missing`);
        return;
      }

      const amount = Number(quantity);
      console.log(`[${traceId}] Calling btms.issue(...)`, {
        amount,
        name,
        descriptionPreview: description.slice(0, 64),
        hasImage: !!photoURL,
      });

      const res = await (btms as any).issue(amount, name, {
        description,
        image: photoURL ?? undefined,
      });

      console.log(`[${traceId}] btms.issue(...) returned`, res);

      toast.success(`You minted ${quantity} ${name}!`);
      history.push("/");
    } catch (err: any) {
      console.error("[mint] error during mint", err);
      toast.error(err?.message || "Something went wrong while minting.");
    } finally {
      console.log(`[${traceId}] Mint flow done (success or fail)`);
      setLoading(false);
    }
  };

  return (
    <div>
      <Container
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
        }}
      >
        <Grid container>
          <Grid item className={classes.button}>
            <Button component={Link} to="/" color="secondary">
              <ArrowBackIosNewIcon className={classes.back_icon} /> My Tokens
            </Button>
          </Grid>
        </Grid>

        <Grid
          container
          sx={{
            display: "grid",
            gridColumn: "2",
          }}
        >
          <Grid container>
            <Grid item className={classes.title}>
              <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                Mint a Token
              </Typography>
            </Grid>

            <Grid
              item
              container
              direction="column"
              className={classes.sub_title}
            >
              {/* Token name */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    Token Name
                  </Typography>
                </Grid>
                <Grid item>
                  <TextField
                    placeholder="Give your token an original name"
                    variant="standard"
                    color="secondary"
                    multiline
                    fullWidth
                    helperText="Required"
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
              </Grid>

              {/* Image */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    Image
                  </Typography>
                </Grid>
                <Grid item container>
                  <Paper elevation={8} className={classes.photo_container}>
                    {photoURL ? (
                      <Grid item className={classes.photo_preview}>
                        <img
                          src={photoURL}
                          className={classes.photo_preview_img}
                          alt="preview"
                        />
                      </Grid>
                    ) : (
                      <Grid item>
                        <IconButton
                          color="secondary"
                          onClick={handlePhotoClick}
                        >
                          <AddAPhotoIcon />
                          <input
                            type="file"
                            accept=".png, .svg, .jpeg, .jpg"
                            style={{ display: "none" }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                          />
                        </IconButton>
                      </Grid>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              {/* Quantity */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    Number of Tokens
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2">
                    This is your token&apos;s max supply.
                  </Typography>
                </Grid>
                <Grid item>
                  <TextField
                    placeholder="Quantity"
                    value={quantity}
                    variant="standard"
                    color="secondary"
                    fullWidth
                    helperText="Required"
                    onChange={(e) =>
                      setQuantity(e.target.value.replace(/\D/g, ""))
                    }
                  />
                </Grid>
              </Grid>

              {/* Description */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    Token Description
                  </Typography>
                </Grid>
                <Grid item>
                  <TextField
                    placeholder="Give your token a fitting description"
                    multiline
                    variant="standard"
                    color="secondary"
                    fullWidth
                    helperText="Required"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {/* Preview box */}
          <Grid container direction="column" className={classes.form}>
            <Grid item>
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                Preview
              </Typography>
            </Grid>
            <Grid item>
              <Paper elevation={8}>
                <Grid
                  container
                  direction="column"
                  sx={{ padding: "2.5em" }}
                  rowGap="0.5em"
                >
                  <Grid item>
                    <Typography sx={{ wordBreak: "break-word" }}>
                      Token Name: {name}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Typography sx={{ wordBreak: "break-word" }}>
                      Token Description: {description}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Typography>Max Supply: {quantity}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          {/* Create button */}
          <Grid container direction="column" className={classes.form}>
            <Grid item sx={{ textAlign: "right" }} className={classes.button}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={mint}
                disabled={loading}
              >
                Create
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
};

export default Mint;
