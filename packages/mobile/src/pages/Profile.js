import React, { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    Image, 
    ScrollView, 
    StyleSheet,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import Loading from '../components/Loading';
import PostCard from '../components/PostCard';
import { dummyPostsData } from '../assets/assets';

const { width } = Dimensions.get('window');

const Profile = ({ route, navigation }) => {
    const { profileId } = route.params || {};
    const currentUser = useSelector((state) => state.user.value);
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [activeTab, setActiveTab] = useState('post');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch user profile
        // For demo, using current user data
        const fetchProfile = async () => {
            setLoading(true);
            // Simulate API call
            setTimeout(() => {
                setUser(currentUser);
                setPosts(dummyPostsData);
                setLoading(false);
            }, 500);
        };
        fetchProfile();
    }, [profileId, currentUser]);

    if (loading) {
        return <Loading />;
    }

    if (!user) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>User not found</Text>
            </View>
        );
    }

    const tabs = ['post', 'media', 'likes'];

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Cover Photo */}
            <View style={styles.coverContainer}>
                {user.cover_photo ? (
                    <Image 
                        source={{ uri: user.cover_photo }}
                        style={styles.coverImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.coverPlaceholder} />
                )}
            </View>

            {/* Profile Card */}
            <View style={styles.profileCard}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <Image 
                        source={{ uri: user.profile_picture }}
                        style={styles.avatar}
                    />
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.fullName}>{user.full_name}</Text>
                        {user.is_verified && <Text style={styles.verified}>✓</Text>}
                    </View>
                    <Text style={styles.username}>
                        {user.username ? `@${user.username}` : 'Add a username'}
                    </Text>

                    {/* Edit Button - only show for own profile */}
                    {!profileId && (
                        <TouchableOpacity style={styles.editButton}>
                            <Text style={styles.editButtonText}>✏️ Edit</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bio */}
                {user.bio && (
                    <Text style={styles.bio}>{user.bio}</Text>
                )}

                {/* Meta Info */}
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaIcon}>📍</Text>
                        <Text style={styles.metaText}>
                            {user.location || 'Add location'}
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaIcon}>📅</Text>
                        <Text style={styles.metaText}>
                            Joined {moment(user.createdAt).format('MMM YYYY')}
                        </Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{posts.length}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user.followers?.length || 0}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user.following?.length || 0}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <View style={styles.tabs}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[
                                styles.tab,
                                activeTab === tab && styles.activeTab
                            ]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[
                                styles.tabText,
                                activeTab === tab && styles.activeTabText
                            ]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Content based on active tab */}
            <View style={styles.contentContainer}>
                {activeTab === 'post' && (
                    <View style={styles.postsSection}>
                        {posts.map((post) => (
                            <PostCard key={post._id} post={post} />
                        ))}
                    </View>
                )}

                {activeTab === 'media' && (
                    <View style={styles.mediaGrid}>
                        {posts
                            .filter(post => post.image_urls?.length > 0)
                            .flatMap(post => post.image_urls.map((url, idx) => (
                                <TouchableOpacity 
                                    key={`${post._id}-${idx}`}
                                    style={styles.mediaItem}
                                >
                                    <Image 
                                        source={{ uri: url }}
                                        style={styles.mediaImage}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            )))
                        }
                    </View>
                )}

                {activeTab === 'likes' && (
                    <View style={styles.emptyTab}>
                        <Text style={styles.emptyText}>No liked posts yet</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#6b7280',
    },
    coverContainer: {
        height: 150,
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#c7d2fe',
    },
    profileCard: {
        backgroundColor: '#fff',
        marginTop: -40,
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarContainer: {
        position: 'absolute',
        top: -50,
        left: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: '#fff',
    },
    userInfo: {
        marginTop: 60,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fullName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    verified: {
        marginLeft: 8,
        fontSize: 16,
        color: '#3b82f6',
    },
    username: {
        marginLeft: 8,
        fontSize: 15,
        color: '#6b7280',
    },
    editButton: {
        marginLeft: 'auto',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
    },
    editButtonText: {
        fontSize: 14,
        color: '#374151',
    },
    bio: {
        marginTop: 16,
        fontSize: 14,
        color: '#4b5563',
        lineHeight: 20,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 16,
        gap: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaIcon: {
        marginRight: 6,
    },
    metaText: {
        fontSize: 14,
        color: '#6b7280',
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    statLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
    },
    tabsContainer: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: '#6366f1',
    },
    tabText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
    },
    contentContainer: {
        padding: 16,
    },
    postsSection: {
        gap: 16,
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    mediaItem: {
        width: (width - 40) / 3,
        aspectRatio: 1,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
    },
    emptyTab: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: '#9ca3af',
    },
});

export default Profile;
