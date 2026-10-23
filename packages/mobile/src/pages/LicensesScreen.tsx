import React from 'react';
import { StyleSheet, Linking, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Text, TouchableRipple } from 'react-native-paper';
import ScreenHeader from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { LOCATION_DATASET_ATTRIBUTION } from '@motionmeet/shared';
import { useTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { NavigationOnlyProps } from '../navigation/types';

/**
 * Third-party data notices.
 *
 * Both datasets MotionMeet ships require their source to stay visible in the
 * released app, so this screen is part of the licence obligation and not a
 * nicety - it must not be dropped from a production build. The full terms and
 * the outstanding questions are tracked in docs/LICENSES.md.
 */

interface Notice {
  title: string;
  body: string;
  attribution: string;
  links: Array<{ label: string; url: string }>;
}

const LicensesScreen = ({ navigation }: NavigationOnlyProps) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { horizontalPadding } = useResponsiveLayout();

  // Only the location dataset is listed. Its ODbL licence makes this notice a
  // condition of use, so it has to stay in released builds.
  const notices: Notice[] = [
    {
      title: t('licenses.locations_title', 'Place data'),
      body: t(
        'licenses.locations_body',
        'Country, region and city names used by the location picker come from the Countries States Cities Database, licensed under the Open Database License (ODbL) v1.0.',
      ),
      attribution: LOCATION_DATASET_ATTRIBUTION.text,
      links: [
        { label: 'github.com/dr5hn/countries-states-cities-database', url: LOCATION_DATASET_ATTRIBUTION.url },
        { label: 'ODbL v1.0', url: LOCATION_DATASET_ATTRIBUTION.licenseUrl },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader title={t('licenses.title', 'Data & licences')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingTop: 14, paddingBottom: 34, gap: 14 }}
      >
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 }}>
          {t('licenses.intro', 'MotionMeet uses open data from the projects below. Their licences require these notices to be shown.')}
        </Text>

        {notices.map((notice) => (
          <Surface
            key={notice.title}
            elevation={0}
            style={{ padding: 15, borderRadius: 12, gap: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface }}
          >
            <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '700' }}>{notice.title}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 }}>{notice.body}</Text>
            <View style={{ padding: 10, borderRadius: 9, backgroundColor: theme.surfaceLight }}>
              <Text selectable style={{ color: theme.textMuted, fontSize: 11, lineHeight: 16 }}>{notice.attribution}</Text>
            </View>
            <View style={{ gap: 5 }}>
              {notice.links.map((link) => (
                <TouchableRipple key={link.url} onPress={() => void Linking.openURL(link.url).catch(() => undefined)}>
                  <Text style={{ color: theme.primary, fontSize: 11.5, fontWeight: '700', paddingVertical: 3 }}>{link.label}</Text>
                </TouchableRipple>
              ))}
            </View>
          </Surface>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default LicensesScreen;
