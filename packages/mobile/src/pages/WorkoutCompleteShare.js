import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const WorkoutCompleteShare = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Mock
  const workoutCount = 1;
  const exercises = [
    { id: 1, name: 'Bicep Curl (Dambıl)' },
    { id: 2, name: 'Hammer Curl (Dambıl)' },
    { id: 3, name: 'Preacher Curl (Dambıl)' },
    { id: 4, name: 'Preacher Curl (Makine)' }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
       <View style={styles.header}>
          <Text style={styles.mainTitle}>{t('workout.nice', 'Güzeldi!')}</Text>
          <Text style={styles.subTitle}>{t('workout.count', 'Bu {{count}}. antrenmanınız', { count: workoutCount })}</Text>
          <Ionicons name="party-horn" size={24} color="#fcd34d" style={{ position: 'absolute', right: 20, top: 10 }} />
       </View>

       <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}>
          {/* Card Preview */}
          <View style={styles.cardPreview}>
             <Text style={styles.workoutName}>Biceps</Text>
             
             <View style={styles.statsRow}>
               <View style={styles.statItem}>
                 <Text style={styles.statLabel}>{t('statistics.duration', 'Süre')}</Text>
                 <Text style={styles.statValue}>2min</Text>
               </View>
               <View style={styles.statItem}>
                 <Text style={styles.statLabel}>{t('statistics.volume', 'Hacim')}</Text>
                 <Text style={styles.statValue}>420 kg</Text>
               </View>
               <View style={styles.statItem}>
                 <Text style={styles.statLabel}>{t('statistics.sets', 'Set')}</Text>
                 <Text style={styles.statValue}>4</Text>
               </View>
             </View>

             <View style={styles.exercisesList}>
                {exercises.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                     <Text style={styles.multiplier}>1x</Text>
                     <Text style={styles.exName}>{ex.name}</Text>
                  </View>
                ))}
             </View>

             <View style={styles.watermarkRow}>
                <Text style={styles.brandTitle}>MOTIONMEET</Text>
                <Text style={styles.usernameStamp}>@uhutsancar</Text>
             </View>
          </View>
          
          <View style={styles.dotsRow}>
             {[1,2,3,4,5].map(i => <View key={i} style={[styles.dot, i===3 && styles.dotActive]} />)}
          </View>

          <Text style={styles.shareText}>Antrenmanı paylaşın - @motionmeet hesabımızı etiketleyin</Text>

          {/* Share Bubbles */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shareBubbles}>
             <View style={styles.shareAction}>
                <TouchableOpacity style={[styles.bubble, { backgroundColor: theme.surface }]}>
                   <Ionicons name="color-palette-outline" size={24} color={theme.textMuted} />
                </TouchableOpacity>
                <Text style={styles.bubbleText}>Arka plan</Text>
             </View>

             <View style={styles.shareAction}>
                <TouchableOpacity style={[styles.bubble, { backgroundColor: '#ec4899', borderColor: '#ec4899' }]}>
                   <Ionicons name="logo-instagram" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.bubbleText}>Hikayeler</Text>
             </View>

             <View style={styles.shareAction}>
                <TouchableOpacity style={[styles.bubble, { backgroundColor: theme.surface }]}>
                   <Feather name="upload" size={22} color={theme.textMuted} />
                </TouchableOpacity>
                <Text style={styles.bubbleText}>Daha fazla</Text>
             </View>

             <View style={styles.shareAction}>
                <TouchableOpacity style={[styles.bubble, { backgroundColor: theme.surface }]}>
                   <Ionicons name="link-outline" size={24} color={theme.textMuted} />
                </TouchableOpacity>
                <Text style={styles.bubbleText}>Bağlantı</Text>
             </View>
          </ScrollView>
       </ScrollView>

       <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('MainTabs')}>
             <Text style={styles.doneBtnText}>{t('common.done', 'Bitti')}</Text>
          </TouchableOpacity>
       </View>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { alignItems: 'center', marginTop: 10, paddingBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: theme.text },
  subTitle: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
  cardPreview: { 
     backgroundColor: '#0a1128', borderRadius: 24, padding: 24, paddingBottom: 20,
     borderWidth: 1, borderColor: '#1e293b'
  },
  workoutName: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  statItem: {},
  statLabel: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  exercisesList: { gap: 10, marginBottom: 30 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  multiplier: { color: '#60a5fa', fontWeight: 'bold', width: 20 },
  exName: { color: '#f8fafc', fontSize: 15 },
  watermarkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  brandTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  usernameStamp: { color: '#fff', fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.border },
  dotActive: { backgroundColor: '#3b82f6', width: 6, height: 6 },
  shareText: { textAlign: 'center', color: theme.text, fontSize: 15, paddingHorizontal: 40, lineHeight: 22 },
  shareBubbles: { flexDirection: 'row', paddingVertical: 30, gap: 16 },
  shareAction: { alignItems: 'center' },
  bubble: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
  bubbleText: { color: theme.textMuted, fontSize: 12, marginTop: 8 },
  bottomBar: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  doneBtn: { backgroundColor: '#3b82f6', borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default WorkoutCompleteShare;
