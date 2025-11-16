import { Dispatch, SetStateAction } from "react";
import type { Asset } from "../btms";
import { SatoshiValue } from "@bsv/sdk";

// Utility function to copy an array of Asset objects
export const copyAssetArray = (originalArray: Asset[]): Asset[] => {
  const copiedArray: Asset[] = [];
  originalArray.forEach((asset) => {
    const copiedAsset: Asset = {
      ...asset,
    };
    copiedArray.push(copiedAsset);
  });
  return copiedArray;
};

export const copyAsset = (asset: Asset): Asset => {
  const copiedAsset: Asset = {
    ...asset,
  };
  return copiedAsset;
};

export const getAsset = (assets: Asset[], assetId: string): Asset => {
  try {
    const index: number = assets.findIndex(
      (asset) => asset.assetId === assetId,
    );
    return assets[index] || (undefined as any);
  } catch {
    console.error("Problem finding asset with assetId:", assetId);
    throw new Error(`Problem finding asset with assetId: ${assetId}`);
  }
};

export const getAssetListIndexFromAsset = (
  assets: Asset[],
  selectedAsset: Asset,
): number => {
  return assets.findIndex((asset) => asset.assetId === selectedAsset.assetId);
};

export const getAssetListIndexFromAssetId = (
  assets: Asset[],
  assetId: string,
): number => {
  return assets.findIndex((asset) => asset.assetId === assetId);
};

export const updateNewAssetNumberProp = (
  assets: Asset[],
  assetId: string,
  value: number,
  prop: string,
) => {
  try {
    const selectedAsset = getAsset(assets, assetId);
    const newAsset: Asset = {
      ...selectedAsset,
      [prop]: value,
    };
    return newAsset || (undefined as any);
  } catch (e) {
    console.error(`asset with ${assetId} not found in assets`);
    throw new Error(`asset with ${assetId} not found in assets`);
  }
};

export const updateExistingAssetNumberProp = (
  assets: Asset[],
  assetId: string,
  value: number,
  prop: string,
) => {
  try {
    const updatedAssets: Asset[] = assets.map((asset) =>
      asset.assetId === assetId ? { ...asset, [prop]: value } : asset,
    );
    return updatedAssets;
  } catch (e) {
    console.error(`asset with ${assetId} not found in assets`);
    throw new Error(`asset with ${assetId} not found in assets`);
  }
};

export const updateAssetWithRemainderBalance = (
  dbg: boolean,
  assets: Asset[],
  assetId: string,
  balance: SatoshiValue,
  setAssetsWithAmounts: Dispatch<SetStateAction<Asset[]>>,
) => {
  dbg &&
    console.log(
      "updateAssetWithRemainderBalance():assetId=",
      assetId.substring(0, 10),
      "balance=",
      balance,
      ",assets=",
      assets,
    );
  if (getAssetListIndexFromAssetId(assets, assetId) === -1) {
    const updatedAssetsWithAmount = updateNewAssetNumberProp(
      assets,
      assetId,
      balance,
      "balance",
    );
    setAssetsWithAmounts([...assets, updatedAssetsWithAmount]);
    dbg && console.log("updateAssetWithRemainderBalance():assets=", assets);
  } else {
    const updatedAssetsWithAmounts = updateExistingAssetNumberProp(
      assets,
      assetId,
      balance,
      "balance",
    );
    setAssetsWithAmounts(updatedAssetsWithAmounts);
    dbg && console.log("updateAssetWithRemainderBalance():assets=", assets);
  }
};

export const updateAssetWithAmountBalance = (
  dbg: boolean,
  assets: Asset[],
  assetsWithAmounts: Asset[],
  assetId: string,
  balance: SatoshiValue,
  setAssetsWithAmounts: Dispatch<SetStateAction<Asset[]>>,
) => {
  dbg &&
    console.log(
      "updateAssetWithAmountBalance():assetId=",
      assetId.substring(0, 10),
      "balance=",
      balance,
      ",assets=",
      assets,
      ",assetsWithAmounts=",
      assetsWithAmounts,
    );
  if (getAssetListIndexFromAssetId(assetsWithAmounts, assetId) === -1) {
    const updatedAssetsWithAmount = updateNewAssetNumberProp(
      assets,
      assetId,
      balance,
      "balance",
    );
    setAssetsWithAmounts([...assetsWithAmounts, updatedAssetsWithAmount]);
  } else {
    const updatedAssetsWithAmounts = updateExistingAssetNumberProp(
      assetsWithAmounts,
      assetId,
      balance,
      "balance",
    );
    setAssetsWithAmounts(updatedAssetsWithAmounts);
  }
  dbg &&
    console.log(
      "updateAssetWithAmountBalance():assets=",
      assets,
      ",assetsWithAmounts=",
      assetsWithAmounts,
    );
};

export const updateAssetWithOriginalBalance = (
  assets: Asset[],
  assetId: string,
  balance: SatoshiValue,
  setAssetsWithAmounts: Dispatch<SetStateAction<Asset[]>>,
) => {
  if (getAssetListIndexFromAssetId(assets, assetId) === -1) {
    const updatedAssets = updateNewAssetNumberProp(
      assets,
      assetId,
      balance,
      "balance",
    );
    setAssetsWithAmounts([...assets, updatedAssets]);
  } else {
    const updatedAssets = updateExistingAssetNumberProp(
      assets,
      assetId,
      balance,
      "balance",
    );
    setAssetsWithAmounts(updatedAssets);
  }
};

export const updateStringRecord = (
  assetId: string,
  record: string,
  setRecords: Dispatch<SetStateAction<{ [key: string]: string }>>,
) => {
  setRecords((prevRecords) => ({
    ...prevRecords,
    [assetId]: record,
  }));
  return record;
};

export const updateNumberRecord = (
  assetId: string,
  record: number,
  setRecords: Dispatch<SetStateAction<{ [assetId: string]: number }>>,
) => {
  setRecords((prevRecords) => ({
    ...prevRecords,
    [assetId]: record,
  }));
  return record;
};

export const updateAssetProp = (
  selectedAsset: Asset,
  prop: string,
  value: string | number,
  setAssetsWithAmounts: Dispatch<SetStateAction<Asset[]>>,
  assetsWithAmounts: Asset[],
  assetIndex: number,
) => {
  console.log("updateAssetProp():assetIndex=", assetIndex);
  if (assetIndex !== -1) {
    const updatedAssets: Asset[] = assetsWithAmounts.map((asset) =>
      asset.assetId === selectedAsset.assetId
        ? { ...asset, [prop]: value }
        : asset,
    );
    setAssetsWithAmounts(updatedAssets);
  } else {
    const newAsset: Asset = {
      ...selectedAsset,
      [prop]: value,
    };
    setAssetsWithAmounts([...assetsWithAmounts, newAsset]);
  }
  console.log("updateAssetProp():assetsWithAmounts=", assetsWithAmounts);
};

// Remove an asset from the list based on asset ID
export const removeAsset = (assets: Asset[], assetId: string) => {
  try {
    const updatedAssets = assets.filter((asset) => asset.assetId !== assetId);
    return updatedAssets;
  } catch (e) {
    console.error(`asset with ${assetId} not found in assets while removing`);
    throw new Error(`asset with ${assetId} not found in assets while removing`);
  }
};

export const removeAssetWithAmount = (
  assets: Asset[],
  assetId: string,
  setAssetsWithAmounts: Dispatch<SetStateAction<Asset[]>>,
) => {
  console.log("remove assets before=", assets);
  const updatedAssets = removeAsset(assets, assetId);
  setAssetsWithAmounts(updatedAssets);
  console.log("remove assets after=", assets);
};

export const checkAssetBalancesList = (
  num: number,
  availableAsset: Asset,
  offerList: Asset[],
  remainderList: Asset[],
) => {
  if (offerList.length === 0 || remainderList.length === 0) return;
  try {
    const offerIndex: number = getAssetListIndexFromAsset(
      offerList,
      availableAsset,
    );
    const remainderIndex: number = getAssetListIndexFromAsset(
      remainderList,
      availableAsset,
    );
    console.log(
      `List ${num} ${availableAsset.name}: offered:${offerList[offerIndex].balance} remainer: ${remainderList[remainderIndex].balance} available=${availableAsset.balance}`,
    );
    if (
      offerList[offerIndex].balance + remainderList[remainderIndex].balance !==
      availableAsset.balance
    ) {
      console.error(
        `List ${num} ${availableAsset.name}: offered:${offerList[offerIndex].balance} remainer: ${remainderList[remainderIndex].balance} available=${availableAsset.balance}`,
      );
    }
  } catch (e) {
    console.log("List=", num);
    console.log("name=", availableAsset.name);
    console.log("availableAsset=", availableAsset);
    console.log("offerList=", offerList);
    console.log("remainderList=", remainderList);
    console.log(
      "offered=",
      offerList[(availableAsset as any).assetId]?.balance,
    );
    console.log(
      "remainer=",
      remainderList[(availableAsset as any).assetId]?.balance,
    );
    console.log("available=", availableAsset.balance);
  }
};

export const isStringNumber = (str: string): boolean => {
  const num = parseInt(str, 10);
  return !isNaN(num);
};
