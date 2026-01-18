import { Text } from '@/components/Themed';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Stack } from 'expo-router';
import { Building2, LogOut, Settings, Shield, User } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
    const { signOut, user, profile } = useAuth();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Profile' }} />

            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <User size={40} color={Colors.light.primary} />
                </View>
                <Text style={styles.name}>{profile?.full_name || user?.email || 'User'}</Text>
                <View style={styles.roleBadge}>
                    <Shield size={12} color="white" style={{ marginRight: 4 }} />
                    <Text style={styles.roleText}>{profile?.role?.toUpperCase() || 'GUEST'}</Text>
                </View>
                {profile?.department_id && (
                    <View style={styles.deptContainer}>
                        <Building2 size={16} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={styles.deptText}>Department {profile.department_id}</Text>
                    </View>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings</Text>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuIcon}>
                        <Settings size={20} color={Colors.light.text} />
                    </View>
                    <Text style={styles.menuText}>App Settings</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
                    <LogOut size={20} color={Colors.light.danger} style={{ marginRight: 8 }} />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
                <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 4,
        borderColor: 'white',
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    roleText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    deptContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deptText: {
        color: '#6B7280',
        fontSize: 14,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 12,
        marginLeft: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
    },
    menuIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuText: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    footer: {
        marginTop: 'auto',
        alignItems: 'center',
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    signOutText: {
        color: Colors.light.danger,
        fontWeight: '600',
        fontSize: 16,
    },
    versionText: {
        color: '#9CA3AF',
        fontSize: 12,
    },
});
