import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAdEntitlement } from '../../hooks/useAdEntitlement';
import { useAdsReady } from '../../hooks/useAdsReady';
import { getAdsModule } from '../../services/adsModule';
import { resolveAdUnitId } from '../../config/ads';
import { AVATAR, FEED_GUTTER } from '../../config/layout';
// Type-only: erased at compile time, so Expo Go never touches the native module.
import type { NativeAd as NativeAdInstance } from 'react-native-google-mobile-ads';

/** Creatives outside this range are letterboxed rather than cropped. */
const MIN_MEDIA_RATIO = 0.8;
const MAX_MEDIA_RATIO = 1.91;

/**
 * A sponsored post in the home feed.
 *
 * It sits in the feed's own rhythm - full width, the same header row and
 * gutter as a member's post - so it does not read as a boxed widget dropped
 * between posts. It is also never mistaken for one: the header says
 * "Sponsorlu" in plain text, there are no like/comment/share buttons it could
 * not honour, and the SDK's own AdChoices mark stays in the corner it puts it.
 *
 * Everything the reader can tap is a registered SDK asset inside
 * `NativeAdView`, so clicks and impressions are counted by the SDK alone; no
 * Touchable of ours sits on top of the creative. Until an ad has loaded - and
 * when none is available - the row renders nothing, so a no-fill never leaves
 * an empty panel in the feed.
 */
const NativeAdCard = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { shouldShowAds } = useAdEntitlement();
  const ready = useAdsReady();
  const ads = shouldShowAds && ready ? getAdsModule() : null;
  const [nativeAd, setNativeAd] = useState<NativeAdInstance | null>(null);

  useEffect(() => {
    if (!ads) return undefined;
    let alive = true;
    let loaded: NativeAdInstance | null = null;
    const unitId = resolveAdUnitId('native', Platform.OS, ads.TestIds);
    ads.NativeAd.createForAdRequest(unitId, {
      startVideoMuted: true,
      adChoicesPlacement: ads.NativeAdChoicesPlacement.TOP_RIGHT,
    })
      .then((ad) => {
        // A row scrolled away before its ad arrived must not keep it alive.
        if (!alive) return ad.destroy();
        loaded = ad;
        setNativeAd(ad);
      })
      .catch((error: Error) => console.warn('[ads] native card not filled:', error.message));
    return () => {
      alive = false;
      loaded?.destroy();
      setNativeAd(null);
    };
  }, [ads]);

  if (!ads || !nativeAd) return null;

  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = ads;
  const ratio = Math.min(MAX_MEDIA_RATIO, Math.max(MIN_MEDIA_RATIO, nativeAd.mediaContent?.aspectRatio || 1));
  const sponsor = nativeAd.advertiser || nativeAd.store || '';

  return (
    <NativeAdView nativeAd={nativeAd} style={[styles.root, { borderColor: theme.border }]}>
      <View style={styles.header}>
        {nativeAd.icon?.url ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={[styles.icon, { backgroundColor: theme.surfaceLight }]} />
          </NativeAsset>
        ) : (
          <View style={[styles.icon, { backgroundColor: theme.surfaceLight }]} />
        )}
        <View style={styles.headerText}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text numberOfLines={1} style={[styles.headline, { color: theme.text }]}>{nativeAd.headline}</Text>
          </NativeAsset>
          <Text numberOfLines={1} style={[styles.sponsored, { color: theme.textMuted }]}>
            {sponsor
              ? t('ads.sponsored_by', { sponsor, defaultValue: 'Sponsorlu · {{sponsor}}' })
              : t('ads.sponsored', 'Sponsorlu')}
          </Text>
        </View>
      </View>

      <NativeMediaView
        style={{ width, height: width / ratio, backgroundColor: theme.surfaceLight }}
        resizeMode="contain"
      />

      {nativeAd.body ? (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text numberOfLines={3} style={[styles.body, { color: theme.textSecondary }]}>{nativeAd.body}</Text>
        </NativeAsset>
      ) : null}

      {nativeAd.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={[styles.cta, { color: theme.primary, borderColor: theme.border }]}>
            {nativeAd.callToAction}
          </Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  root: {
    paddingBottom: 14,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: FEED_GUTTER,
    // Leaves the top-right corner to the SDK's AdChoices mark.
    paddingRight: FEED_GUTTER + 28,
    paddingVertical: 10,
  },
  icon: {
    width: AVATAR.medium,
    height: AVATAR.medium,
    borderRadius: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
  },
  sponsored: {
    fontSize: 12.5,
    marginTop: 1,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: FEED_GUTTER,
    marginTop: 10,
  },
  cta: {
    marginHorizontal: FEED_GUTTER,
    marginTop: 12,
    minHeight: 44,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    fontSize: 14.5,
    fontWeight: '700',
    overflow: 'hidden',
  },
});

export default NativeAdCard;
