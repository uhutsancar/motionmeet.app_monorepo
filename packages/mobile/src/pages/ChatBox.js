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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { dummyMessagesData, dummyUserData } from '../assets/dummyData';

const ChatBox = ({ route, navigation }) => {
  const { user } = route.params;
  const [messages, setMessages] = useState(dummyMessagesData);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Auto scroll to bottom when messages change
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const sendMessage = () => {
    if (!text.trim() && !image) return;

    const newMessage = {
      _id: `msg_${Date.now()}`,
      from_user_id: dummyUserData._id,
      to_user_id: user._id,
      text: text.trim(),
      message_type: image ? 'image' : 'text',
      media_url: image ? image.uri : '',
      createdAt: new Date().toISOString(),
      seen: false,
    };

    setMessages([...messages, newMessage]);
    setText('');
    setImage(null);
  };

  const renderMessage = ({ item: message, index }) => {
    const isSentByMe = message.from_user_id === dummyUserData._id;
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );

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

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
          <Text style={styles.headerName}>{user.full_name}</Text>
          <Text style={styles.headerUsername}>@{user.username}</Text>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={sortedMessages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item._id || index.toString()}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

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
              onPress={sendMessage}
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
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerInfo: {
    marginLeft: 12,
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
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '75%',
  },
  sentMessage: {
    alignSelf: 'flex-end',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  sentBubble: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputContainer: {
    padding: 12,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    maxHeight: 100,
    paddingVertical: 8,
  },
  imageButton: {
    padding: 6,
  },
  selectedImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#c7d2fe',
  },
});

export default ChatBox;
