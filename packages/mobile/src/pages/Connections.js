import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Appbar, Button, Chip, Divider, Surface, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthContext } from "../context/AuthProvider";
import { useTranslation } from 'react-i18next';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { acceptConnectionRequest, unfollowUser } from '../api/endpoints';
import { useTheme } from '../context/ThemeContext';

const TABS = ['Followers', 'Following', 'Pending', 'Connections'];

const Connections = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const [currentTab, setCurrentTab] = useState('Followers');
  const [loading, setLoading] = useState(false);

  const { connections, pendingConnections, followers, following } = useSelector(
    (state) => state.connections
  );

  const tabData = {
    Followers: followers,
    Following: following,
    Pending: pendingConnections,
    Connections: connections,
  };

  const loadConnections = useCallback(async () => {
    try {
      const token = await getToken();
      dispatch(fetchConnections(token));
    } catch (error) {
      Alert.alert(t('common.error', 'Hata'), error.message);
    }
  }, [dispatch, getToken, t]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleUnfollow = async (userId) => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await unfollowUser(userId, token);
      if (data.success) {
        loadConnections();
      } else {
        Alert.alert(t('common.error', 'Hata'), data.message);
      }
    } catch (error) {
      Alert.alert(t('common.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptConnection = async (userId) => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await acceptConnectionRequest(userId, token);
      if (data.success) {
        loadConnections();
      } else {
        Alert.alert(t('common.error', 'Hata'), data.message);
      }
    } catch (error) {
      Alert.alert(t('common.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const currentData = (tabData[currentTab] || []).filter(
    (u) => u && u._id
  );

  const renderUser = ({ item: user }) => (
    <Surface
      style={{ marginHorizontal: 12, marginVertical: 4, borderRadius: 14, padding: 12, backgroundColor: theme.surface }}
      elevation={1}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {user.profile_picture ? (
          <Image
            source={{ uri: user.profile_picture }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            accessibilityLabel={user.full_name}
          />
        ) : (
          <Surface
            elevation={0}
            style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primarySoft }}
          >
            <Text style={{ color: theme.primary, fontWeight: '900' }}>
              {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
            </Text>
          </Surface>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" style={{ color: theme.text, fontWeight: '700' }}>
            {user.full_name}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.textMuted }}>
            @{user.username}
          </Text>
          {user.bio ? (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.textMuted, marginTop: 2 }}>
              {user.bio}
            </Text>
          ) : null}
        </View>
        <View style={{ gap: 6 }}>
          <Button
            mode="outlined"
            compact
            onPress={() => navigation.navigate('Profile', { userId: user._id })}
            style={{ borderRadius: 20 }}
            labelStyle={{ fontSize: 11, fontWeight: '700' }}
          >
            {t('common.view', 'Görüntüle')}
          </Button>
          {currentTab === 'Pending' && (
            <Button
              mode="contained"
              compact
              onPress={() => handleAcceptConnection(user._id)}
              disabled={loading}
              style={{ borderRadius: 20 }}
              labelStyle={{ fontSize: 11, fontWeight: '700' }}
            >
              {t('connections.accept', 'Kabul Et')}
            </Button>
          )}
          {(currentTab === 'Following' || currentTab === 'Connections') && (
            <Button
              mode="contained"
              compact
              onPress={() => navigation.navigate('ChatBox', { userId: user._id, user })}
              style={{ borderRadius: 20 }}
              labelStyle={{ fontSize: 11, fontWeight: '700' }}
              icon="chat-outline"
            >
              {t('common.message', 'Mesaj')}
            </Button>
          )}
          {currentTab === 'Following' && (
            <Button
              mode="text"
              compact
              onPress={() => handleUnfollow(user._id)}
              disabled={loading}
              labelStyle={{ fontSize: 11, fontWeight: '700' }}
            >
              {t('connections.unfollow', 'Unfollow')}
            </Button>
          )}
        </View>
      </View>
    </Surface>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content
          title="Connections"
          titleStyle={{ color: theme.text, fontWeight: '700' }}
        />
      </Appbar.Header>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
        {TABS.map((tab) => (
          <Surface key={tab} style={{ flex: 1, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', padding: 10 }} elevation={1}>
            <Text variant="titleMedium" style={{ color: theme.primary, fontWeight: '800' }}>
              {tabData[tab]?.length || 0}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.textMuted }}>
              {tab}
            </Text>
          </Surface>
        ))}
      </View>

      {/* Tab chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingBottom: 8, flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
          {TABS.map((tab) => (
            <Chip
              key={tab}
              selected={currentTab === tab}
              onPress={() => setCurrentTab(tab)}
              style={{ backgroundColor: currentTab === tab ? theme.primary : theme.surface }}
              textStyle={{ color: currentTab === tab ? '#fff' : theme.text, fontWeight: '600' }}
            >
              {tab}
            </Chip>
          ))}
        </View>
      </ScrollView>

      <Divider />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item._id}
          renderItem={renderUser}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 48, color: theme.textMuted }}>
              {t('connections.empty', 'Henüz kimse yok')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default Connections;
