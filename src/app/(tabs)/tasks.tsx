import { Text, View } from '@/components/Themed';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { Database } from '@/types/database.types';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { AlertCircle, Calendar, Check, CheckCircle2, ChevronRight, Plus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity
} from 'react-native';

type ActionPlan = Database['public']['Tables']['action_plans']['Row'];
type RecommendationRes = { id: string; title: string };

export default function TasksScreen() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [filter, setFilter] = useState<'pending' | 'in_progress' | 'completed'>('pending');

    // Add Task Modal State
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // 1. Fetch My Tasks
    const { data: tasks, isLoading, refetch } = useQuery({
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

    // 2. Fetch Available Recommendations (for the dropdown/selection)
    // Only fetch when modal is open to save resources
    const { data: availableRecs } = useQuery({
        queryKey: ['available-recs-for-tasks', profile?.department_id],
        enabled: isAddModalVisible && !!profile,
        queryFn: async () => {
            let query = supabase
                .from('audit_recommendations')
                .select('id, title')
                .neq('status', 'Green') // Don't add tasks to fully implemented ones
                .neq('status', 'Blue')  // Don't add to N/A
                .order('created_at', { ascending: false });

            // Filter: If not Auditor/Director, only show My Dept's recommendations
            if (profile && profile.role !== 'auditor' && profile.role !== 'director') {
                if (profile.department_id) {
                    query = query.eq('department_id', profile.department_id);
                } else {
                    return [];
                }
            }
            const { data, error } = await query;
            if (error) throw error;
            return data as RecommendationRes[];
        }
    });

    const handleAddTask = async () => {
        if (!selectedRecId) {
            Alert.alert('Error', 'Please select a Recommendation');
            return;
        }
        if (!newTaskDesc.trim()) {
            Alert.alert('Error', 'Description is required');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.from('action_plans').insert({
                recommendation_id: selectedRecId,
                description: newTaskDesc,
                assigned_to: user?.id, // Auto-assign to self created task
                due_date: newTaskDate ? new Date(newTaskDate).toISOString() : null,
                status: 'pending'
            });

            if (error) throw error;

            Alert.alert('Success', 'Task created successfully!');
            setIsAddModalVisible(false);
            setNewTaskDesc('');
            setNewTaskDate('');
            setSelectedRecId(null);
            refetch(); // Refresh list
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmitting(false);
        }
    };

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

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsAddModalVisible(true)}
                activeOpacity={0.8}
            >
                <Plus size={24} color="white" />
            </TouchableOpacity>

            {/* Create Task Modal */}
            <Modal
                visible={isAddModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsAddModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        {/* Colored Header */}
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHandle} />
                            <View style={styles.headerRow}>
                                <View>
                                    <Text style={styles.modalTitle}>New Task</Text>
                                    <Text style={styles.modalSubtitle}>Create an action item</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setIsAddModalVisible(false)}
                                    style={styles.closeButton}
                                >
                                    <X size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView contentContainerStyle={styles.formScroll}>
                            <View style={styles.formSection}>
                                <Text style={styles.label}>Link to Recommendation</Text>
                                <View style={styles.recListContainer}>
                                    {availableRecs ? (
                                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                                            {availableRecs.map(rec => (
                                                <TouchableOpacity
                                                    key={rec.id}
                                                    style={[styles.recItem, selectedRecId === rec.id && styles.recItemActive]}
                                                    onPress={() => setSelectedRecId(rec.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={[styles.recIcon, selectedRecId === rec.id && styles.recIconActive]}>
                                                        <Check size={14} color={selectedRecId === rec.id ? 'white' : 'transparent'} />
                                                    </View>
                                                    <Text numberOfLines={2} style={[styles.recItemText, selectedRecId === rec.id && styles.recItemTextActive]}>
                                                        {rec.title}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                            {availableRecs.length === 0 && (
                                                <View style={styles.emptyStateSmall}>
                                                    <Text style={styles.emptyText}>No recommendations available.</Text>
                                                </View>
                                            )}
                                        </ScrollView>
                                    ) : (
                                        <ActivityIndicator size="small" color={Colors.light.primary} style={{ margin: 20 }} />
                                    )}
                                </View>
                            </View>

                            <View style={styles.formSection}>
                                <Text style={styles.label}>Description</Text>
                                <TextInput
                                    style={styles.textArea}
                                    multiline
                                    placeholder="Describe the specific action needed..."
                                    value={newTaskDesc}
                                    onChangeText={setNewTaskDesc}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View style={styles.formSection}>
                                <Text style={styles.label}>Due Date</Text>
                                <View style={styles.dateInputContainer}>
                                    <Calendar size={18} color={Colors.light.textSecondary} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={styles.dateInput}
                                        placeholder="YYYY-MM-DD"
                                        value={newTaskDate}
                                        onChangeText={setNewTaskDate}
                                        placeholderTextColor="#9CA3AF"
                                        maxLength={10}
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </View>
                                <Text style={styles.helperText}>Format: Year-Month-Day</Text>
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.submitButton, (!selectedRecId || !newTaskDesc) && styles.submitButtonDisabled]}
                                onPress={handleAddTask}
                                disabled={submitting || !selectedRecId || !newTaskDesc}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Create Task</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
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
        paddingBottom: 80, // Space for FAB
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
        fontStyle: 'italic',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white', // Changed from #F9FAFB to White for cleaner look
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        // No padding here, handled in children to allow full width header
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        backgroundColor: '#1E3A8A', // Premium Blue
        paddingHorizontal: 24,
        paddingTop: 16, // Space for handle
        paddingBottom: 24,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: 'white', // White text on blue
        letterSpacing: -0.5,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#93C5FD', // Light blue text
        marginTop: 4,
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)', // Semi-transparent
        borderRadius: 20,
    },
    formScroll: {
        padding: 24,
        paddingTop: 24,
    },
    formSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    recListContainer: {
        backgroundColor: '#F9FAFB', // Slightly grey background for list container
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB', // Darker border
        overflow: 'hidden',
    },
    recItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white', // Items are white
    },
    recItemActive: {
        backgroundColor: '#EFF6FF',
    },
    recIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#9CA3AF', // Darker default border
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recIconActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
        borderWidth: 0,
    },
    recItemText: {
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '500',
        flex: 1,
        lineHeight: 20,
    },
    recItemTextActive: {
        color: '#1E3A8A', // Blue text when active
        fontWeight: '700',
    },
    textArea: {
        backgroundColor: '#F3F4F6', // Distinct light grey background for input
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: '#111827',
        height: 100,
        textAlignVertical: 'top',
        // Shadow for input
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
    },
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6', // Distinct light grey background for input
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
    },
    dateInput: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
        // Note: In a real app, integrate a DatePicker library here
    },
    helperText: {
        fontSize: 12,
        color: '#6B7280', // Darker gray for readability
        marginTop: 6,
        marginLeft: 4,
    },
    modalFooter: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        padding: 24,
        backgroundColor: 'white',
    },
    submitButton: {
        backgroundColor: '#1E3A8A', // Matching the header blue
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#1E3A8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        backgroundColor: '#CBD5E1', // Lighter grey for disabled state
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    emptyStateSmall: {
        padding: 24,
        alignItems: 'center',
    },
});
