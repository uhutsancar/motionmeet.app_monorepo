import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAdsReady } from '../../hooks/useAdsReady';
import { getAdsModule } from '../../services/adsModule';
import { resolveAdUnitId } from '../../config/ads';
// Type-only: erased at compile time, so this never triggers the native
// module require() that makes Expo Go unusable for the real import.
import type { NativeAd as NativeAdInstance } from 'react-native-google-mobile-ads';

/**
 * One Explore grid cell showing a native ad, sized to match the surrounding
 * photo tiles exactly. Renders a plain placeholder square (matching the
 * empty-tile background already used elsewhere in the grid) until an ad
 * actually loads, and stays that way on failure - removing the cell instead
 * would shift every tile after it and, worse, desync the post-viewer's index
 * mapping into the grid.
 */
const NativeAdTile = ({ size }: { size: number }) => {
  const { theme } = useTheme();
  const ready = useAdsReady();
  const ads = getAdsModule();
  const [nativeAd, setNativeAd] = useState<NativeAdInstance | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!ads || !ready || requested.current) return;
    requested.current = true;
    const unitId = resolveAdUnitId('native', Platform.OS, ads.TestIds);
    ads.NativeAd.createForAdRequest(unitId)
      .then(setNativeAd)
      .catch((error: Error) => console.warn('[ads] native tile failed to load:', error));
  }, [ads, ready]);

  useEffect(() => () => nativeAd?.destroy(), [nativeAd]);

  const placeholderStyle = { width: size, height: size, backgroundColor: theme.surfaceLight };
  if (!ads || !nativeAd) return <View style={placeholderStyle} />;

  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = ads;

  return (
    <NativeAdView nativeAd={nativeAd} style={[placeholderStyle, styles.container]}>
      <NativeMediaView style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.captionBar}>
        <Text style={styles.label}>Reklam</Text>
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
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default NativeAdTile;
