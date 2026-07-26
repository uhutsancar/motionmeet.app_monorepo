import React, { useCallback, useState, useEffect } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthContext } from "../context/AuthProvider";
import { useTheme } from '../context/ThemeContext';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import { getPlans, updatePlan } from '../api/endpoints';
import { useTranslation } from 'react-i18next';

const PricingScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.value);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  const fetchPlans = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await getPlans(token);
      if (data.success) setPlans(data.plans);
    } catch (err) {
      console.error(err);
      Alert.alert(t('common.error', 'Error'), t('pricing_page.load_error', 'Could not fetch plans.'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleUpgrade = async (planId) => {
    if (upgrading) return;
    setUpgrading(planId);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      const data = await updatePlan(planId, token);
      if (data.success) {
        Alert.alert(t('common.success', 'Success'), t('pricing_page.upgrade_success', 'Your plan has been updated.'));
        dispatch(fetchUser(token));
      } else {
        Alert.alert(t('common.error', 'Error'), data.message || t('pricing_page.upgrade_err', 'Failed to update plan.'));
      }
    } catch (err) {
      console.error(err);
      Alert.alert(t('common.error', 'Error'), t('pricing_page.upgrade_err', 'Failed to update plan.'));
    } finally {
      setUpgrading(null);
    }
  };

  const FEATURES = (plan) => [
    {
      icon: plan.features.max_workouts_per_month !== -1 ? 'checkmark-circle' : 'infinite',
      label: plan.features.max_workouts_per_month === -1
        ? t('pricing_page.unlimited_workouts', 'Unlimited workouts')
        : t('pricing_page.workout_limit', { count: plan.features.max_workouts_per_month, defaultValue: '{{count}} workouts per month' }),
      ok: true,
    },
    {
      icon: plan.features.max_routines !== -1 ? 'checkmark-circle' : 'infinite',
      label: plan.features.max_routines === -1
        ? t('pricing_page.unlimited_routines', 'Unlimited routines')
        : t('pricing_page.routine_limit', { count: plan.features.max_routines, defaultValue: '{{count}} routines' }),
      ok: true,
    },
    {
      icon: plan.features.can_message_anyone ? 'checkmark-circle' : 'close-circle',
      label: t('pricing_page.direct_messaging', 'Direct messaging'),
      ok: plan.features.can_message_anyone,
    },
    {
      icon: plan.features.premium_content_access ? 'checkmark-circle' : 'close-circle',
      label: t('pricing_page.premium_analytics', 'Premium analytics and content'),
      ok: plan.features.premium_content_access,
    },
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('pricing_page.plans_title', 'Plans & Features')} titleStyle={{ color: theme.text, fontWeight: '700' }} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22, color: theme.textMuted }}>
          {t('pricing_page.production_subtitle', 'Only plans currently available in MotionMeet are shown here.')}
        </Text>

        {plans.map((plan) => {
          const isCurrent = currentUser?.plan?._id === plan._id;
          const isPremium = plan.name === 'Premium' || plan.name === 'Elite';
          const isPaid = plan.price > 0 || plan.name !== 'Free';

          return (
            <Card
              key={plan._id}
              mode="contained"
              style={{
                borderRadius: 24, padding: 24, marginBottom: 20,
                borderWidth: isPremium ? 2 : 1,
                borderColor: isPremium ? theme.primary : theme.border,
                backgroundColor: theme.surface, elevation: 4,
              }}
            >
              {isPremium && (
                <View style={{
                  position: 'absolute', top: -12, right: 30,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: theme.primary,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>POPULAR</Text>
                </View>
              )}

              <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 6, color: theme.text }}>{plan.name}</Text>
              <Text style={{ fontSize: 36, fontWeight: '900', marginBottom: 20, color: isPremium ? theme.primary : theme.text }}>
                {plan.price === 0
                  ? t('pricing_page.free_name', 'Free')
                  : new Intl.NumberFormat(i18n.resolvedLanguage || 'en', {
                    style: 'currency',
                    currency: plan.currency || 'TRY',
                    maximumFractionDigits: 2,
                  }).format(plan.price)}
              </Text>

              <View style={{ marginBottom: 24, gap: 12 }}>
                {FEATURES(plan).map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={f.icon} size={20} color={f.ok ? theme.primary : theme.textMuted} />
                    <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>{f.label}</Text>
                  </View>
                ))}
              </View>

              <Button
                mode="contained"
                style={{ borderRadius: 16 }}
                contentStyle={{ minHeight: 52 }}
                labelStyle={{ fontSize: 16, fontWeight: '800' }}
                buttonColor={isCurrent || isPaid ? theme.surfaceLight : theme.primary}
                textColor={isCurrent || isPaid ? theme.textMuted : '#fff'}
                disabled={isCurrent || isPaid || upgrading === plan._id}
                loading={upgrading === plan._id}
                onPress={() => handleUpgrade(plan._id)}
              >
                {isCurrent
                  ? t('pricing_page.current_plan', 'Current plan')
                  : isPaid
                    ? t('pricing_page.checkout_soon', 'Checkout coming soon')
                    : t('pricing_page.select_plan', 'Select plan')}
              </Button>
            </Card>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default PricingScreen;
