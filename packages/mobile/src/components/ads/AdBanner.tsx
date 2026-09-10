import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useAdEntitlement } from '../../hooks/useAdEntitlement';
import { useAdsReady } from '../../hooks/useAdsReady';
import { getAdsModule } from '../../services/adsModule';
import { resolveAdUnitId } from '../../config/ads';
import { FEED_GUTTER } from '../../config/layout';

/**
 * One adaptive banner row for the Home/Explore feed, clearly labeled as an
 * ad. Renders nothing - not even the "Reklam" label or a placeholder box -
 * whenever there's no ad to show, so a failed load or a disabled/ad-free
 * state never leaves a gap in the list.
 */
const AdBanner = () => {
  const { theme } = useTheme();
  const { shouldShowAds } = useAdEntitlement();
  const ready = useAdsReady();
  const [failed, setFailed] = useState(false);

  const ads = shouldShowAds && ready && !failed ? getAdsModule() : null;
  if (!ads) return null;

  const { BannerAd, BannerAdSize, TestIds } = ads;
  const unitId = resolveAdUnitId('banner', Platform.OS, TestIds);

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Text style={[styles.label, { color: theme.textMuted }]}>Reklam</Text>
      <View style={styles.adSlot}>
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          onAdFailedToLoad={(error: Error) => {
            console.warn('[ads] banner failed to load:', error);
            setFailed(true);
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: FEED_GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  adSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdBanner;
