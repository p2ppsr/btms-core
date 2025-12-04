/**
 * @file src/utils/usePlatformDownloadInfo.ts
 * @description
 * A React hook that determines the current desktop platform (macOS, Windows, or Linux)
 * and provides the appropriate download URL for the Metanet client, using the latest
 * GitHub release info.
 */

import { useEffect, useState } from 'react'
import getLatestMetanetclientLinks, { MetanetclientLinks } from './getLatestMetanetclientLinks'
import { logWithTimestamp } from './logging'

const F = 'utils/usePlatformDownloadInfo'

/**
 * Represents platform-specific download information for the Metanet client.
 *
 * @interface DownloadInfo
 * @property {string} platformLabel - A human-readable label for the detected platform (e.g., "macOS", "Windows", "Linux").
 * @property {string} downloadURL - A direct URL to download the Metanet client for the detected platform, or empty string if unavailable.
 */
export interface DownloadInfo {
  platformLabel: string
  downloadURL: string
}

/**
 * A React hook that detects the current platform (desktop web) and fetches the appropriate
 * download link for the Metanet client from the latest GitHub release.
 *
 * For web, it inspects the user agent to determine macOS, Windows, or Linux platform.
 *
 * @returns {DownloadInfo | null} An object with `platformLabel` and `downloadURL`,
 *          or `null` while loading or if an error occurs.
 */
const usePlatformDownloadInfo = (): DownloadInfo | null => {
  const [info, setInfo] = useState<DownloadInfo | null>(null)

  useEffect(() => {
    /**
     * Detects the desktop platform using the browser's user agent string.
     *
     * @returns {keyof MetanetclientLinks} The inferred desktop OS key, defaults to 'macos' if unknown.
     */
    const detectWebPlatform = (): keyof MetanetclientLinks => {
      if (typeof navigator === 'undefined') {
        return 'macos'
      }

      const ua = navigator.userAgent || navigator.platform || 'unknown'
      if (typeof ua === 'string' && ua !== '') {
        if (/Mac/i.test(ua)) return 'macos'
        if (/Win/i.test(ua)) return 'windows'
        if (/Linux/i.test(ua)) return 'linux'
      }
      return 'macos' // Fallback to macOS if platform cannot be determined
    }

    /**
     * Fetches the latest Metanet client links and sets the appropriate platform info.
     */
    const fetchDownloadURL = async (): Promise<void> => {
      try {
        const links: MetanetclientLinks = await getLatestMetanetclientLinks()
        logWithTimestamp(F, '🔍 Metanet client links:', links)

        const desktopOS = detectWebPlatform()
        const labelMap: Record<string, string> = {
          macos: 'macOS',
          windows: 'Windows',
          linux: 'Linux'
        }

        const platformLabel = labelMap[desktopOS] || 'Desktop'
        const downloadURL = links[desktopOS] ?? ''

        setInfo({
          platformLabel,
          downloadURL
        })

        logWithTimestamp(F, '✅ Set platform info:', {
          platformLabel,
          downloadURL
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logWithTimestamp(F, '❌ Error fetching download URL:', message)
        setInfo(null)
      }
    }

    void fetchDownloadURL()
  }, [])

  return info
}

export default usePlatformDownloadInfo
