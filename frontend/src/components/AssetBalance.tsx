import React, { useState, useEffect } from 'react'
import { getAsset } from '../utils/general'
import { SatoshiValue } from '@bsv/sdk'
import { Asset, btms } from '../btms'

interface AssetBalanceProps {
  dbg?: boolean
  assetId: string
  newAmount: SatoshiValue
  assetListUpdated: boolean
  assets: Asset[]
  doAssetBalance: boolean
  //setAssetRemainder: React.Dispatch<React.SetStateAction<number>>;
  setAssetListUpdated: React.Dispatch<React.SetStateAction<boolean>>
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  unsetResetInputAmount: () => void
  updateRemainder: (remainder: number) => void
  setDoAssetBalance: React.Dispatch<React.SetStateAction<boolean>>
  setAvailable: React.Dispatch<React.SetStateAction<{ [assetId: string]: number }>>
  setRemainder: React.Dispatch<React.SetStateAction<{ [assetId: string]: number }>>
}

const AssetBalance: React.FC<AssetBalanceProps> = ({
  dbg,
  assetListUpdated,
  assetId,
  newAmount,
  doAssetBalance,
  //setAssetRemainder,
  setAssetListUpdated,
  unsetResetInputAmount,
  assets,
  setAssets,
  updateRemainder,
  setDoAssetBalance,
  setAvailable,
  setRemainder
}) => {
  const [currentAvailable, setCurrentAmount] = useState<{
    [assetId: string]: number
  }>({})
  const [amount, setAmount] = useState<{ [assetId: string]: number }>({})
  const [internalAssetListUpdated, setInternalAssetListUpdated] = useState<boolean>(false)
  const [internaldoAssetBalance, setInternalDoAssetBalance] = useState<boolean>(false)

  // useEffect to fetch assets data when the component mounts or when assetListUpdated changes
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const fetchedAssets = await btms.listAssets() // Call btms.listAssets() here
        // Process fetchedAssets as needed, e.g., initialize currentAvailable
        const currentAvailable: { [assetId: string]: number } = {}
        fetchedAssets.forEach(asset => {
          currentAvailable[asset.assetId] = asset.balance // Assuming assetId and initialAmount properties
        })
        setCurrentAmount(currentAvailable)
        //console.log('currentAvailable=', currentAvailable)
        setInternalAssetListUpdated(true)
        setAssetListUpdated(false)
        //setCurrentAmount(currentAvailable);
      } catch (error) {
        console.error('Error fetching assets:', error)
        // Handle error state or display error message
      }
    }

    // Call fetchAssets when the component mounts or when assetListUpdated changes
    if (assetListUpdated) {
      fetchAssets()
    }
  }, [assetListUpdated]) // Watch for changes in assetListUpdated to trigger the effect

  useEffect(() => {
    // Update ramainderMap based on currentAvailable and amount to give remainder
    dbg && console.log('amount=', amount)
    const remainderMap: { [assetId: string]: number } = {}
    Object.keys(amount).forEach(assetId => {
      remainderMap[assetId] = currentAvailable[assetId] - amount[assetId]
    })
    setRemainder(remainderMap)
  }, [amount, newAmount])

  useEffect(() => {
    // Update avaialbleMap based on currentAvailable
    const availableMap: { [assetId: string]: number } = {}
    Object.keys(currentAvailable).forEach(assetId => {
      availableMap[assetId] = currentAvailable[assetId]
    })
    setRemainder(availableMap)
  }, [currentAvailable, newAmount])

  // Function to calculate remainder based on props
  // Function to update amount
  const updateAmount = (assetId, newAmount) => {
    setAmount(prevAmount => ({
      ...prevAmount,
      [assetId]: newAmount
    }))
  }

  // Calculate remainder based on current and amounts
  const getRemainderAmount = () => {
    const $currentAvailable = currentAvailable[assetId]
    const $amount = amount[assetId]

    dbg && console.log('$currentAvailable=', $currentAvailable, ',amount=', $amount)
    if (typeof $currentAvailable === 'number' && typeof $amount === 'number') {
      dbg &&
        console.log(
          assetId.substring(0, 10),
          getAsset(assets, assetId).name,
          ':',
          currentAvailable[assetId],
          '-',
          amount[assetId],
          '=',
          currentAvailable[assetId] - amount[assetId]
        )
      return $currentAvailable - $amount
    }

    return 0 // Default value if amounts are not valid
  }

  // Update amount when newAmount changes
  useEffect(() => {
    if (newAmount > 0) {
      updateAmount(assetId, newAmount)
      setInternalDoAssetBalance(true)
      setDoAssetBalance(false)
    }
  }, [assetId, newAmount])

  // Calculate remainder whenever amount or currentAvailable changes
  useEffect(() => {
    console.log('newAmount:', newAmount)
    //console.log('currentAvailable:', currentAvailable);
    if (currentAvailable[assetId] !== undefined && amount[assetId] !== undefined && amount[assetId] > 0) {
      const remainder = getRemainderAmount()
      console.log('Remainder:', remainder)
      dbg &&
        console.log(
          'A',
          assetId.substring(0, 10),
          getAsset(assets, assetId).name,
          ':',
          currentAvailable[assetId],
          '-',
          amount[assetId],
          '=',
          currentAvailable[assetId] - amount[assetId]
        )
      updateRemainder(remainder)
    }
    // Perform any additional logic with remainder
  }, [assetId, amount, newAmount])

  return (
    <>
      {/*
	  {(internalAssetListUpdated || internaldoAssetBalance) && <pre>{JSON.stringify(currentAvailable, null, 2)}</pre>}
	  {amount && <pre>{JSON.stringify(amount, null, 2)}</pre>}
	
	  {(internalAssetListUpdated || internaldoAssetBalance) && (
      <AssetManagement assets={assets} setAssets={setAssets} />
    )}
	*/}
    </>
  )
}

export default AssetBalance
