import { Text, View } from '@/components/Themed';
import { AuditStatusColors, Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { Database } from '@/types/database.types';
import { useQuery } from '@tanstack/react-query';
import { format, isPast } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { Calendar, ChevronRight, Filter as FilterIcon, Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

type Recommendation = Database['public']['Tables']['audit_recommendations']['Row'];

export default function RecommendationsScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<'all' | 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Blue'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Debounce search could be added here, but for simplicity relying on state update

    const { profile, loading: authLoading } = useAuth();

    const { data: recommendations, isLoading, error } = useQuery({
        queryKey: ['recommendations', filter, searchQuery, profile?.id],
        enabled: !authLoading && !!profile,
        queryFn: async () => {
            let query = supabase
                .from('audit_recommendations')
                .select(`
          *,
          departments (name),
          action_plans (due_date)
        `)
                .order('created_at', { ascending: false });

            // ENFORCE ROLE-BASED ACCESS CONTROL
            if (profile && profile.role !== 'auditor' && profile.role !== 'director') {
                if (profile.department_id) {
                    query = query.eq('department_id', profile.department_id);
                } else {
                    // If no department assigned, show nothing or handle gracefully
                    return [];
                }
            }

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            if (searchQuery) {
                query = query.ilike('title', `%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });

    const getDeadline = (item: any) => {
        // Find the earliest due date from action plans as a proxy for deadline
        if (!item.action_plans || item.action_plans.length === 0) return null;
        const dates = item.action_plans.map((p: any) => p.due_date).filter(Boolean).sort();
        return dates.length > 0 ? dates[0] : null;
    };

    const renderItem = ({ item }: { item: any }) => {
        const deadline = getDeadline(item);
        const isOverdue = deadline && isPast(new Date(deadline)) && item.status !== 'Green' && item.status !== 'Purple' && item.status !== 'Blue';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/recommendation/${item.id}` as any)}
            >
                <View style={[styles.statusIndicator, { backgroundColor: AuditStatusColors[item.status as keyof typeof AuditStatusColors] || Colors.light.textSecondary }]} />
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.departments?.name || 'Unknown Dept'}</Text>

                    <View style={styles.metaContainer}>
                        <View style={styles.statusBadge}>
                            <Text style={[styles.cardStatus, { color: AuditStatusColors[item.status as keyof typeof AuditStatusColors] }]}>{item.status}</Text>
                        </View>

                        {deadline && (
                            <View style={[styles.deadlineContainer, isOverdue && styles.overdueContainer]}>
                                <Calendar size={12} color={isOverdue ? Colors.light.danger : Colors.light.textSecondary} style={{ marginRight: 4 }} />
                                <Text style={[styles.deadlineText, isOverdue && styles.overdueText]}>
                                    {format(new Date(deadline), 'dd MMM yyyy')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                <ChevronRight color={Colors.light.textSecondary} size={20} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Recommandations' }} />

            <View style={styles.headerContainer}>
                <View style={styles.searchBar}>
                    <Search size={20} color={Colors.light.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search by title..."
                        placeholderTextColor={Colors.light.textSecondary}
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
                    <FilterIcon size={20} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.chipsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {['all', 'Green', 'Yellow', 'Red'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterChip,
                                filter === f && styles.filterChipActive,
                                filter === f && f !== 'all' && { backgroundColor: AuditStatusColors[f as keyof typeof AuditStatusColors] }
                            ]}
                            onPress={() => setFilter(f as any)}
                        >
                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                {f === 'all' ? 'All' : f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            ) : (
                <FlatList
                    data={recommendations}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: Colors.light.textSecondary }}>No recommendations found.</Text>
                        </View>
                    }
                />
            )}

            {/* Simple Filter Modal Mockup - reusing existing logic but illustrating the modal request */}
            <Modal
                visible={showFilterModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowFilterModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter Options</Text>
                        <Text style={styles.modalLabel}>Status</Text>
                        <View style={styles.modalChips}>
                            {['all', 'Green', 'Yellow', 'Red', 'Purple', 'Blue'].map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        styles.filterChip,
                                        filter === f && styles.filterChipActive,
                                        filter === f && f !== 'all' && { backgroundColor: AuditStatusColors[f as keyof typeof AuditStatusColors] },
                                        { marginBottom: 8 }
                                    ]}
                                    onPress={() => { setFilter(f as any); setShowFilterModal(false); }}
                                >
                                    <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                        {f === 'all' ? 'All' : f}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowFilterModal(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
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
    headerContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: 'white',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    filterButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
    },
    chipsContainer: {
        backgroundColor: 'white',
        paddingBottom: 12,
        marginBottom: 8,
    },
    filterScroll: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: Colors.light.primary,
        borderColor: 'transparent',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4B5563',
    },
    filterTextActive: {
        color: 'white',
    },
    list: {
        padding: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statusIndicator: {
        width: 4,
        height: 40,
        borderRadius: 2,
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
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusBadge: {

    },
    deadlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    overdueContainer: {
        backgroundColor: '#FEF2F2',
    },
    deadlineText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    overdueText: {
        color: Colors.light.danger,
        fontWeight: '600',
    },
    cardStatus: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
        color: '#111827',
    },
    modalLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#374151',
    },
    modalChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    closeButton: {
        backgroundColor: '#F3F4F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
});
