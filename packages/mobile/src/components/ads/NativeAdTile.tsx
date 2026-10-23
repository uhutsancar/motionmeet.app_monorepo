import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAdsReady } from '../../hooks/useAdsReady';
import { getAdsModule } from '../../services/adsModule';
import { resolveAdUnitId } from '../../config/ads';
// Type-only: erased at compile time, so this never triggers the native
// module require() that makes Expo Go unusable for the real import.
import type { NativeAd as NativeAdInstance } from 'react-native-google-mobile-ads';

interface NativeAdTileProps {
  size: number;
  /**
   * Called once when no ad can be shown in this cell (no fill, an error, or
   * the SDK unavailable), so the grid can drop the cell rather than keep an
   * empty square in it.
   */
  onUnavailable?: () => void;
}

/**
 * One Explore grid cell showing a native ad, sized to match the surrounding
 * photo tiles exactly, with a "Sponsorlu" plate large enough to read. While
 * the ad loads the cell is a plain placeholder square in the grid's empty-tile
 * colour; if it never fills, `onUnavailable` lets the grid remove it. Post
 * tiles carry their own index into the post list, so removing an ad cell never
 * changes which post the viewer opens.
 */
const NativeAdTile = ({ size, onUnavailable }: NativeAdTileProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const ready = useAdsReady();
  const ads = getAdsModule();
  const [nativeAd, setNativeAd] = useState<NativeAdInstance | null>(null);

  useEffect(() => {
    if (!ads) {
      onUnavailable?.();
      return undefined;
    }
    if (!ready) return undefined;
    let alive = true;
    let loaded: NativeAdInstance | null = null;
    const unitId = resolveAdUnitId('native', Platform.OS, ads.TestIds);
    ads.NativeAd.createForAdRequest(unitId, { startVideoMuted: true })
      .then((ad) => {
        if (!alive) return ad.destroy();
        loaded = ad;
        setNativeAd(ad);
      })
      .catch((error: Error) => {
        console.warn('[ads] native tile not filled:', error.message);
        if (alive) onUnavailable?.();
      });
    return () => {
      alive = false;
      loaded?.destroy();
    };
    // `onUnavailable` is a notification, not an input: a new callback must not
    // re-request the ad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads, ready]);

  const placeholderStyle = { width: size, height: size, backgroundColor: theme.surfaceLight };
  if (!ads || !nativeAd) return <View style={placeholderStyle} />;

  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = ads;

  return (
    <NativeAdView nativeAd={nativeAd} style={[placeholderStyle, styles.container]}>
      <NativeMediaView style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.captionBar}>
        <Text style={styles.label}>{t('ads.sponsored', 'Sponsorlu')}</Text>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text numberOfLines={1} style={styles.headline}>{nativeAd.headline}</Text>
        </NativeAsset>
      </View>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default NativeAdTile;
