/**
 * @file src/utils/getLatestMetanetclientLinks.ts
 * @description
 * Returns fixed, ops-provided download links for Metanet Client on all platforms.
 * We no longer guess from GitHub assets — desktop links are now canonical CDN URLs.
 */

import { logWithTimestamp } from './logging'

const F = 'utils/getLatestMetanetclientLinks'

// canonical desktop links (from ops)
const METANET_MACOS = 'https://desktop-binaries.getmetanet.com/metanet-client-macos-arm64.dmg'
const METANET_WINDOWS = 'https://desktop-binaries.getmetanet.com/metanet-client-windows-x64.msi'
const METANET_LINUX = 'https://desktop-binaries.getmetanet.com/metanet-client-linux-x86_64.AppImage'

export interface MetanetclientLinks {
  macos: string | null
  windows: string | null
  linux: string | null
  ios: string | null
  android: string | null
  generic: string | null
}

const getLatestMetanetclientLinks = async (): Promise<MetanetclientLinks> => {
  // no network required anymore — these are fixed
  const links: MetanetclientLinks = {
    macos: METANET_MACOS,
    windows: METANET_WINDOWS,
    linux: METANET_LINUX,
    ios: 'https://testflight.apple.com/join/3B5ak7cH',
    android: 'https://getmetanet.com/android.apk',
    generic: 'https://getmetanet.com/'
  }

  logWithTimestamp(F, '✅ Using fixed Metanet client links', links)
  return links
}

export default getLatestMetanetclientLinks
