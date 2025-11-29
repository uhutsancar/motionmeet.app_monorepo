import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    Image, 
    ScrollView, 
    StyleSheet,
    TouchableOpacity,
    Alert
} from 'react-native';
import { useSelector } from 'react-redux';

const CreatePost = ({ navigation }) => {
    const user = useSelector((state) => state.user.value);
    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSubmit = () => {
        if (!content.trim() && images.length === 0) {
            Alert.alert('Error', 'Please add some content or images');
            return;
        }

        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            Alert.alert('Success', 'Post created successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        }, 1000);
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const selectImages = () => {
        // In a real app, you'd use expo-image-picker here
        Alert.alert('Info', 'Image picker would open here in a real app');
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Create Post</Text>
                <Text style={styles.subtitle}>Share your thoughts with the world</Text>
            </View>

            {/* Post Form */}
            <View style={styles.formCard}>
                {/* User Info */}
                <View style={styles.userInfo}>
                    <Image 
                        source={{ uri: user?.profile_picture }}
                        style={styles.avatar}
                    />
                    <View>
                        <Text style={styles.userName}>{user?.full_name}</Text>
                        <Text style={styles.userHandle}>@{user?.username}</Text>
                    </View>
                </View>

                {/* Text Input */}
                <TextInput
                    style={styles.textInput}
                    placeholder="What's happening?"
                    placeholderTextColor="#9ca3af"
                    multiline
                    value={content}
                    onChangeText={setContent}
                    maxLength={500}
                />

                {/* Character Count */}
                <Text style={styles.charCount}>{content.length}/500</Text>

                {/* Selected Images */}
                {images.length > 0 && (
                    <View style={styles.imagesContainer}>
                        {images.map((image, index) => (
                            <View key={index} style={styles.imageWrapper}>
                                <Image 
                                    source={{ uri: image.uri }}
                                    style={styles.selectedImage}
                                />
                                <TouchableOpacity 
                                    style={styles.removeImageBtn}
                                    onPress={() => removeImage(index)}
                                >
                                    <Text style={styles.removeImageText}>×</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsBar}>
                    <TouchableOpacity 
                        style={styles.addImageBtn}
                        onPress={selectImages}
                    >
                        <Text style={styles.addImageText}>📷 Add Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.publishBtn,
                            loading && styles.publishBtnDisabled
                        ]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <Text style={styles.publishBtnText}>
                            {loading ? 'Publishing...' : 'Publish Post'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tips */}
            <View style={styles.tipsCard}>
                <Text style={styles.tipsTitle}>💡 Tips for a great post</Text>
                <Text style={styles.tipItem}>• Use hashtags to reach more people</Text>
                <Text style={styles.tipItem}>• Add images to make your post stand out</Text>
                <Text style={styles.tipItem}>• Keep it engaging and authentic</Text>
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
    formCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    userHandle: {
        fontSize: 14,
        color: '#6b7280',
    },
    textInput: {
        fontSize: 16,
        color: '#1f2937',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'right',
        marginTop: 8,
    },
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
    },
    imageWrapper: {
        position: 'relative',
    },
    selectedImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    removeImageBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeImageText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    actionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    addImageBtn: {
        padding: 8,
    },
    addImageText: {
        fontSize: 14,
        color: '#6b7280',
    },
    publishBtn: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    publishBtnDisabled: {
        backgroundColor: '#a5b4fc',
    },
    publishBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    tipsCard: {
        backgroundColor: '#fef3c7',
        margin: 16,
        borderRadius: 12,
        padding: 16,
    },
    tipsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400e',
        marginBottom: 8,
    },
    tipItem: {
        fontSize: 13,
        color: '#92400e',
        marginBottom: 4,
    },
});

export default CreatePost;
