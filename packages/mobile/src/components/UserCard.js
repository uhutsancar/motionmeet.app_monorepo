import React from 'react';
import { 
    View, 
    Text, 
    Image, 
    StyleSheet, 
    TouchableOpacity 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';

const UserCard = ({ user }) => {
    const navigation = useNavigation();
    const currentUser = useSelector((state) => state.user.value);

    const handleFollow = async () => {
        // Follow logic would go here
        console.log('Follow user:', user._id);
    };

    const handleConnectionRequest = async () => {
        // Connection request logic would go here
        console.log('Connection request to:', user._id);
    };

    const isFollowing = currentUser?.following?.includes(user._id);
    const isConnected = currentUser?.connections?.includes(user._id);

    return (
        <View style={styles.card}>
            <View style={styles.content}>
                <Image 
                    source={{ uri: user.profile_picture }} 
                    style={styles.avatar}
                />
                <Text style={styles.fullName}>{user.full_name}</Text>
                {user.username && (
                    <Text style={styles.username}>@{user.username}</Text>
                )}
                {user.bio && (
                    <Text style={styles.bio} numberOfLines={2}>
                        {user.bio}
                    </Text>
                )}
            </View>

            <View style={styles.meta}>
                <View style={styles.metaItem}>
                    <Text style={styles.metaIcon}>📍</Text>
                    <Text style={styles.metaText}>{user.location || 'Unknown'}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Text style={styles.metaText}>{user.followers?.length || 0} Followers</Text>
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity 
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={handleFollow}
                    disabled={isFollowing}
                >
                    <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                        {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.connectButton}
                    onPress={isConnected ? 
                        () => navigation.navigate('ChatBox', { userId: user._id }) : 
                        handleConnectionRequest
                    }
                >
                    <Text style={styles.connectButtonText}>
                        {isConnected ? '💬' : '+'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        width: 280,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    content: {
        alignItems: 'center',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginBottom: 12,
    },
    fullName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        textAlign: 'center',
    },
    username: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    bio: {
        fontSize: 13,
        color: '#4b5563',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 8,
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    metaIcon: {
        marginRight: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#4b5563',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    followButton: {
        flex: 1,
        backgroundColor: '#6366f1',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    followingButton: {
        backgroundColor: '#e5e7eb',
    },
    followButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    followingButtonText: {
        color: '#6b7280',
    },
    connectButton: {
        width: 44,
        height: 44,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectButtonText: {
        fontSize: 18,
        color: '#6b7280',
    },
});

export default UserCard;
