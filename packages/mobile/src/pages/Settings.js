import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClerk } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const Settings = () => {
  const { signOut } = useClerk();
  const { t, i18n } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();

  const changeLanguage = async (lng) => {
    await i18n.changeLanguage(lng);
  };

  const isTr = i18n.language.startsWith('tr');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('settings.appearance').toUpperCase()}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                        <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={theme.primary} />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.theme')}</Text>
                </View>
                <View style={[styles.toggleContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <TouchableOpacity 
                        onPress={() => !isDark && toggleTheme()}
                        style={[styles.toggleBtn, !isDark && styles.toggleBtnActive, !isDark && { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                        <Text style={[styles.toggleText, { color: isDark ? theme.textMuted : theme.primary }]}>{t('settings.light')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => isDark && toggleTheme()}
                        style={[styles.toggleBtn, isDark && styles.toggleBtnActive, isDark && { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                        <Text style={[styles.toggleText, { color: !isDark ? theme.textMuted : theme.primary }]}>{t('settings.dark')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                        <Ionicons name="globe" size={20} color={theme.primary} />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.language')}</Text>
                </View>
                <View style={[styles.toggleContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <TouchableOpacity 
                        onPress={() => changeLanguage('en')}
                        style={[styles.toggleBtn, !isTr && styles.toggleBtnActive, !isTr && { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                        <Text style={[styles.toggleText, { color: isTr ? theme.textMuted : theme.primary }]}>EN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => changeLanguage('tr')}
                        style={[styles.toggleBtn, isTr && styles.toggleBtnActive, isTr && { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                        <Text style={[styles.toggleText, { color: !isTr ? theme.textMuted : theme.primary }]}>TR</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 24 }]}>
            <TouchableOpacity style={styles.row} onPress={() => signOut()}>
                <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                        <Ionicons name="log-out" size={20} color="#ef4444" />
                    </View>
                    <Text style={[styles.rowLabel, { color: '#ef4444' }]}>{t('settings.logout')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default Settings;
