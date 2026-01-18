import { Text, View } from '@/components/Themed';
import { AuditStatusColors, Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { Database } from '@/types/database.types';
import { format } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Check, CheckCircle2, FileText, Plus, RefreshCw, Shield, Upload, User, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

type Recommendation = Database['public']['Tables']['audit_recommendations']['Row'] & {
    departments: { name: string } | null;
    action_plans: (Database['public']['Tables']['action_plans']['Row'] & {
        evidence_submissions: Database['public']['Tables']['evidence_submissions']['Row'][];
    })[];
};

type AuditorProfile = Database['public']['Tables']['profiles']['Row'];

export default function RecommendationDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { profile } = useAuth();
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [auditor, setAuditor] = useState<AuditorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'General' | 'Action Plan' | 'Evidence' | 'History'>('General');

    // Action Plan Modal State
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [newPlanDesc, setNewPlanDesc] = useState('');
    const [newPlanDate, setNewPlanDate] = useState('');
    const [submittingAction, setSubmittingAction] = useState(false);

    // Evidence Modal State
    const [evidenceModalVisible, setEvidenceModalVisible] = useState(false);
    const [selectedActionPlanId, setSelectedActionPlanId] = useState<string | null>(null);
    const [evidenceDesc, setEvidenceDesc] = useState('');
    const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [submittingEvidence, setSubmittingEvidence] = useState(false);

    // Status Update State
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        fetchRecommendation();
    }, [id]);

    const fetchRecommendation = async () => {
        try {
            const { data, error } = await supabase
                .from('audit_recommendations')
                .select(`
          *,
          departments (name),
          action_plans (
            *,
            evidence_submissions (*)
          )
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            if (data.action_plans) {
                data.action_plans.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
            setRecommendation(data);

            if (data.created_by) {
                fetchAuditor(data.created_by);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditor = async (userId: string) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) setAuditor(data);
    }

    const canEdit = profile &&
        (profile.role === 'focal_person' || profile.role === 'staff') &&
        recommendation &&
        profile.department_id === recommendation.department_id;

    const isAuditorOrDirector = profile && (profile.role === 'auditor' || profile.role === 'director');

    // --- Action Plan Logic ---

    const handleAddActionPlan = async () => {
        if (!newPlanDesc.trim()) {
            Alert.alert('Error', 'Description is required');
            return;
        }
        if (!recommendation) return;

        setSubmittingAction(true);
        try {
            const { error } = await supabase.from('action_plans').insert({
                recommendation_id: recommendation.id,
                description: newPlanDesc,
                assigned_to: profile?.id,
                due_date: newPlanDate ? new Date(newPlanDate).toISOString() : null,
                status: 'pending'
            });

            if (error) throw error;

            setNewPlanDesc('');
            setNewPlanDate('');
            setActionModalVisible(false);
            fetchRecommendation();
            Alert.alert('Success', 'Action plan added successfully');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmittingAction(false);
        }
    };

    const togglePlanStatus = async (planId: string, currentStatus: string) => {
        if (!canEdit) return;
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        try {
            const { error } = await supabase
                .from('action_plans')
                .update({ status: newStatus as any })
                .eq('id', planId);

            if (error) throw error;
            fetchRecommendation();
        } catch (e: any) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    // --- Status Logic ---

    const handleUpdateStatus = async (newStatus: string) => {
        if (!recommendation || !profile) return;
        setUpdatingStatus(true);
        try {
            // Update recommendation
            const { error: updateError } = await supabase
                .from('audit_recommendations')
                .update({ status: newStatus as any })
                .eq('id', recommendation.id);

            if (updateError) throw updateError;

            // Log entry
            const { error: logError } = await supabase
                .from('audit_logs')
                .insert({
                    recommendation_id: recommendation.id,
                    user_id: profile.id,
                    action: 'status_change',
                    details: `Status updated to ${newStatus}`,
                });

            if (logError) throw logError;

            setStatusModalVisible(false);
            fetchRecommendation();
            Alert.alert('Success', 'Status updated successfully');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    // --- Evidence Logic ---

    const handleEvidenceReview = async (evidenceId: string, decision: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('evidence_submissions')
                .update({ status: decision } as any)
                .eq('id', evidenceId);

            if (error) throw error;
            fetchRecommendation();
        } catch (e: any) {
            Alert.alert('Error', 'Failed to update evidence status');
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({});
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedFile(result.assets[0]);
            }
        } catch (err) {
            console.log('Document picking error', err);
        }
    };

    const handleUploadEvidence = async () => {
        if (!selectedActionPlanId) {
            Alert.alert('Error', 'Please select an action plan.');
            return;
        }
        if (!selectedFile) {
            Alert.alert('Error', 'Please select a file.');
            return;
        }

        setSubmittingEvidence(true);
        try {
            // 1. Upload file to Supabase Storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `evidence/${fileName}`;

            const formData = new FormData();
            formData.append('file', {
                uri: selectedFile.uri,
                name: selectedFile.name,
                type: selectedFile.mimeType || 'application/octet-stream',
            } as any);

            const { error: uploadError } = await supabase.storage
                .from('audit-evidences')
                .upload(filePath, formData as any, {
                    contentType: selectedFile.mimeType || 'application/octet-stream',
                });

            if (uploadError) throw uploadError;

            // 2. Get Public URL (optional dependent on bucket settings, but good for reference)
            const { data: { publicUrl } } = supabase.storage
                .from('audit-evidences')
                .getPublicUrl(filePath);

            // 3. Insert record into evidence_submissions
            const { error: insertError } = await supabase
                .from('evidence_submissions')
                .insert({
                    action_plan_id: selectedActionPlanId,
                    uploaded_by: profile?.id,
                    file_url: publicUrl, // or filePath if you prefer generic handling
                    description: evidenceDesc || 'Evidence uploaded',
                });

            if (insertError) throw insertError;

            setEvidenceDesc('');
            setSelectedFile(null);
            setSelectedActionPlanId(null);
            setEvidenceModalVisible(false);
            fetchRecommendation();
            Alert.alert('Success', 'Evidence uploaded successfully');

        } catch (e: any) {
            console.error(e);
            Alert.alert('Upload Error', e.message || 'Failed to upload evidence');
        } finally {
            setSubmittingEvidence(false);
        }
    };

    const openEvidenceUrl = (url: string) => {
        Linking.openURL(url).catch(err => Alert.alert('Error', 'Cannot open file URL'));
    };


    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    if (!recommendation) {
        return (
            <View style={styles.container}>
                <Text>Recommendation not found.</Text>
            </View>
        );
    }

    const renderTabs = () => (
        <View style={styles.tabContainer}>
            {['General', 'Action Plan', 'Evidence', 'History'].map((tab) => (
                <TouchableOpacity
                    key={tab}
                    style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                    onPress={() => setActiveTab(tab as any)}
                >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderGeneralInfo = () => (
        <ScrollView style={styles.contentContainer}>
            <View style={styles.header}>
                <View style={[styles.statusBadge, { backgroundColor: AuditStatusColors[recommendation.status as keyof typeof AuditStatusColors] }]}>
                    <Text style={styles.statusText}>{recommendation.status.toUpperCase()}</Text>
                </View>
                {isAuditorOrDirector && (
                    <TouchableOpacity onPress={() => setStatusModalVisible(true)} style={styles.updateStatusBtn}>
                        <RefreshCw size={14} color={Colors.light.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.updateStatusText}>Update Status</Text>
                    </TouchableOpacity>
                )}
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: -12, marginBottom: 12 }}>
                <Text style={styles.dateText}>Created {format(new Date(recommendation.created_at), 'MMM dd, yyyy')}</Text>
            </View>

            <Text style={styles.title}>{recommendation.title}</Text>

            <View style={styles.card}>
                <Text style={styles.cardLabel}>Finding / Description</Text>
                <Text style={styles.description}>{recommendation.description}</Text>
            </View>

            <View style={styles.row}>
                <View style={styles.infoCard}>
                    <Shield size={20} color={Colors.light.primary} style={{ marginBottom: 8 }} />
                    <Text style={styles.infoLabel}>Department</Text>
                    <Text style={styles.infoValue}>{recommendation.departments?.name || 'Unknown'}</Text>
                </View>
                <View style={styles.infoCard}>
                    <User size={20} color={Colors.light.primary} style={{ marginBottom: 8 }} />
                    <Text style={styles.infoLabel}>Auditor</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{auditor?.full_name || 'System'}</Text>
                </View>
            </View>
        </ScrollView>
    );

    const renderActionPlans = () => (
        <ScrollView style={styles.contentContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Action Plans</Text>
                {canEdit && (
                    <TouchableOpacity style={styles.addButton} onPress={() => setActionModalVisible(true)}>
                        <Plus size={16} color={Colors.light.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.addButtonText}>Add Activity</Text>
                    </TouchableOpacity>
                )}
            </View>
            {recommendation.action_plans && recommendation.action_plans.length > 0 ? (
                recommendation.action_plans.map((plan) => (
                    <View key={plan.id} style={styles.planCard}>
                        <View style={styles.planHeader}>
                            <TouchableOpacity onPress={() => togglePlanStatus(plan.id, plan.status)} disabled={!canEdit}>
                                {plan.status === 'completed' ? (
                                    <CheckCircle2 size={24} color={Colors.light.success} style={{ marginRight: 12 }} />
                                ) : (
                                    <View style={[styles.pendingCircle, { borderColor: plan.status === 'in_progress' ? Colors.light.warning : '#D1D5DB' }]} />
                                )}
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <Text style={[styles.planDesc, plan.status === 'completed' && styles.completedText]}>{plan.description}</Text>
                                <View style={styles.planMetaRow}>
                                    <View style={[styles.planStatusBadge, {
                                        backgroundColor: plan.status === 'completed' ? '#ECFDF5' :
                                            plan.status === 'in_progress' ? '#FFFBEB' : '#F3F4F6'
                                    }]}>
                                        <Text style={[styles.planStatusText, {
                                            color: plan.status === 'completed' ? '#059669' :
                                                plan.status === 'in_progress' ? '#D97706' : '#4B5563'
                                        }]}>{plan.status.replace('_', ' ').toUpperCase()}</Text>
                                    </View>

                                    {plan.due_date && (
                                        <View style={styles.planMeta}>
                                            <Calendar size={12} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
                                            <Text style={styles.planDate}>{format(new Date(plan.due_date), 'MMM dd')}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                ))
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No action plans added yet.</Text>
                </View>
            )}
        </ScrollView>
    );

    const renderEvidence = () => {
        const allEvidence = recommendation.action_plans?.flatMap(p => p.evidence_submissions || []) || [];

        return (
            <ScrollView style={styles.contentContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Evidence Submissions</Text>
                    {canEdit && (
                        <TouchableOpacity style={styles.addButton} onPress={() => setEvidenceModalVisible(true)}>
                            <Upload size={16} color={Colors.light.primary} style={{ marginRight: 4 }} />
                            <Text style={styles.addButtonText}>Upload</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {allEvidence.length > 0 ? (
                    allEvidence.map((evidence) => (
                        <TouchableOpacity key={evidence.id} style={styles.evidenceCard} onPress={() => openEvidenceUrl(evidence.file_url)}>
                            <FileText size={24} color={Colors.light.primary} style={{ marginRight: 16 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.evidenceTitle}>Submission</Text>
                                <Text style={styles.evidenceLink} numberOfLines={1}>{evidence.description || 'No description provided'}</Text>
                                <Text style={styles.evidenceDate}>{format(new Date(evidence.created_at), 'MMM dd, yyyy HH:mm')}</Text>
                            </View>
                            {isAuditorOrDirector ? (
                                <View style={styles.evidenceActions}>
                                    <TouchableOpacity onPress={() => handleEvidenceReview(evidence.id, 'approved')} style={[styles.actionBtn, { backgroundColor: '#ECFDF5' }]}>
                                        <Check size={18} color="#059669" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleEvidenceReview(evidence.id, 'rejected')} style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}>
                                        <X size={18} color="#DC2626" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <User size={16} color={Colors.light.textSecondary} />
                            )}
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No evidence submitted.</Text>
                    </View>
                )
                }
            </ScrollView >
        )
    };

    const renderHistory = () => (
        <ScrollView style={styles.contentContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Audit Trail</Text>
            </View>
            <View style={styles.timelineItem}>
                <View style={styles.timelineLine} />
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Recommendation Created</Text>
                    <Text style={styles.timelineUser}>by {auditor?.full_name || 'Auditor'}</Text>
                    <Text style={styles.timelineDate}>{format(new Date(recommendation.created_at), 'PPP p')}</Text>
                </View>
            </View>
            {/* Mocking further history as 'Audit Logs' table is hypothetical currently */}
            <View style={styles.timelineItem}>
                <View style={[styles.timelineLine, { backgroundColor: 'transparent' }]} />
                <View style={[styles.timelineDot, { backgroundColor: Colors.light.textSecondary }]} />
                <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Status Updated</Text>
                    <Text style={styles.timelineUser}>System Automated Check</Text>
                    <Text style={styles.timelineDate}>{format(new Date(), 'PPP p')}</Text>
                </View>
            </View>
        </ScrollView>
    );


    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'Recommendation Details',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -8, padding: 8 }}>
                        <ArrowLeft color={Colors.light.text} size={24} />
                    </TouchableOpacity>
                ),
                headerStyle: { backgroundColor: '#fff' },
                headerShadowVisible: false,
            }} />

            {renderTabs()}

            <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
                {activeTab === 'General' && renderGeneralInfo()}
                {activeTab === 'Action Plan' && renderActionPlans()}
                {activeTab === 'Evidence' && renderEvidence()}
                {activeTab === 'History' && renderHistory()}
            </View>

            {/* ACTION PLAN MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={actionModalVisible}
                onRequestClose={() => setActionModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Action Plan</Text>
                            <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={styles.textArea}
                                multiline
                                placeholder="Describe the activity..."
                                value={newPlanDesc}
                                onChangeText={setNewPlanDesc}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="2024-12-31"
                                value={newPlanDate}
                                onChangeText={setNewPlanDate}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleAddActionPlan}
                            disabled={submittingAction}
                        >
                            {submittingAction ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.submitButtonText}>Create Activity</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* EVIDENCE UPLOAD MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={evidenceModalVisible}
                onRequestClose={() => setEvidenceModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Upload Evidence</Text>
                            <TouchableOpacity onPress={() => setEvidenceModalVisible(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Select Related Action Plan</Text>
                        <ScrollView style={{ maxHeight: 150, marginBottom: 20 }} nestedScrollEnabled>
                            {recommendation?.action_plans?.map(plan => (
                                <TouchableOpacity
                                    key={plan.id}
                                    style={[styles.planSelectionItem, selectedActionPlanId === plan.id && styles.planSelectionItemActive]}
                                    onPress={() => setSelectedActionPlanId(plan.id)}
                                >
                                    <Text numberOfLines={1} style={[styles.planSelectionText, selectedActionPlanId === plan.id && styles.planSelectionTextActive]}>
                                        {plan.description}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description / Comment</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.g. Invoice receipt..."
                                value={evidenceDesc}
                                onChangeText={setEvidenceDesc}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <TouchableOpacity style={styles.fileButton} onPress={pickDocument}>
                            <Upload size={20} color={selectedFile ? Colors.light.success : Colors.light.primary} />
                            <Text style={[styles.fileButtonText, selectedFile && { color: Colors.light.success }]}>
                                {selectedFile ? `Selected: ${selectedFile.name}` : 'Select File'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.submitButton, (!selectedFile || !selectedActionPlanId) && { backgroundColor: '#9CA3AF' }]}
                            onPress={handleUploadEvidence}
                            disabled={submittingEvidence || !selectedFile || !selectedActionPlanId}
                        >
                            {submittingEvidence ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Evidence</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* STATUS UPDATE MODAL */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={statusModalVisible}
                onRequestClose={() => setStatusModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { minHeight: 'auto' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Update Status</Text>
                            <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 10 }}>
                            {Object.keys(AuditStatusColors).map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[styles.statusOption, recommendation?.status === status && styles.statusOptionActive]}
                                    onPress={() => handleUpdateStatus(status)}
                                    disabled={updatingStatus}
                                >
                                    <View style={[styles.statusDot, { backgroundColor: AuditStatusColors[status as keyof typeof AuditStatusColors] }]} />
                                    <Text style={styles.statusOptionText}>{status.replace(/_/g, ' ').toUpperCase()}</Text>
                                    {recommendation?.status === status && <Check size={16} color={Colors.light.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabButtonActive: {
        borderBottomColor: Colors.light.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    tabTextActive: {
        color: Colors.light.primary,
        fontWeight: '600',
    },
    contentContainer: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    updateStatusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    updateStatusText: {
        color: Colors.light.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
        lineHeight: 28,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    infoCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    infoLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    pendingCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        marginRight: 12,
    },
    planDesc: {
        fontSize: 15,
        color: '#111827',
        marginBottom: 8,
        lineHeight: 22,
    },
    completedText: {
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    planMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    planStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    planStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    planMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planDate: {
        fontSize: 12,
        color: '#6B7280',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    evidenceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    evidenceTitle: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
        marginBottom: 2,
    },
    evidenceLink: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
        marginBottom: 2,
    },
    evidenceDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    evidenceActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 12,
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 0,
    },
    timelineLine: {
        width: 2,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 14,
        position: 'relative',
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.light.primary,
        position: 'absolute',
        left: -4,
        top: 6,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 24,
    },
    timelineTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    timelineUser: {
        fontSize: 13,
        color: '#4B5563',
        marginBottom: 2,
    },
    timelineDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    textArea: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        height: 100,
        textAlignVertical: 'top',
        fontSize: 15,
        color: '#111827',
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: '#111827',
    },
    submitButton: {
        backgroundColor: Colors.light.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    planSelectionItem: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    planSelectionItemActive: {
        backgroundColor: '#EFF6FF',
        borderColor: Colors.light.primary,
    },
    planSelectionText: {
        fontSize: 14,
        color: '#4B5563',
    },
    planSelectionTextActive: {
        color: Colors.light.primary,
        fontWeight: '500',
    },
    fileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        backgroundColor: '#F9FAFB',
    },
    fileButtonText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#6B7280',
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statusOptionActive: {
        backgroundColor: '#EFF6FF',
        borderColor: Colors.light.primary,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    statusOptionText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
        flex: 1,
    },
});


