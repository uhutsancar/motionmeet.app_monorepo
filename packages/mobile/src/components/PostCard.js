import React, { useState } from 'react';
import { 
    View, 
    Text, 
    Image, 
    StyleSheet, 
    TouchableOpacity 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import moment from 'moment';

const PostCard = ({ post }) => {
    const navigation = useNavigation();
    const currentUser = useSelector((state) => state.user.value);
    const [likes, setLikes] = useState(post.likes_count || []);

    const handleLike = () => {
        // Toggle like
        if (likes.includes(currentUser?._id)) {
            setLikes(likes.filter(id => id !== currentUser?._id));
        } else {
            setLikes([...likes, currentUser?._id]);
        }
    };

    // Simple hashtag rendering - just highlight them in the text
    const renderContent = (content) => {
        if (!content) return null;
        return content;
    };

    return (
        <View style={styles.card}>
            {/* User Info */}
            <TouchableOpacity 
                style={styles.userInfo}
                onPress={() => navigation.navigate('Profile', { profileId: post.user?._id })}
            >
                <Image 
                    source={{ uri: post.user?.profile_picture }} 
                    style={styles.avatar}
                />
                <View style={styles.userTextContainer}>
                    <View style={styles.nameRow}>
                        <Text style={styles.userName}>{post.user?.full_name}</Text>
                        {post.user?.is_verified && (
                            <Text style={styles.verified}>✓</Text>
                        )}
                    </View>
                    <Text style={styles.userMeta}>
                        @{post.user?.username} · {moment(post.createdAt).fromNow()}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Content */}
            {post.content ? (
                <Text style={styles.content}>{renderContent(post.content)}</Text>
            ) : null}

            {/* Images */}
            {post.image_urls && post.image_urls.length > 0 && (
                <View style={styles.imageContainer}>
                    {post.image_urls.map((img, index) => (
                        <Image 
                            key={index}
                            source={{ uri: img }} 
                            style={[
                                styles.postImage,
                                post.image_urls.length === 1 && styles.singleImage
                            ]}
                            resizeMode="cover"
                        />
                    ))}
                </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <Text style={[
                        styles.actionIcon,
                        likes.includes(currentUser?._id) && styles.liked
                    ]}>
                        {likes.includes(currentUser?._id) ? '❤️' : '🤍'}
                    </Text>
                    <Text style={styles.actionCount}>{likes.length}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionCount}>12</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionIcon}>↗️</Text>
                    <Text style={styles.actionCount}>7</Text>
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
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    userTextContainer: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
    },
    verified: {
        color: '#3b82f6',
        marginLeft: 4,
        fontSize: 14,
    },
    userMeta: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
    },
    content: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        marginBottom: 12,
    },
    imageContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    postImage: {
        width: '48%',
        height: 150,
        borderRadius: 8,
    },
    singleImage: {
        width: '100%',
        height: 200,
    },
    actions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 12,
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionIcon: {
        fontSize: 16,
    },
    actionCount: {
        fontSize: 13,
        color: '#6b7280',
    },
    liked: {
        color: '#ef4444',
    },
});

export default PostCard;
