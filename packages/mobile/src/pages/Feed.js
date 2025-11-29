import React, { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    FlatList, 
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    RefreshControl
} from 'react-native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import PostCard from '../components/PostCard';
import Loading from '../components/Loading';
import { dummyPostsData, dummyStoriesData, dummyRecentMessagesData } from '../assets/assets';

const Feed = ({ navigation }) => {
    const user = useSelector((state) => state.user.value);
    const [feeds, setFeeds] = useState([]);
    const [stories, setStories] = useState([]);
    const [recentMessages, setRecentMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFeeds = async () => {
        // Simulating API call
        setFeeds(dummyPostsData);
        setStories(dummyStoriesData);
        setRecentMessages(dummyRecentMessagesData);
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchFeeds();
        setRefreshing(false);
    };

    useEffect(() => {
        fetchFeeds();
    }, []);

    if (loading) {
        return <Loading />;
    }

    const renderStory = ({ item, index }) => (
        <TouchableOpacity 
            style={[
                styles.storyCard,
                { backgroundColor: item.background_color || '#4f46e5' }
            ]}
        >
            <Image 
                source={{ uri: item.user?.profile_picture }} 
                style={styles.storyAvatar}
            />
            {item.media_type === 'image' && item.media_url && (
                <Image 
                    source={{ uri: item.media_url }}
                    style={styles.storyMedia}
                    resizeMode="cover"
                />
            )}
            {item.content ? (
                <Text style={styles.storyContent} numberOfLines={2}>
                    {item.content}
                </Text>
            ) : null}
            <Text style={styles.storyTime}>{moment(item.createdAt).fromNow()}</Text>
        </TouchableOpacity>
    );

    const renderRecentMessage = ({ item }) => (
        <TouchableOpacity 
            style={styles.messageCard}
            onPress={() => navigation.navigate('ChatBox', { userId: item.from_user_id._id })}
        >
            <Image 
                source={{ uri: item.from_user_id?.profile_picture }} 
                style={styles.messageAvatar}
            />
            <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                    <Text style={styles.messageName}>{item.from_user_id?.full_name}</Text>
                    <Text style={styles.messageTime}>{moment(item.createdAt).fromNow()}</Text>
                </View>
                <View style={styles.messageFooter}>
                    <Text style={styles.messageText} numberOfLines={1}>
                        {item.text || 'Media'}
                    </Text>
                    {!item.seen && <View style={styles.unreadBadge}><Text style={styles.unreadText}>1</Text></View>}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScrollView 
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* Stories Bar */}
            <View style={styles.storiesSection}>
                <TouchableOpacity style={styles.createStory}>
                    <View style={styles.createStoryIcon}>
                        <Text style={styles.createStoryPlus}>+</Text>
                    </View>
                    <Text style={styles.createStoryText}>Create Story</Text>
                </TouchableOpacity>
                <FlatList
                    horizontal
                    data={stories}
                    renderItem={renderStory}
                    keyExtractor={(item) => item._id}
                    showsHorizontalScrollIndicator={false}
                    style={styles.storiesList}
                />
            </View>

            {/* Posts and Recent Messages */}
            <View style={styles.mainContent}>
                {/* Posts */}
                <View style={styles.postsSection}>
                    {feeds.map((post) => (
                        <PostCard key={post._id} post={post} />
                    ))}
                </View>

                {/* Sponsored Card */}
                <View style={styles.sponsoredCard}>
                    <Text style={styles.sponsoredTitle}>Sponsored</Text>
                    <Image 
                        source={{ uri: 'https://via.placeholder.com/300x150' }}
                        style={styles.sponsoredImage}
                        resizeMode="cover"
                    />
                    <Text style={styles.sponsoredName}>Email marketing</Text>
                    <Text style={styles.sponsoredDesc}>
                        Supercharge your marketing with a powerful, easy-to-use platform built for results.
                    </Text>
                </View>

                {/* Recent Messages */}
                <View style={styles.messagesSection}>
                    <Text style={styles.sectionTitle}>Recent Messages</Text>
                    {recentMessages.map((message) => (
                        <View key={message._id}>
                            {renderRecentMessage({ item: message })}
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    storiesSection: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingLeft: 16,
    },
    createStory: {
        width: 100,
        height: 140,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#6366f1',
        backgroundColor: '#eef2ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    createStoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    createStoryPlus: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
    },
    createStoryText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    storiesList: {
        paddingRight: 16,
    },
    storyCard: {
        width: 100,
        height: 140,
        borderRadius: 12,
        marginRight: 12,
        padding: 8,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    storyAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#fff',
    },
    storyMedia: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 12,
        opacity: 0.7,
    },
    storyContent: {
        color: '#fff',
        fontSize: 10,
        opacity: 0.8,
    },
    storyTime: {
        color: '#fff',
        fontSize: 10,
        alignSelf: 'flex-end',
    },
    mainContent: {
        padding: 16,
    },
    postsSection: {
        marginBottom: 16,
    },
    sponsoredCard: {
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
    sponsoredTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    sponsoredImage: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
    },
    sponsoredName: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 4,
    },
    sponsoredDesc: {
        fontSize: 12,
        color: '#9ca3af',
    },
    messagesSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    messageCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
    },
    messageAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
    },
    messageContent: {
        flex: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    messageName: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1f2937',
    },
    messageTime: {
        fontSize: 10,
        color: '#9ca3af',
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    messageText: {
        fontSize: 12,
        color: '#6b7280',
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: '#6366f1',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
});

export default Feed;
