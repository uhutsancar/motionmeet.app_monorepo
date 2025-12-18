import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@clerk/clerk-expo';
import { useDispatch, useSelector } from 'react-redux';
import { getMessages, sendMessage as sendMessageAPI } from '../api/endpoints';
import { setMessages, addMessage } from '../features/messages/messagesSlice';

const ChatBox = ({ route, navigation }) => {
  const { userId, user: routeUser } = route.params;
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.value);
  const connections = useSelector((state) => state.connections.connections);
  const { messages } = useSelector((state) => state.messages);
  
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [user, setUser] = useState(routeUser);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Find user from connections if not provided
    if (!user && connections.length > 0) {
      const foundUser = connections.find((conn) => conn._id === userId);
      setUser(foundUser);
    }
  }, [connections, userId, user]);

  useEffect(() => {
    const initialLoad = async () => {
      await loadMessages();
      setInitialLoading(false);
    };
    initialLoad();

    // Poll for new messages every 3 seconds
    const pollInterval = setInterval(() => {
      loadMessages();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [userId]);

  useEffect(() => {
    // Auto scroll to bottom when messages change
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const loadMessages = async () => {
    try {
      const token = await getToken();
      const data = await getMessages(userId, token);
      if (data.success) {
        dispatch(setMessages(data.messages));
      }
    } catch (error) {
      // Silent fail for polling
      console.error('Failed to load messages:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const sendMessageHandler = async () => {
    if (!text.trim() && !image) return;

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('to_user_id', userId);
      formData.append('text', text.trim());
      
      if (image) {
        formData.append('image', {
          uri: image.uri,
          type: 'image/jpeg',
          name: 'message_image.jpg',
        });
      }

      const data = await sendMessageAPI(formData, token);
      if (data.success) {
        dispatch(addMessage(data.message));
        setText('');
        setImage(null);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const renderMessage = ({ item: message }) => {
    const isSentByMe = message.to_user_id === userId;

    return (
      <View 
        style={[
          styles.messageContainer,
          isSentByMe ? styles.sentMessage : styles.receivedMessage
        ]}
      >
        <View 
          style={[
            styles.messageBubble,
            isSentByMe ? styles.sentBubble : styles.receivedBubble
          ]}
        >
          {message.message_type === 'image' && message.media_url && (
            <Image 
              source={{ uri: message.media_url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          {message.text ? (
            <Text style={[
              styles.messageText,
              { color: isSentByMe ? '#fff' : '#374151' }
            ]}>
              {message.text}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        
        <Image 
          source={{ uri: user.profile_picture }}
          style={styles.headerAvatar}
        />
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{user.full_name}</Text>
          <Text style={styles.headerUsername} numberOfLines={1}>@{user.username}</Text>
        </View>
      </View>

      {/* Messages List */}
      {initialLoading && messages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity 
              style={styles.imageButton}
              onPress={pickImage}
            >
              {image ? (
                <Image 
                  source={{ uri: image.uri }}
                  style={styles.selectedImage}
                />
              ) : (
                <Ionicons name="image-outline" size={24} color="#6b7280" />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!text.trim() && !image) && styles.sendButtonDisabled
              ]}
              onPress={sendMessageHandler}
              disabled={!text.trim() && !image}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 64,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
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
    color: '#111827',
  },
  headerUsername: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    marginVertical: 4,
  },
  sentMessage: {
    alignItems: 'flex-end',
  },
  receivedMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  sentBubble: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    paddingVertical: 4,
  },
  imageButton: {
    padding: 4,
  },
  selectedImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatBox;
