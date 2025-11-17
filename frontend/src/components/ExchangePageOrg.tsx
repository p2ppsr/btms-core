import React, { useEffect, useState } from "react";
import { TextField, Grid, LinearProgress, Typography } from "@mui/material";
import { ToastContainer } from "react-toastify";
import { BTMS } from "../btms"; // btms instance is still used here
import type { Asset } from "../btms";
import web3Theme from "../theme";
import { ThemeProvider } from "@mui/material/styles";
import AssetsTable from "./AssetsTable";
import MarketplaceButton from "./MarketplaceButton";
import { OFFERED_TEXT, ACCEPTED_TEXT } from "../utils/constants";
import {
  getAsset,
  updateAssetWithRemainderBalance,
  updateAssetWithAmountBalance,
  removeAssetWithAmount,
  updateStringRecord,
  updateNumberRecord,
  updateAssetWithOriginalBalance,
} from "../utils/general";
import SearchBar from "./SearchBar";
import InputAmount from "./InputAmount";
import AssetBalance from "./AssetBalance";

interface ExhangePageProps {
  btms: BTMS;
}

let dbg = false;
const INPUT_AMOUNT_BUTTON_TEXT = "set asset amount";
const REMAINDER_TEXT = "remainder";
const AVAILABLE_TEXT = "available";

const ExchangePage: React.FC<ExhangePageProps> = ({ btms }) => {
  const [loading, setLoading] = useState<boolean>(false);

  const [showProgressOffer, setShowProgressOffer] = useState<boolean>(false);
  const [assetsOffered, setAssetsOffered] = useState<Asset[]>([]);
  const [assetsWithAmountsOffered, setAssetsWithAmountsOffered] = useState<
    Asset[]
  >([]);
  const [selectedAssetIdOffer, setSelectedAssetIdOffer] = useState<string>("");
  const [amountOffer, setAmountOffer] = useState<number>(0);
  const [addAssetDisabledOffer, setAddAssetDisabledOffer] =
    useState<boolean>(true);
  const [balanceTextToNameMapOffered, setBalanceTextToNameMapOffered] =
    useState<{ [key: string]: string }>({});
  const [
    balanceTextToWithAmountNameMapOffered,
    setBalanceTextToWithAmountNameMapOffered,
  ] = useState<{ [key: string]: string }>({});
  const [resetInputAmountOffer, setResetInputAmountOffer] =
    useState<boolean>(false);
  const [assetTableOffered, setAssetTableOffered] = useState<boolean>(true);
  const [assetListUpdatedOffered, setAssetListUpdatedOffered] =
    useState<boolean>(false);
  const [doAssetBalanceOffered, setDoAssetBalanceOffered] =
    useState<boolean>(false);
  const [isOffer, setIsOffer] = useState<boolean>(true);
  const [availableOffered, setAvailableOffered] = useState<{
    [key: string]: number;
  }>({});
  const [remainderOffered, setRemainderOffered] = useState<{
    [key: string]: number;
  }>({});
  const [removeAssetBalanceOffered, setRemoveAssetBalanceOffered] =
    useState<boolean>(false);
  const [searchBarFocusedOffer, setSearchBarFocusedOffer] =
    useState<boolean>(false);
  const [inputAmountFocusedOffer, setInputAmountFocusedOffer] =
    useState<boolean>(false);
  const [assetTableFocusedOffer, setAssetTableFocusedOffer] =
    useState<boolean>(false);

  const [showProgressAccept, setShowProgressAccept] = useState<boolean>(false);
  const [assetsAccepted, setAssetsAccepted] = useState<Asset[]>([]);
  const [assetsWithAmountsAccepted, setAssetsWithAmountsAccepted] = useState<
    Asset[]
  >([]);
  const [amountAccept, setAmountAccept] = useState<number>(0);
  const [selectedAssetIdAccept, setSelectedAssetIdAccept] =
    useState<string>("");
  const [addAssetDisabledAccept, setAddAssetDisabledAccept] =
    useState<boolean>(true);
  const [balanceTextToNameMapAccepted, setBalanceTextToNameMapAccepted] =
    useState<{ [key: string]: string }>({});
  const [resetInputAmountAccept, setResetInputAmountAccept] =
    useState<boolean>(false);
  const [
    balanceTextToWithAmountNameMapAccepted,
    setBalanceTextToWithAmountNameMapAccepted,
  ] = useState<{ [key: string]: string }>({});
  const [assetTableAccepted, setAssetTableAccepted] = useState<boolean>(true);
  const [assetListUpdatedAccepted, setAssetListUpdatedAccepted] =
    useState<boolean>(false);
  const [doAssetBalanceAccepted, setDoAssetBalanceAccepted] =
    useState<boolean>(false);
  const [isAccept, setIsAccept] = useState<boolean>(false);
  const [availableAccepted, setAvailableAccepted] = useState<{
    [key: string]: number;
  }>({});
  const [remainderAccepted, setRemainderAccepted] = useState<{
    [key: string]: number;
  }>({});
  const [removeAssetBalanceAccepted, setRemoveAssetBalanceAccepted] =
    useState<boolean>(false);
  const [searchBarFocusedAccept, setSearchBarFocusedAccept] =
    useState<boolean>(false);
  const [inputAmountFocusedAccept, setInputAmountFocusedAccept] =
    useState<boolean>(false);
  const [assetTableFocusedAccept, setAssetTableFocusedAccept] =
    useState<boolean>(false);

  const fetchAssetsOffered = async () => {
    try {
      setLoading(true);
      setOffer();
      setShowProgressOffer(true);
      const fetchedAssetsOffer = await btms.listAssets();
      setShowProgressOffer(false);

      const updatedBalanceTextToNameMapOffered = {
        ...balanceTextToNameMapOffered,
      };
      fetchedAssetsOffer.forEach((asset) => {
        if (!updatedBalanceTextToNameMapOffered[asset.assetId]) {
          updatedBalanceTextToNameMapOffered[asset.assetId] = AVAILABLE_TEXT;
        }
      });
      setBalanceTextToNameMapOffered(updatedBalanceTextToNameMapOffered);

      const updatedBalanceTextToWithAmountNameMapOffered = {
        ...balanceTextToWithAmountNameMapOffered,
      };
      fetchedAssetsOffer.forEach((asset) => {
        if (!updatedBalanceTextToWithAmountNameMapOffered[asset.assetId]) {
          updatedBalanceTextToWithAmountNameMapOffered[asset.assetId] =
            OFFERED_TEXT;
        }
      });
      setBalanceTextToWithAmountNameMapOffered(
        updatedBalanceTextToWithAmountNameMapOffered,
      );
      setAssetsOffered(fetchedAssetsOffer);
      setDoAssetBalanceOffered(true);
    } catch (error) {
      console.error("Error fetching offer assets:", error);
      setLoading(false);
    }
  };

  const fetchAssetsAccepted = async () => {
    try {
      setAccept();
      setShowProgressAccept(true);
      const fetchedAssetsAccepted = await btms.listAssets();
      setShowProgressAccept(false);
      const updatedBalanceTextToNameMapAccepted = {
        ...balanceTextToNameMapAccepted,
      };
      fetchedAssetsAccepted.forEach((asset) => {
        if (!updatedBalanceTextToNameMapAccepted[asset.assetId]) {
          updatedBalanceTextToNameMapAccepted[asset.assetId] = AVAILABLE_TEXT;
        }
      });
      setBalanceTextToNameMapAccepted(updatedBalanceTextToNameMapAccepted);

      const updatedBalanceTextToWithAmountNameMapAccepted = {
        ...balanceTextToWithAmountNameMapAccepted,
      };
      fetchedAssetsAccepted.forEach((asset) => {
        if (!updatedBalanceTextToWithAmountNameMapAccepted[asset.assetId]) {
          updatedBalanceTextToWithAmountNameMapAccepted[asset.assetId] =
            OFFERED_TEXT;
        }
      });
      setBalanceTextToWithAmountNameMapAccepted(
        updatedBalanceTextToWithAmountNameMapAccepted,
      );
      setAssetsAccepted(fetchedAssetsAccepted);
      setDoAssetBalanceAccepted(true);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching assets:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    dbg = true;
    dbg && console.log("useEffect(): btms");
    setAssetTableOffered(true);
    fetchAssetsOffered();
    setAssetListUpdatedOffered(true);
    setAssetTableAccepted(true);
    fetchAssetsAccepted();
    setAssetListUpdatedAccepted(true);
    dbg = false;
    return () => {};
  }, [btms]);

  useEffect(() => {
    dbg = true;
    dbg && console.log("useEffect(): []");
    setAssetListUpdatedOffered(true);
    setAssetListUpdatedAccepted(true);
    dbg = false;
  }, []);

  useEffect(() => {
    console.log("availableOffered=", availableOffered);
    console.log("remainderOffered=", remainderOffered);
    assetsOffered.forEach((asset) => {
      updateNumberRecord(asset.assetId, asset.balance, setAvailableOffered);
    });
    assetsAccepted.forEach((asset) => {
      updateNumberRecord(asset.assetId, asset.balance, setAvailableAccepted);
    });
    console.log("availableOffered=", availableOffered);

    if (doAssetBalanceOffered || doAssetBalanceAccepted) {
      // placeholder for any future side-effects
    }
    dbg && console.log("isOffer=", isOffer, ",isAccept=", isAccept);
    isOffer === isAccept &&
      console.error("Can only have isOffer true or isAccept true");
  }, [doAssetBalanceOffered, doAssetBalanceAccepted]);

  const handleAmountClearClickOffer = () => {
    dbg && console.log("handleAmountClearClickOffer()");
    setAddAssetDisabledOffer(true);
  };

  const handleAmountClearClickAccept = () => {
    dbg && console.log("handleAmountClearClickAccept()");
    setAddAssetDisabledAccept(true);
  };

  const handleSearchBarOffered = async (text: string) => {
    try {
      console.log("handleSearchBarOffered()");
      setShowProgressOffer(true);
      let fetchedAssetsOffered = await btms.listAssets();
      setShowProgressOffer(false);

      if (text !== "*") {
        fetchedAssetsOffered = fetchedAssetsOffered.filter((asset) =>
          asset.name?.toLowerCase().includes(text.toLowerCase()),
        );
      }
      const updatedBalanceTextToNameMapOffered = {
        ...balanceTextToNameMapOffered,
      };
      fetchedAssetsOffered.forEach((asset) => {
        if (!updatedBalanceTextToNameMapOffered[asset.assetId]) {
          updatedBalanceTextToNameMapOffered[asset.assetId] = AVAILABLE_TEXT;
        }
      });
      setBalanceTextToNameMapOffered(updatedBalanceTextToNameMapOffered);

      const updatedBalanceTextToWithAmountNameMapOffered = {
        ...balanceTextToWithAmountNameMapOffered,
      };
      fetchedAssetsOffered.forEach((asset) => {
        if (!updatedBalanceTextToWithAmountNameMapOffered[asset.assetId]) {
          updatedBalanceTextToWithAmountNameMapOffered[asset.assetId] =
            OFFERED_TEXT;
        }
      });
      setBalanceTextToWithAmountNameMapOffered(
        updatedBalanceTextToWithAmountNameMapOffered,
      );
      setAssetsOffered(fetchedAssetsOffered);
      assetsOffered.forEach((asset) => {
        updateNumberRecord(asset.assetId, asset.balance, setAvailableOffered);
      });
      console.log("availableOffered=", availableOffered);
      console.log("remainderOffered=", remainderOffered);
    } catch (error) {
      console.error("Error fetching offer assets:", error);
    }
  };

  const handleSearchBarAccepted = async (text: string) => {
    dbg && console.log("handleSearchBar():isAccept=", isAccept);
    try {
      setAccept();
      setShowProgressAccept(true);
      let fetchedAssetsAccepted = await btms.listAssets();
      setShowProgressAccept(false);
      if (text !== "*") {
        fetchedAssetsAccepted = fetchedAssetsAccepted.filter((asset) =>
          asset.name?.toLowerCase().includes(text.toLowerCase()),
        );
      }
      const updatedBalanceTextToNameMapAccepted = {
        ...balanceTextToNameMapAccepted,
      };
      fetchedAssetsAccepted.forEach((asset) => {
        if (!updatedBalanceTextToNameMapAccepted[asset.assetId]) {
          updatedBalanceTextToNameMapAccepted[asset.assetId] = AVAILABLE_TEXT;
        }
      });
      setBalanceTextToNameMapAccepted(updatedBalanceTextToNameMapAccepted);

      const updatedBalanceTextToWithAmountNameMapAccepted = {
        ...balanceTextToWithAmountNameMapAccepted,
      };
      fetchedAssetsAccepted.forEach((asset) => {
        if (!updatedBalanceTextToWithAmountNameMapAccepted[asset.assetId]) {
          updatedBalanceTextToWithAmountNameMapAccepted[asset.assetId] =
            ACCEPTED_TEXT;
        }
      });
      setBalanceTextToWithAmountNameMapAccepted(
        updatedBalanceTextToWithAmountNameMapAccepted,
      );
      setAssetsAccepted(fetchedAssetsAccepted);
    } catch (error) {
      console.error("Error fetching accept assets:", error);
    }
  };

  const handleClearSearchBarOffer = () => {
    dbg && console.log("ExchangePage:handleClearSearchBarOffer()");
    setAssetsOffered([]);
  };

  const handleClearSearchBarAccept = () => {
    dbg && console.log("ExchangePage:handleClearSearchBarAccept()");
    setAssetsAccepted([]);
  };

  const removeAssetWithAmountOffer = (assetId: string) => {
    setRemoveAssetBalanceOffered(true);
    setDoAssetBalanceOffered(true);
    removeAssetWithAmount(
      assetsWithAmountsOffered,
      assetId,
      setAssetsWithAmountsOffered,
    );
    updateAssetWithOriginalBalance(
      assetsOffered,
      assetId,
      Number(availableOffered[assetId]),
      setAssetsOffered,
    );
    updateStringRecord(
      selectedAssetIdOffer,
      AVAILABLE_TEXT,
      setBalanceTextToNameMapOffered,
    );
    dbg &&
      console.log(
        "removeAssetWithAmount():assetsWithAmounts=",
        assetsWithAmountsOffered,
      );
  };

  const removeAssetWithAmountAccept = (assetId: string) => {
    setRemoveAssetBalanceAccepted(true);
    setDoAssetBalanceAccepted(true);
    removeAssetWithAmount(
      assetsWithAmountsAccepted,
      assetId,
      setAssetsWithAmountsAccepted,
    );
    updateAssetWithOriginalBalance(
      assetsAccepted,
      assetId,
      Number(availableAccepted[assetId]),
      setAssetsAccepted,
    );
    updateStringRecord(
      selectedAssetIdAccept,
      AVAILABLE_TEXT,
      setBalanceTextToNameMapAccepted,
    );
    dbg &&
      console.log(
        "removeAssetWithAmount():assetsWithAmountsAccepted=",
        assetsWithAmountsAccepted,
      );
  };

  const handleSelectedAssetOffer = (
    assetId: string,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "handleSelectedAssetOffer():assetId=",
        assetId,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setOffer();
    setSelectedAssetIdOffer(assetId);
    setAddAssetDisabledOffer(true);
  };

  const handleSelectedAssetAccept = (
    assetId: string,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "handleSelectedAssetAccept():assetId=",
        assetId,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setAccept();
    setSelectedAssetIdAccept(assetId);
    setAddAssetDisabledAccept(true);
  };

  const unsetResetInputAmountOffered = () => {
    dbg && console.log("unsetResetInputAmountOffered()");
    setResetInputAmountOffer(false);
  };

  const unsetResetInputAmountAccepted = () => {
    dbg && console.log("unsetResetInputAmountAccepted()");
    setResetInputAmountAccept(false);
  };

  const handleAssetTableFocusedOffered = (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "ExchangePage:handleAssetTableFocusedOffered():focused=",
        focused,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setOffer();
    setAssetTableFocusedOffer(true);
    setAssetTableFocusedAccept(false);
  };

  const handleAssetTableFocusedAccepted = (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "ExchangePage:handleAssetTableFocusedAccepted():focused=",
        focused,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setAccept();
    setAssetTableFocusedAccept(true);
    setAssetTableFocusedOffer(false);
  };

  const handleInputAmountFocusedOffered = (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "handleInputAmountFocusedOffered():focused=",
        focused,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setInputAmountFocusedOffer(focused);
    setInputAmountFocusedAccept(false);
  };

  const handleInputAmountFocusedAccepted = (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "handleInputAmountFocusedAccepted():focused=",
        focused,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setInputAmountFocusedAccept(focused);
    setInputAmountFocusedOffer(false);
  };

  const updateRemainderOffered = (remainder: number) => {
    dbg && console.log("updateRemainderOffered():", remainder);
    updateAssetWithRemainderBalance(
      true,
      assetsOffered,
      selectedAssetIdOffer,
      remainder,
      setAssetsOffered,
    );
    setDoAssetBalanceOffered(false);
    setAmountOffer(0);
  };

  const handleSearchBarFocusedOffered = (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "ExchangePage:handleSearchBarFocusedOffered():focused=",
        focused,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setSearchBarFocusedOffer(true);
  };

  const handleSearchBarFocusedAccepted = (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => {
    dbg &&
      console.log(
        "ExchangePage:handleSearchBarFocusedAccepted():focused=",
        focused,
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setSearchBarFocusedAccept(true);
  };

  const updateRemainderAccepted = (remainder: number) => {
    dbg && console.log("updateRemainderAccepted():", remainder);
    updateAssetWithRemainderBalance(
      true,
      assetsAccepted,
      selectedAssetIdAccept,
      remainder,
      setAssetsAccepted,
    );
    setDoAssetBalanceAccepted(false);
    setAmountAccept(0);
    dbg = false;
  };

  const handleAddAssetsConfirmedOffered = () => {
    dbg && console.log("handleAddAssetsConfirmedOffered()");
    setResetInputAmountOffer(true);
    setDoAssetBalanceOffered(true);
  };

  const handleAddAssetsConfirmedAccepted = () => {
    dbg && console.log("handleAddAssetsConfirmedAccepted()");
    setResetInputAmountAccept(true);
    setDoAssetBalanceAccepted(true);
  };

  const handleAddAssetsOffered = (amountOffer: number) => {
    dbg && console.log("handleAddAssetsOffered():amountOffer=", amountOffer);
    dbg &&
      console.log(
        "handleAddAssetsOffered():selectedAssetIdOffer=",
        selectedAssetIdOffer,
        ",amountOffer=",
        amountOffer,
      );
    setOffer();
    if (
      selectedAssetIdOffer === undefined ||
      selectedAssetIdOffer === "" ||
      amountOffer < 0
    ) {
      console.error("INVALID offer asset");
      return;
    }
    setAmountOffer(amountOffer);
    if (selectedAssetIdOffer && amountOffer === 0) {
      dbg &&
        console.log(
          "handleAddAssetsOffered():call removeAssetOffer()",
          selectedAssetIdOffer,
        );
      removeAssetWithAmountOffer(selectedAssetIdOffer);
    }
    dbg && console.log("handleAddAssetsOffered():amountOffer=", amountOffer);
    if (amountOffer > 0) {
      updateAssetWithAmountBalance(
        false,
        assetsOffered,
        assetsWithAmountsOffered,
        selectedAssetIdOffer,
        amountOffer,
        setAssetsWithAmountsOffered,
      );
      handleAmountClearClickOffer();
      setDoAssetBalanceOffered(true);
    }
    updateStringRecord(
      selectedAssetIdOffer,
      REMAINDER_TEXT,
      setBalanceTextToNameMapOffered,
    );
    updateStringRecord(
      selectedAssetIdOffer,
      OFFERED_TEXT,
      setBalanceTextToWithAmountNameMapOffered,
    );
  };

  const handleAddAssetsAccepted = (amountAccept: number) => {
    dbg && console.log("handleAddAssetsAccepted()");
    dbg &&
      console.log(
        "handleAddAssetsAccepted():selectedAssetIdAccept=",
        selectedAssetIdAccept,
        ",amountAccept=",
        amountAccept,
      );
    setAccept();
    if (
      selectedAssetIdAccept === undefined ||
      selectedAssetIdAccept === "" ||
      amountAccept < 0
    ) {
      console.error("INVALID accept asset");
      return;
    }
    setAmountAccept(amountAccept);
    if (selectedAssetIdAccept && amountAccept === 0) {
      setAccept();
      removeAssetWithAmountAccept(selectedAssetIdAccept);
    }

    dbg && console.log("handleAddAssetsAccepted():amountAccept=", amountAccept);
    if (amountAccept) {
      updateAssetWithAmountBalance(
        false,
        assetsAccepted,
        assetsWithAmountsAccepted,
        selectedAssetIdAccept,
        amountAccept,
        setAssetsWithAmountsAccepted,
      );
      handleAmountClearClickAccept();
      setDoAssetBalanceAccepted(true);
    }
    updateStringRecord(
      selectedAssetIdAccept,
      REMAINDER_TEXT,
      setBalanceTextToNameMapAccepted,
    );
    updateStringRecord(
      selectedAssetIdAccept,
      ACCEPTED_TEXT,
      setBalanceTextToWithAmountNameMapAccepted,
    );
  };

  const setOffer = () => {
    setIsOffer(true);
    setIsAccept(false);
  };

  const setAccept = () => {
    setIsAccept(true);
    setIsOffer(false);
  };

  return (
    <ThemeProvider theme={web3Theme}>
      <Grid
        container
        spacing={3}
        style={{ paddingLeft: "5px", paddingRight: "5px" }}
      >
        <Grid item xs={12}>
          <ToastContainer />
        </Grid>

        <Grid
          item
          xs={12}
          style={{ paddingBottom: "2em", paddingTop: "0.1em" }}
        >
          <img src="/BTMS-logo.png" alt="BTMS Logo" width={"100px"} />
        </Grid>

        <Grid
          item
          xs={12}
          style={{ paddingBottom: "1em", paddingTop: "0.1em" }}
        >
          <Typography variant="h4">List Assets</Typography>
        </Grid>

        {/* Offered Assets Section */}
        <Grid item xs={12} md={6}>
          <Typography variant="h5">Offered Asset(s)</Typography>
          <AssetBalance
            dbg={true}
            assetId={selectedAssetIdOffer}
            newAmount={amountOffer}
            assetListUpdated={assetListUpdatedOffered}
            assets={assetsOffered}
            doAssetBalance={doAssetBalanceOffered}
            setAssetListUpdated={setAssetListUpdatedOffered}
            setAssets={setAssetsOffered}
            unsetResetInputAmount={unsetResetInputAmountOffered}
            updateRemainder={updateRemainderOffered}
            setDoAssetBalance={setDoAssetBalanceOffered}
            setAvailable={setAvailableOffered}
            setRemainder={setRemainderOffered}
          />
          <SearchBar
            dbg={false}
            isOffer={true}
            isAccept={false}
            handleSearchBar={handleSearchBarOffered}
            handleClearSearchBar={handleClearSearchBarOffer}
            handleSearchBarFocused={handleSearchBarFocusedOffered}
          />
          {showProgressOffer && <LinearProgress />}
          {assetTableOffered && (
            <AssetsTable
              dbg={false}
              isVisible={true}
              isOffer={true}
              isAccept={false}
              assets={assetsOffered}
              balanceTextToNameMap={balanceTextToNameMapOffered}
              setAssetTableFocused={setAssetTableFocusedOffer}
              handleSelectedAsset={handleSelectedAssetOffer}
              setSelectedAssetId={setSelectedAssetIdOffer}
              removeAssetWithAmount={removeAssetWithAmountOffer}
              handleAssetTableFocused={handleAssetTableFocusedOffered}
            />
          )}
          {selectedAssetIdOffer && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <InputAmount
                  dbg={false}
                  isOffer={true}
                  isAccept={false}
                  isNew={false}
                  resetField={resetInputAmountOffer}
                  balance={availableOffered[selectedAssetIdOffer]}
                  disable={false}
                  assetSelected={
                    selectedAssetIdOffer !== undefined &&
                    selectedAssetIdOffer !== ""
                  }
                  setAddAssetDisabled={setAddAssetDisabledOffer}
                  unsetResetInputAmount={unsetResetInputAmountOffered}
                  handleAddAssets={handleAddAssetsOffered}
                  handleInputAmountFocused={handleInputAmountFocusedOffered}
                />
              </Grid>
              <Grid item xs={6}>
                <MarketplaceButton
                  dbg={false}
                  isOffer={true}
                  isAccept={false}
                  text={INPUT_AMOUNT_BUTTON_TEXT}
                  handleOnClickConfirmed={handleAddAssetsConfirmedOffered}
                  disable={addAssetDisabledOffer}
                />
              </Grid>
            </Grid>
          )}
        </Grid>

        {/* Accepted Assets Section */}
        <Grid item xs={12} md={6}>
          <Typography variant="h5">Accepted Asset(s)</Typography>
          <AssetBalance
            assetId={selectedAssetIdAccept}
            newAmount={amountAccept}
            assetListUpdated={assetListUpdatedAccepted}
            assets={assetsAccepted}
            doAssetBalance={doAssetBalanceAccepted}
            setAssetListUpdated={setAssetListUpdatedAccepted}
            setAssets={setAssetsAccepted}
            unsetResetInputAmount={unsetResetInputAmountAccepted}
            updateRemainder={updateRemainderAccepted}
            setDoAssetBalance={setDoAssetBalanceAccepted}
            setAvailable={setAvailableAccepted}
            setRemainder={setRemainderAccepted}
          />
          <SearchBar
            dbg={false}
            isAccept={true}
            isOffer={false}
            handleSearchBar={handleSearchBarAccepted}
            handleClearSearchBar={handleClearSearchBarAccept}
            handleSearchBarFocused={handleSearchBarFocusedAccepted}
          />
          {showProgressAccept && <LinearProgress />}
          {assetTableAccepted && (
            <AssetsTable
              dbg={false}
              isVisible={true}
              isAccept={true}
              isOffer={false}
              assets={assetsAccepted}
              balanceTextToNameMap={balanceTextToNameMapAccepted}
              setAssetTableFocused={setAssetTableFocusedAccept}
              handleAssetTableFocused={handleAssetTableFocusedAccepted}
              handleSelectedAsset={handleSelectedAssetAccept}
              setSelectedAssetId={setSelectedAssetIdAccept}
              removeAssetWithAmount={removeAssetWithAmountAccept}
            />
          )}
          {selectedAssetIdAccept && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <InputAmount
                  dbg={false}
                  isAccept={true}
                  isOffer={false}
                  isNew={false}
                  resetField={resetInputAmountAccept}
                  balance={availableAccepted[selectedAssetIdAccept]}
                  disable={false}
                  assetSelected={
                    selectedAssetIdAccept !== undefined &&
                    selectedAssetIdAccept !== ""
                  }
                  setAddAssetDisabled={setAddAssetDisabledAccept}
                  unsetResetInputAmount={unsetResetInputAmountAccepted}
                  handleAddAssets={handleAddAssetsAccepted}
                  handleInputAmountFocused={handleInputAmountFocusedAccepted}
                />
              </Grid>
              <Grid item xs={6}>
                <MarketplaceButton
                  dbg={false}
                  isAccept={true}
                  isOffer={false}
                  text={INPUT_AMOUNT_BUTTON_TEXT}
                  handleOnClickConfirmed={handleAddAssetsConfirmedAccepted}
                  disable={addAssetDisabledAccept}
                />
              </Grid>
            </Grid>
          )}
        </Grid>

        {/* Offered with amount table */}
        <Grid item xs={6}>
          <AssetsTable
            dbg={false}
            isVisible={assetsWithAmountsOffered.length > 0}
            isOffer={true}
            isAccept={false}
            assets={assetsWithAmountsOffered}
            balanceTextToNameMap={balanceTextToWithAmountNameMapOffered}
            setAssetTableFocused={setAssetTableFocusedOffer}
            handleSelectedAsset={handleSelectedAssetOffer}
            setSelectedAssetId={setSelectedAssetIdOffer}
            removeAssetWithAmount={removeAssetWithAmountOffer}
            handleAssetTableFocused={handleAssetTableFocusedOffered}
          />
        </Grid>

        {/* Accepted with amount table */}
        <Grid item xs={6}>
          <AssetsTable
            dbg={false}
            isVisible={assetsWithAmountsAccepted.length > 0}
            isAccept={true}
            isOffer={false}
            assets={assetsWithAmountsAccepted}
            balanceTextToNameMap={balanceTextToWithAmountNameMapAccepted}
            setAssetTableFocused={setAssetTableFocusedAccept}
            handleSelectedAsset={handleSelectedAssetAccept}
            setSelectedAssetId={setSelectedAssetIdAccept}
            removeAssetWithAmount={removeAssetWithAmountAccept}
            handleAssetTableFocused={handleAssetTableFocusedAccepted}
          />
        </Grid>
      </Grid>
    </ThemeProvider>
  );
};

export default ExchangePage;
