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
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, TextInput, TouchableOpacity } from 'react-native';

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
                data.action_plans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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


