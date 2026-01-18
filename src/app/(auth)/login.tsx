import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { Lock, LogIn, Mail, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { refreshProfile } = useAuth();

    async function handleAuth() {
        setLoading(true);
        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (error) throw error;

                if (data.user) {
                    // Manually create profile if no trigger exists
                    const { error: profileError } = await supabase.from('profiles').insert({
                        id: data.user.id,
                        full_name: fullName,
                        role: 'staff', // Default role for new signups
                        department_id: null,
                    });

                    if (profileError) {
                        console.log('Profile creation note:', profileError.message);
                    }

                    await refreshProfile();
                }

                if (!data.session) {
                    Alert.alert('Success', 'Account created! Please check your email for confirmation.');
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: any) {
            Alert.alert('Authentication Failed', error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient
                colors={[Colors.light.primary, Colors.light.purple]}
                style={styles.background}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.card}>
                    <View style={styles.headerContainer}>
                        <Text style={styles.title}>ARTS</Text>
                        <Text style={styles.subtitle}>Audit Recommendation Tracking System</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        {isSignUp && (
                            <View style={styles.inputWrapper}>
                                <User color={Colors.light.textSecondary} size={20} style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Full Name"
                                    placeholderTextColor={Colors.light.textSecondary}
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                            </View>
                        )}
                        <View style={styles.inputWrapper}>
                            <Mail color={Colors.light.textSecondary} size={20} style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <Lock color={Colors.light.textSecondary} size={20} style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
                                <LogIn color="white" size={20} style={{ marginLeft: 8 }} />
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                            <Text style={styles.switchText}>
                                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.footerText}>Rwanda Revenue Authority</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        padding: 32,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 42,
        fontWeight: '800',
        color: Colors.light.primary,
        marginBottom: 8,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },
    inputContainer: {
        gap: 16,
        marginBottom: 32,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.light.text,
    },
    button: {
        backgroundColor: Colors.light.primary,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.light.primary,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    footer: {
        marginTop: 24,
        alignItems: 'center',
    },
    footerText: {
        color: Colors.light.textSecondary,
        fontSize: 12,
        fontWeight: '500',
        marginTop: 16,
    },
    switchText: {
        color: Colors.light.primary,
        fontSize: 14,
        fontWeight: '600',
    },
});
