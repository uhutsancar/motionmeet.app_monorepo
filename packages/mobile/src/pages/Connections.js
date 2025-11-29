import React, { useState } from 'react';
import { 
    View, 
    Text, 
    FlatList, 
    Image, 
    StyleSheet,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
    dummyConnectionsData, 
    dummyFollowersData, 
    dummyFollowingData,
    dummyPendingConnectionsData 
} from '../assets/assets';

const Connections = () => {
    const navigation = useNavigation();
    const [currentTab, setCurrentTab] = useState('Followers');

    const dataArray = [
        { label: 'Followers', value: dummyFollowersData, icon: '👥' },
        { label: 'Following', value: dummyFollowingData, icon: '✓' },
        { label: 'Pending', value: dummyPendingConnectionsData, icon: '⏳' },
        { label: 'Connections', value: dummyConnectionsData, icon: '🔗' },
    ];

    const currentData = dataArray.find(item => item.label === currentTab)?.value || [];

    const renderCountCard = ({ item, index }) => (
        <View style={styles.countCard} key={index}>
            <Text style={styles.countNumber}>{item.value.length}</Text>
            <Text style={styles.countLabel}>{item.label}</Text>
        </View>
    );

    const renderUserCard = ({ item: user }) => (
        <View style={styles.userCard}>
            <Image 
                source={{ uri: user.profile_picture }} 
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.fullName}>{user.full_name}</Text>
                <Text style={styles.username}>@{user.username}</Text>
                <Text style={styles.bio} numberOfLines={1}>
                    {user.bio?.slice(0, 30)}...
                </Text>
                
                <View style={styles.actions}>
                    <TouchableOpacity 
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('Profile', { profileId: user._id })}
                    >
                        <Text style={styles.primaryButtonText}>View Profile</Text>
                    </TouchableOpacity>
                    
                    {currentTab === 'Following' && (
                        <TouchableOpacity style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Unfollow</Text>
                        </TouchableOpacity>
                    )}
                    
                    {currentTab === 'Pending' && (
                        <TouchableOpacity style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Pending</Text>
                        </TouchableOpacity>
                    )}
                    
                    {currentTab === 'Connections' && (
                        <TouchableOpacity 
                            style={styles.messageButton}
                            onPress={() => navigation.navigate('ChatBox', { userId: user._id })}
                        >
                            <Text style={styles.messageButtonText}>💬 Message</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Connections</Text>
                <Text style={styles.subtitle}>Manage your network and discover new connections</Text>
            </View>

            {/* Count Cards */}
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.countsContainer}
            >
                {dataArray.map((item, index) => renderCountCard({ item, index }))}
            </ScrollView>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabs}
                >
                    {dataArray.map((tab) => (
                        <TouchableOpacity 
                            key={tab.label}
                            style={[
                                styles.tab,
                                currentTab === tab.label && styles.activeTab
                            ]}
                            onPress={() => setCurrentTab(tab.label)}
                        >
                            <Text style={styles.tabIcon}>{tab.icon}</Text>
                            <Text style={[
                                styles.tabText,
                                currentTab === tab.label && styles.activeTabText
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* User Cards */}
            <View style={styles.usersList}>
                {currentData.map((user) => (
                    <View key={user._id}>
                        {renderUserCard({ item: user })}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        padding: 24,
        paddingTop: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    countsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    countCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        minWidth: 100,
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    countNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    countLabel: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    tabsContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    tabs: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 4,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        marginRight: 4,
    },
    activeTab: {
        backgroundColor: '#f3f4f6',
    },
    tabIcon: {
        marginRight: 6,
        fontSize: 14,
    },
    tabText: {
        fontSize: 14,
        color: '#64748b',
    },
    activeTabText: {
        color: '#1f2937',
        fontWeight: '500',
    },
    usersList: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 16,
    },
    userInfo: {
        flex: 1,
    },
    fullName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    username: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    bio: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: '#6366f1',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#374151',
        fontSize: 14,
    },
    messageButton: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    messageButtonText: {
        color: '#374151',
        fontSize: 14,
    },
});

export default Connections;
