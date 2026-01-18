import { Text, View } from '@/components/Themed';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { Database } from '@/types/database.types';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { AlertCircle, Calendar, CheckCircle2, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity } from 'react-native';

type ActionPlan = Database['public']['Tables']['action_plans']['Row'];

export default function TasksScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [filter, setFilter] = useState<'pending' | 'in_progress' | 'completed'>('pending');

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['my-tasks', user?.id, filter],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('action_plans')
                .select(`
          *,
          audit_recommendations (title)
        `)
                .eq('assigned_to', user.id) // Filter by assigned user
                .eq('status', filter)
                .order('due_date', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const renderItem = ({ item }: { item: ActionPlan & { audit_recommendations: { title: string } | null } }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/recommendation/${item.recommendation_id}` as any)}
        >
            <View style={styles.iconContainer}>
                {item.status === 'completed' ? (
                    <CheckCircle2 color={Colors.light.success} size={24} />
                ) : (
                    <AlertCircle color={item.status === 'in_progress' ? Colors.light.warning : Colors.light.tint} size={24} />
                )}
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>{item.audit_recommendations?.title}</Text>

                {item.due_date && (
                    <View style={styles.dateContainer}>
                        <Calendar size={14} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
                        <Text style={styles.dateText}>
                            Due: {format(new Date(item.due_date), 'MMM dd, yyyy')}
                        </Text>
                    </View>
                )}
            </View>
            <ChevronRight color={Colors.light.textSecondary} size={20} />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Mes Tâches' }} />

            <View style={styles.tabsContainer}>
                {['pending', 'in_progress', 'completed'].map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.tab, filter === f && styles.tabActive]}
                        onPress={() => setFilter(f as any)}
                    >
                        <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
                            {f.replace('_', ' ').toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            ) : (
                <FlatList
                    data={tasks}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No {filter.replace('_', ' ')} tasks.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 8,
        margin: 16,
        borderRadius: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: Colors.light.primary, // Using primary blue
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabTextActive: {
        color: 'white',
    },
    list: {
        padding: 16,
        paddingTop: 0,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
        marginRight: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
    },
});
