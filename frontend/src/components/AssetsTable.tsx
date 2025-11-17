import React, { useEffect, useRef, useState } from "react";
import {
  Table,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Grid,
  ThemeProvider,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import web3Theme from "../theme";
import type { Asset } from "../btmsTypes";
import { OFFERED_TEXT, ACCEPTED_TEXT } from "../utils/constants";

interface AssetsTableProps {
  dbg?: boolean;
  isVisible: boolean;
  isOffer: boolean;
  isAccept: boolean;
  assets: Asset[] | null;
  balanceTextToNameMap: Record<string, string>;
  setAssetTableFocused: React.Dispatch<React.SetStateAction<boolean>>;
  handleSelectedAsset: (
    assetId: string,
    isOffer: boolean,
    isAccept: boolean,
  ) => void;
  setSelectedAssetId: React.Dispatch<React.SetStateAction<string>>;
  removeAssetWithAmount: (assetId: string) => void;
  handleAssetTableFocused: (
    focused: boolean,
    isOffer: boolean,
    isAccept: boolean,
  ) => void;
}

const mockTokenImages: Record<string, string> = {
  "French Fries": "mock/french-fries.png",
  "French Lessons": "mock/french-lessons.png",
  Ketchup: "mock/ketchup.jpg",
};

const AssetsTable: React.FC<AssetsTableProps> = ({
  dbg,
  isVisible,
  isOffer,
  isAccept,
  assets,
  balanceTextToNameMap,
  setAssetTableFocused,
  handleSelectedAsset,
  setSelectedAssetId,
  removeAssetWithAmount,
  handleAssetTableFocused,
}) => {
  dbg && console.log("AssetsTable:isOffer=", isOffer, ",isAccept=", isAccept);
  if (isOffer === isAccept) {
    console.error("Can only have isOffer true or isAccept true");
  }

  const mockTokenDefaultImage = "mock/tokenIcon-A1.png";
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [clickedRowId, setClickedRowId] = useState<string | null>(null);
  const [$isOffer, $setIsOffer] = useState<boolean>(true);
  const [$isAccept, $setIsAccept] = useState<boolean>(false);

  useEffect(() => {
    $setIsOffer(isOffer);
    $setIsAccept(isAccept);
  }, [isOffer, isAccept]);

  useEffect(() => {
    // Reserved for future outside-click handling if needed
  }, []);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleUnhighlightRow = (e: React.MouseEvent<HTMLTableRowElement>) => {
    setAssetTableFocused(false);
    handleAssetTableFocused(false, $isOffer, $isAccept);
    if (
      tableContainerRef.current &&
      !tableContainerRef.current.contains(e.target as Node)
    ) {
      setClickedRowId(null);
    }
  };

  const handleRowAssetClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    assetId: string,
  ) => {
    dbg &&
      console.log(
        "handleRowAssetClick():assetId=",
        assetId.substring(0, 10),
        ",isOffer=",
        isOffer,
        ",isAccept=",
        isAccept,
      );
    setAssetTableFocused(true);
    handleSelectedAsset(assetId, $isOffer, $isAccept);
    setClickedRowId(assetId);
    handleUnhighlightRow(e);
  };

  const handleMouseEnter = (assetId: string) => {
    dbg && console.log("handleMouseEnter():assetId=", assetId.substring(0, 10));
    setAssetTableFocused(true);
    setHoveredRow(assetId);
  };

  const handleMouseLeave = () => {
    dbg && console.log("handleMouseLeave()");
    setAssetTableFocused(true);
    setHoveredRow(null);
  };

  const isClickedRow = (assetId: string) => {
    dbg && console.log("isClickedRow():assetId=", assetId.substring(0, 10));
    setAssetTableFocused(true);
    return clickedRowId === assetId;
  };

  const removeAssetOffer = (assetId: string) => {
    dbg && console.log("removeAssetOffer():assetId=", assetId.substring(0, 10));
    setAssetTableFocused(true);
    setSelectedAssetId(assetId);
    removeAssetWithAmount(assetId);
  };

  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    assetId: string,
  ) => {
    dbg && console.log("handleRowClick():assetId=", assetId.substring(0, 10));
    setAssetTableFocused(true);
    const status = balanceTextToNameMap[assetId];
    if (status === OFFERED_TEXT || status === ACCEPTED_TEXT) {
      removeAssetOffer(assetId);
    } else {
      // Perform the original row click action here
      dbg && console.log("handleAssetClick(asset)");
      handleRowAssetClick(e, assetId);
    }
  };

  return (
    <ThemeProvider theme={web3Theme}>
      <Grid
        container
        spacing={2}
        style={{
          paddingLeft: "16px",
          visibility: isVisible ? "visible" : "hidden",
          display: isVisible ? "block" : "none",
        }}
      >
        <Grid item xs={5} />
        <TableContainer
          ref={tableContainerRef}
          onMouseOver={() => handleAssetTableFocused(true, $isOffer, $isAccept)}
          onMouseLeave={() =>
            handleAssetTableFocused(false, $isOffer, $isAccept)
          }
          onMouseEnter={() => setHoveredRow(null)}
          style={{
            height: "16em",
            overflowY: "auto",
            borderRadius: "10px",
            border: "1px solid rgba(128, 128, 128, 0.77)",
          }}
        >
          <Table sx={{ minWidth: 250 }} aria-label="assets table" size="small">
            <TableBody>
              {assets?.map((asset) => {
                const iconURL = asset.name
                  ? mockTokenImages[asset.name] || mockTokenDefaultImage
                  : mockTokenDefaultImage;
                const rowClicked = isClickedRow(asset.assetId);
                const rowStatus = balanceTextToNameMap[asset.assetId];

                return (
                  <TableRow
                    key={asset.assetId}
                    onMouseEnter={() => handleMouseEnter(asset.assetId)}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => handleRowClick(e, asset.assetId)}
                    style={{
                      cursor: "pointer",
                      color: rowClicked ? "#000" : "#fff",
                      backgroundColor: rowClicked
                        ? "#fff"
                        : hoveredRow === asset.assetId
                          ? "#2b2b2b"
                          : "transparent",
                    }}
                  >
                    <TableCell
                      style={{
                        color: rowClicked ? "#000" : "#fff",
                      }}
                    >
                      <Grid
                        container
                        spacing={2}
                        alignItems="center"
                        style={{
                          alignContent: "stretch",
                          justifyContent: "space-between",
                        }}
                      >
                        <Grid item>
                          <img
                            src={iconURL}
                            alt={asset.name}
                            style={{ width: "3em", height: "3em" }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <div>
                            <span>{asset.name}</span>
                            <br />
                            <span>
                              {rowStatus}: {asset.balance}
                            </span>
                          </div>
                        </Grid>
                        <Grid item xs={2} />
                        <Grid item xs={1}>
                          {hoveredRow === asset.assetId &&
                            (rowStatus === OFFERED_TEXT ||
                              rowStatus === ACCEPTED_TEXT) && (
                              <IconButton
                                onClick={() => {
                                  removeAssetOffer(asset.assetId);
                                }}
                                size="small"
                              >
                                <CloseIcon />
                              </IconButton>
                            )}
                        </Grid>
                      </Grid>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </ThemeProvider>
  );
};

export default AssetsTable;
