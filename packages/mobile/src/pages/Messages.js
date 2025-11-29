import React from 'react';
import { 
    View, 
    Text, 
    FlatList, 
    Image, 
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { dummyConnectionsData } from '../assets/assets';

const Messages = () => {
    const navigation = useNavigation();

    const renderUserItem = ({ item: user }) => (
        <View style={styles.userCard}>
            <Image 
                source={{ uri: user.profile_picture }} 
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.fullName}>{user.full_name}</Text>
                <Text style={styles.username}>@{user.username}</Text>
                <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('ChatBox', { userId: user._id })}
                >
                    <Text style={styles.actionIcon}>💬</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('Profile', { profileId: user._id })}
                >
                    <Text style={styles.actionIcon}>👁️</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>
                <Text style={styles.subtitle}>Talk to your friends and family</Text>
            </View>

            {/* Connected Users List */}
            <FlatList
                data={dummyConnectionsData}
                renderItem={renderUserItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
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
        marginRight: 12,
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
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'column',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIcon: {
        fontSize: 18,
    },
});

export default Messages;
