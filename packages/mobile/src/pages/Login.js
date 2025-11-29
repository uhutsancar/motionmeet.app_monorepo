import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert
} from 'react-native';
import { useDispatch } from 'react-redux';
import { setUser } from '../features/user/userSlice';
import { dummyUserData } from '../assets/assets';

const Login = ({ navigation }) => {
    const dispatch = useDispatch();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        // For demo purposes, we'll use dummy data
        // In production, this would make an API call
        if (email && password) {
            dispatch(setUser(dummyUserData));
            // Navigation is handled by the RootNavigator based on user state
        } else {
            Alert.alert('Error', 'Please enter email and password');
        }
    };

    const handleDemoLogin = () => {
        // Demo login with dummy data
        dispatch(setUser(dummyUserData));
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Branding Section */}
                <View style={styles.brandingSection}>
                    <Text style={styles.logo}>MotionMeet</Text>
                    
                    <View style={styles.ratingContainer}>
                        <Text style={styles.stars}>⭐⭐⭐⭐⭐</Text>
                        <Text style={styles.usersText}>Used by 12k+ developers</Text>
                    </View>

                    <Text style={styles.headline}>
                        More than just friends truly connect
                    </Text>
                    <Text style={styles.subheadline}>
                        Connect with global community on MotionMeet
                    </Text>
                </View>

                {/* Login Form */}
                <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>Sign In</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Email address"
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity 
                        style={styles.loginButton}
                        onPress={handleLogin}
                    >
                        <Text style={styles.loginButtonText}>Sign In</Text>
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity 
                        style={styles.demoButton}
                        onPress={handleDemoLogin}
                    >
                        <Text style={styles.demoButtonText}>Continue with Demo Account</Text>
                    </TouchableOpacity>

                    <Text style={styles.signupText}>
                        Don't have an account?{' '}
                        <Text style={styles.signupLink}>Sign up</Text>
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    brandingSection: {
        marginBottom: 40,
    },
    logo: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#4f46e5',
        marginBottom: 24,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    stars: {
        fontSize: 16,
        marginRight: 8,
    },
    usersText: {
        fontSize: 14,
        color: '#6b7280',
    },
    headline: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1e1b4b',
        marginBottom: 12,
        lineHeight: 36,
    },
    subheadline: {
        fontSize: 18,
        color: '#4338ca',
        lineHeight: 26,
    },
    formContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 24,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 16,
        color: '#1f2937',
    },
    loginButton: {
        backgroundColor: '#6366f1',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#9ca3af',
        fontSize: 14,
    },
    demoButton: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    demoButtonText: {
        color: '#4b5563',
        fontSize: 16,
        fontWeight: '500',
    },
    signupText: {
        textAlign: 'center',
        marginTop: 24,
        color: '#6b7280',
        fontSize: 14,
    },
    signupLink: {
        color: '#6366f1',
        fontWeight: '600',
    },
});

export default Login;
