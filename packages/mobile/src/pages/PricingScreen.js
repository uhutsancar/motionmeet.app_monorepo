import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClerk } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import api from '../api/client';

const PricingScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { session } = useClerk();
  const dispatch = useDispatch();
  
  const currentUser = useSelector((state) => state.user.value);
  
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await api.get('/api/plans');
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not fetch plans.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    if (upgrading) return;
    setUpgrading(planId);
    try {
      const token = await session?.getToken();
      if (!token) throw new Error("No token");

      const { data } = await api.post(
        '/api/plans/update',
        { planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        Alert.alert('Success', 'Your plan has been upgraded successfully!');
        dispatch(fetchUser(token));
      } else {
        Alert.alert('Error', data.message || 'Failed to upgrade plan.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to change plan.');
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.surface }]}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Plans & Features</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.subText, { color: theme.textMuted }]}>
          Choose the best plan for your fitness journey. Ensure maximum performance with our premium features.
        </Text>

        {plans.map((plan) => {
          const isCurrent = currentUser?.plan?._id === plan._id;
          const isPremium = plan.name === 'Premium' || plan.name === 'Elite';
          const isPro = plan.name === 'Pro';

          return (
            <View 
              key={plan._id} 
              style={[
                styles.planCard, 
                { backgroundColor: theme.surface, borderColor: theme.border },
                isPremium && { borderColor: theme.primary, borderWidth: 2 }
              ]}
            >
              {isPremium && (
                <View style={[styles.popularBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.badgeText}>POPULAR</Text>
                </View>
              )}
              
              <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
              <Text style={[styles.planPrice, { color: isPremium ? theme.primary : theme.text }]}>
                {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureRow}>
                  <Ionicons name={plan.features.max_workouts_per_month !== -1 ? 'checkmark-circle' : 'infinite'} size={20} color={theme.primary} />
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                    {plan.features.max_workouts_per_month === -1 ? 'Unlimited' : plan.features.max_workouts_per_month} Workouts/mo
                  </Text>
                </View>
                <View style={styles.featureRow}>
                   <Ionicons name={plan.features.max_routines !== -1 ? 'checkmark-circle' : 'infinite'} size={20} color={theme.primary} />
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                    {plan.features.max_routines === -1 ? 'Unlimited' : plan.features.max_routines} Routines
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name={plan.features.can_message_anyone ? 'checkmark-circle' : 'close-circle'} size={20} color={plan.features.can_message_anyone ? theme.primary : theme.textMuted} />
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>Direct Messaging</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name={plan.features.premium_content_access ? 'checkmark-circle' : 'close-circle'} size={20} color={plan.features.premium_content_access ? theme.primary : theme.textMuted} />
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>Premium Analytics & Content</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[
                  styles.btn, 
                  isCurrent ? { backgroundColor: theme.surfaceLight } : { backgroundColor: theme.primary }
                ]}
                disabled={isCurrent || upgrading === plan._id}
                onPress={() => handleUpgrade(plan._id)}
              >
                {upgrading === plan._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[
                      styles.btnText, 
                      isCurrent ? { color: theme.textMuted } : { color: '#fff' }
                  ]}>
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 40 }}/>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: 20 },
  subText: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  planCard: { 
    borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4
  },
  popularBadge: { position: 'absolute', top: -12, right: 30, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planName: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  planPrice: { fontSize: 36, fontWeight: '900', marginBottom: 20 },
  featuresList: { marginBottom: 24, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 15, fontWeight: '500' },
  btn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  btnText: { fontSize: 16, fontWeight: '800' }
});

export default PricingScreen;
