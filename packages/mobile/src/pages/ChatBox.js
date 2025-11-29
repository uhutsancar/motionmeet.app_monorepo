import React, { useEffect, useRef, useState } from 'react';
import { 
    View, 
    Text, 
    Image, 
    TextInput,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useSelector } from 'react-redux';
import { dummyMessagesData, dummyUserData } from '../assets/assets';

const ChatBox = ({ route, navigation }) => {
    const { userId } = route.params || {};
    const currentUser = useSelector((state) => state.user.value);
    const [messages, setMessages] = useState(dummyMessagesData);
    const [text, setText] = useState('');
    const [user, setUser] = useState(dummyUserData);
    const flatListRef = useRef(null);

    useEffect(() => {
        // In a real app, fetch user and messages based on userId
        // For now, using dummy data
    }, [userId]);

    const sendMessage = () => {
        if (!text.trim()) return;
        
        const newMessage = {
            _id: Date.now().toString(),
            from_user_id: currentUser?._id,
            to_user_id: user._id,
            text: text.trim(),
            message_type: 'text',
            media_url: '',
            seen: false,
            createdAt: new Date().toISOString(),
        };
        
        setMessages([...messages, newMessage]);
        setText('');
    };

    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    const renderMessage = ({ item }) => {
        const isOwnMessage = item.from_user_id === currentUser?._id;
        
        return (
            <View style={[
                styles.messageContainer,
                isOwnMessage ? styles.ownMessage : styles.otherMessage
            ]}>
                <View style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownBubble : styles.otherBubble
                ]}>
                    {item.message_type === 'image' && item.media_url && (
                        <Image 
                            source={{ uri: item.media_url }}
                            style={styles.messageImage}
                            resizeMode="cover"
                        />
                    )}
                    {item.text ? (
                        <Text style={[
                            styles.messageText,
                            isOwnMessage && styles.ownMessageText
                        ]}>
                            {item.text}
                        </Text>
                    ) : null}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Image 
                    source={{ uri: user.profile_picture }} 
                    style={styles.headerAvatar}
                />
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName}>{user.full_name}</Text>
                    <Text style={styles.headerUsername}>@{user.username}</Text>
                </View>
            </View>

            {/* Messages List */}
            <FlatList
                ref={flatListRef}
                data={sortedMessages}
                renderItem={renderMessage}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            />

            {/* Input Bar */}
            <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#9ca3af"
                        value={text}
                        onChangeText={setText}
                        onSubmitEditing={sendMessage}
                        returnKeyType="send"
                    />
                    <TouchableOpacity style={styles.attachButton}>
                        <Text style={styles.attachIcon}>📷</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.sendButton}
                        onPress={sendMessage}
                    >
                        <Text style={styles.sendIcon}>→</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#eef2ff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backButton: {
        marginRight: 12,
    },
    backIcon: {
        fontSize: 24,
        color: '#374151',
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    headerUsername: {
        fontSize: 13,
        color: '#6b7280',
    },
    messagesList: {
        padding: 16,
        paddingBottom: 8,
    },
    messageContainer: {
        marginBottom: 12,
    },
    ownMessage: {
        alignItems: 'flex-end',
    },
    otherMessage: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    ownBubble: {
        backgroundColor: '#6366f1',
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
    },
    messageImage: {
        width: 200,
        height: 150,
        borderRadius: 8,
        marginBottom: 8,
    },
    messageText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 20,
    },
    ownMessageText: {
        color: '#fff',
    },
    inputContainer: {
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#1f2937',
        paddingVertical: 8,
    },
    attachButton: {
        padding: 8,
    },
    attachIcon: {
        fontSize: 20,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    sendIcon: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default ChatBox;
