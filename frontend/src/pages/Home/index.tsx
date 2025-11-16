import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
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
  Box,
} from "@mui/material";
import { toast } from "react-toastify";
import useStyles from "./home-style";
import Receive from "../../components/Receive";
import Send from "../../components/Send";
import BTMS, { btms as btmsSingleton } from "../../utils/BTMS";
//import { request } from '@bsv/sdk'
import type { Asset } from "../../btmsTypes";

interface HomeProps {
  history: {
    push: (path: string) => void;
  };
}

// bump tag so logs are easy to spot
const HOME_SOURCE_TAG = "src/pages/Home/index.tsx@jack-row-08+amounts";

const ASSET_POLL_MS = 5_000;
const INCOMING_REFRESH_MS = 30_000;

function homeDebug(label: string, payload?: any) {
  if (payload !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[HOME:${HOME_SOURCE_TAG}] ${label}`, payload);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[HOME:${HOME_SOURCE_TAG}] ${label}`);
  }
}

const Home: React.FC<HomeProps> = ({ history }) => {
  const classes = useStyles();
  const [walletTokens, setWalletTokens] = useState<Asset[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  // key = assetId, value = how many incoming messages had that assetId
  const [incomingByAsset, setIncomingByAsset] = useState<
    Record<string, number>
  >({});
  // key = assetId, value = total amount across those incoming messages
  const [incomingAmountsByAsset, setIncomingAmountsByAsset] = useState<
    Record<string, number>
  >({});
  const lastIncomingFetchRef = useRef<number>(0);

  const btms = btmsSingleton || (BTMS as any);

  const refreshAssets = async () => {
    try {
      const assets = await btms.listAssets();
      homeDebug("refreshAssets: got assets from wallet", {
        count: assets.length,
        assets,
      });
      setWalletTokens(assets);
    } catch (err: any) {
      homeDebug("refreshAssets: ERROR", { message: err?.message });
      throw err;
    }
  };

  const refreshIncoming = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastIncomingFetchRef.current < INCOMING_REFRESH_MS) {
      return;
    }

    try {
      const btmsAny = btms as any;
      const incoming = await btmsAny.listIncomingPayments();
      homeDebug("refreshIncoming: got from BTMS", {
        isArray: Array.isArray(incoming),
        len: Array.isArray(incoming) ? incoming.length : 0,
      });

      if (!Array.isArray(incoming)) {
        lastIncomingFetchRef.current = now;
        return;
      }

      const countMap: Record<string, number> = {};
      const amountMap: Record<string, number> = {};

      for (const msg of incoming) {
        // support both shapes we’ve seen
        const assetId = msg?.token?.assetId || (msg as any).assetId;
        if (!assetId) {
          homeDebug("refreshIncoming: item had no assetId", { msg });
          continue;
        }

        // count messages
        countMap[assetId] = (countMap[assetId] || 0) + 1;

        // try to pull a numeric amount out of the message
        const rawAmount =
          (msg as any).amount ??
          (msg as any).token?.amount ??
          (msg as any).token?.quantity ??
          0;
        const numericAmount = Number(rawAmount) || 0;
        amountMap[assetId] = (amountMap[assetId] || 0) + numericAmount;
      }

      homeDebug("refreshIncoming: computed incomingByAsset", countMap);
      homeDebug("refreshIncoming: computed incomingAmountsByAsset", amountMap);
      setIncomingByAsset(countMap);
      setIncomingAmountsByAsset(amountMap);
      lastIncomingFetchRef.current = now;
    } catch (err: any) {
      homeDebug("refreshIncoming: ERROR", { message: err?.message });
      lastIncomingFetchRef.current = now;
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    (async () => {
      homeDebug("effect: mount");

      // ask once (and be quiet if wallet doesn't support it)
      // try {
      //   const hasWindow = typeof window !== 'undefined'
      //   const alreadyAsked =
      //     hasWindow &&
      //     (window as any).localStorage.hasRequestedGroupPermission === 'true'

      //   if (!alreadyAsked && typeof requestGroupPermission === 'function') {
      //     homeDebug('requestGroupPermission: calling once')
      //     await requestGroupPermission()
      //     if (hasWindow) {
      //       ;(window as any).localStorage.hasRequestedGroupPermission = 'true'
      //     }
      //   }
      // } catch (err: any) {
      //   homeDebug('requestGroupPermission: ERROR (ignored)', {
      //     message: err?.message
      //   })
      //}

      try {
        await refreshAssets();
        await refreshIncoming(true);
      } catch (error: any) {
        console.error(error);
        toast.error(error?.message || "Something went wrong!");
      } finally {
        setTokensLoading(false);
      }

      interval = setInterval(() => {
        refreshAssets();
        refreshIncoming();
      }, ASSET_POLL_MS);
    })();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // merge wallet tokens + “synthetic” incoming-only tokens
  const mergedTokens: Asset[] = useMemo(() => {
    const byId: Record<string, Asset> = {};

    // start with wallet tokens
    for (const a of walletTokens) {
      const incomingCount =
        incomingByAsset[a.assetId] || (a as any).incoming || 0;
      byId[a.assetId] = {
        ...a,
        // store count on the object so the row can use it
        incoming: incomingCount as any,
      };
    }

    // add tokens that only exist because there was a message for them
    for (const assetId of Object.keys(incomingByAsset)) {
      if (!byId[assetId]) {
        const count = incomingByAsset[assetId] || 0;
        byId[assetId] = {
          assetId,
          balance: 0,
          name: assetId,
          metadata: "",
          incoming: count as any,
        } as any;
      }
    }

    const arr = Object.values(byId).sort((a, b) => {
      const aIncoming = incomingByAsset[a.assetId] ? 1 : 0;
      const bIncoming = incomingByAsset[b.assetId] ? 1 : 0;
      if (aIncoming !== bIncoming) return bIncoming - aIncoming;
      return a.assetId.localeCompare(b.assetId);
    });

    homeDebug("mergedTokens (wallet + incoming)", {
      count: arr.length,
      tokens: arr,
    });

    return arr;
  }, [walletTokens, incomingByAsset]);

  return (
    <div>
      <Container>
        <Grid container>
          <Grid item container direction="column" alignItems="center">
            <Grid item className={classes.title}>
              <Typography variant="h2" sx={{ fontWeight: "bold" }}>
                BTMS
              </Typography>
            </Grid>
            <Grid item className={classes.sub_title}>
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                Basic Tokenization Management System
              </Typography>
            </Grid>
          </Grid>
          <Grid
            item
            container
            alignItems="flex-start"
            className={classes.table_title}
            direction="column"
          >
            <Grid item>
              <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                My Tokens
              </Typography>
            </Grid>
            <Grid item alignSelf="flex-end">
              {mergedTokens.length >= 1 && (
                <Button
                  component={Link}
                  to="/mint"
                  variant="outlined"
                  color="secondary"
                >
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
                  <TableCell
                    align="left"
                    sx={{ fontWeight: "bold" }}
                    colSpan={2}
                  >
                    Token
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Balance
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Send
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
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
                    const incomingCount =
                      incomingByAsset[token.assetId] ||
                      (token as any).incoming ||
                      0;
                    const incomingAmount =
                      incomingAmountsByAsset[token.assetId] || 0;

                    const isSynthetic = !walletTokens.find(
                      (w) => w.assetId === token.assetId,
                    );

                    const walletBalance = token.balance ?? 0;
                    const balanceNode =
                      incomingCount > 0 ? (
                        <span>
                          {walletBalance}
                          <span
                            style={{
                              marginLeft: 8,
                              color: "#f50057",
                              fontSize: "0.8em",
                            }}
                          >
                            +{incomingCount} incoming
                          </span>
                        </span>
                      ) : (
                        walletBalance
                      );

                    return (
                      <TableRow key={i} className={classes.link}>
                        <TableCell
                          align="left"
                          style={{ width: "0.1em", cursor: "pointer" }}
                          onClick={() => {
                            history.push(
                              `/tokens/${token.assetId.replace(".", "_")}`,
                            );
                          }}
                        >
                          <img
                            src={(token as any).tokenIcon || "/favicon.svg"}
                            style={{ height: "2em" }}
                          />
                        </TableCell>
                        <TableCell
                          align="left"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            history.push(
                              `/tokens/${token.assetId.replace(".", "_")}`,
                            );
                          }}
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
                              sx={{ opacity: 0.4, cursor: "not-allowed" }}
                            >
                              Send
                            </Button>
                          ) : (
                            <Send
                              assetId={token.assetId}
                              asset={token}
                              onReloadNeeded={async () => {
                                await refreshAssets();
                                await refreshIncoming(true);
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Receive
                            assetId={token.assetId}
                            asset={token}
                            badge={incomingCount}
                            incomingAmount={incomingAmount}
                            onReloadNeeded={async () => {
                              await refreshAssets();
                              await refreshIncoming(true);
                            }}
                            {...(isSynthetic
                              ? { fromMessageBoxOnly: true }
                              : {})}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Grid>
        <Grid
          container
          alignItems="center"
          direction="column"
          className={classes.no_tokens}
        >
          {tokensLoading ? (
            <Box>
              <br />
              <br />
              <Typography sx={{ paddingBottom: "2em" }}>
                Loading tokens...
              </Typography>
              <br />
              <br />
              <LinearProgress color="secondary" />
            </Box>
          ) : (
            <Grid item container alignItems="center" justifyContent="center">
              {mergedTokens.length === 0 && (
                <Grid
                  item
                  container
                  direction="column"
                  sx={{ width: "12em", paddingTop: "2em" }}
                  rowSpacing={2}
                >
                  <Grid item sx={{ textAlign: "center" }}>
                    <img src="/monkey.svg" style={{ width: "100%" }} />
                  </Grid>
                  <Grid item sx={{ textAlign: "center" }}>
                    <Typography>No tokens yet.</Typography>
                  </Grid>
                  <Grid item sx={{ textAlign: "center", paddingTop: "0.5em" }}>
                    <Button
                      component={Link}
                      to="/mint"
                      variant="outlined"
                      color="secondary"
                    >
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
  );
};

export default Home;
