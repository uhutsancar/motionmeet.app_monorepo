import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    FlatList, 
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import UserCard from '../components/UserCard';
import Loading from '../components/Loading';
import { dummyConnectionsData } from '../assets/assets';

const Discover = () => {
    const [input, setInput] = useState('');
    const [users, setUsers] = useState(dummyConnectionsData);
    const [loading, setLoading] = useState(false);

    const handleSearch = () => {
        if (!input.trim()) return;
        
        setLoading(true);
        // Simulate API search
        setTimeout(() => {
            const filtered = dummyConnectionsData.filter(user => 
                user.full_name.toLowerCase().includes(input.toLowerCase()) ||
                user.username.toLowerCase().includes(input.toLowerCase()) ||
                user.bio?.toLowerCase().includes(input.toLowerCase()) ||
                user.location?.toLowerCase().includes(input.toLowerCase())
            );
            setUsers(filtered);
            setLoading(false);
        }, 500);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Discover People</Text>
                <Text style={styles.subtitle}>
                    Connect with amazing people and grow your network
                </Text>
            </View>

            {/* Search Box */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search people by name, username, bio, or location..."
                        placeholderTextColor="#9ca3af"
                        value={input}
                        onChangeText={setInput}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                </View>
            </View>

            {/* Results */}
            {loading ? (
                <Loading />
            ) : (
                <FlatList
                    data={users}
                    renderItem={({ item }) => (
                        <View style={styles.cardWrapper}>
                            <UserCard user={item} />
                        </View>
                    )}
                    keyExtractor={(item) => item._id}
                    numColumns={1}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No users found</Text>
                        </View>
                    }
                />
            )}
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
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1f2937',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    cardWrapper: {
        marginBottom: 16,
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#9ca3af',
    },
});

export default Discover;
