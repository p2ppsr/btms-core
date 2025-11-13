import React, { useState, useEffect } from 'react';
import type { Asset } from '../btms'

interface AssetManagementProps {
  assets: Asset[]; // List of assets passed as props
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}

const AssetManagement: React.FC<AssetManagementProps> = ({ assets }) => {
  const [internalAssetsList, setAssets] = useState([]); // internal version
  const [internalAssetsMap, setInternalAssets] = useState<{ [assetId: string]: Asset }>({});

  // useEffect to update internalAssetsMap state when assets prop changes
  useEffect(() => {
    const updateAssetsList = () => {
      // Create a map of new assets for quick lookup by assetId
      const newAssetsMap: { [assetId: string]: Asset } = {};
      Object.values(assets).forEach((asset) => {
        newAssetsMap[asset.assetId] = asset;
      });

      // Update internalAssetsMap state based on changes in assets prop
      const updatedAssets: { [assetId: string]: Asset } = {};
      Object.keys(newAssetsMap).forEach((assetId) => {
        const newAsset = newAssetsMap[assetId];
        const existingAsset = internalAssetsMap[assetId];

        // Check if existingAsset is undefined or if assets are not equal
        if (!existingAsset || !areAssetsEqual(existingAsset, newAsset)) {
          updatedAssets[assetId] = newAsset;
        }
      });

      // Update internalAssetsMap state with the updated assets
      setInternalAssets((prevAssets) => ({
        ...prevAssets,
        ...updatedAssets,
      }));
    };

    updateAssetsList(); // Call updateAssetsList when assets prop changes
  }, [assets]); // Re-run effect when assets prop changes

  // Helper function to compare two assets for equality
  const areAssetsEqual = (assetOld: Asset, assetNew: Asset): boolean => {
    // Compare relevant properties of the assets (customize as needed)
    return (
      assetOld.balance === assetNew.balance &&
      assetOld.name === assetNew.name
      // Add more properties for comparison as needed
      // Example: asset1.attr === asset2.attr
    );
  };

  return (
    <div>
      {/*<h2>AssetManagement Component</h2>
      <pre>{JSON.stringify(internalAssetsMap, null, 2)}</pre>
			*/}
    </div>
  );
};

export default AssetManagement;