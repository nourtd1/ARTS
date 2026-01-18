import { Colors } from '@/constants/Colors';
import { supabase } from '@/services/supabase';
import { Database } from '@/types/database.types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import { Download } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Department = Database['public']['Tables']['departments']['Row'];
type Recommendation = Database['public']['Tables']['audit_recommendations']['Row'] & {
    departments: { name: string } | null;
};

export default function ReportsScreen() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    // Simple mock date range for now, ideally use DateTimePicker
    const [startDate, setStartDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
    const [endDate, setEndDate] = useState(new Date());

    const [reportData, setReportData] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        fetchReport();
    }, [selectedDept]);

    const fetchDepartments = async () => {
        const { data } = await supabase.from('departments').select('*');
        if (data) setDepartments(data);
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_recommendations')
                .select('*, departments(name)')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            if (selectedDept) {
                query = query.eq('department_id', selectedDept);
            }

            const { data, error } = await query;
            if (error) throw error;
            setReportData(data || []);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', 'Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const generatePdf = async () => {
        if (reportData.length === 0) {
            Alert.alert('Notice', 'No data to export');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
                    h1 { color: #111827; text-align: center; margin-bottom: 10px; }
                    .meta { text-align: center; color: #6B7280; font-size: 14px; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #E5E7EB; padding: 12px; text-align: left; font-size: 12px; }
                    th { background-color: #F9FAFB; font-weight: bold; color: #374151; }
                    tr:nth-child(even) { background-color: #F9FAFB; }
                    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: white; display: inline-block;}
                </style>
            </head>
            <body>
                <h1>Audit Recommendation Report</h1>
                <div class="meta">
                    Generated on ${format(new Date(), 'PPP')} <br/>
                    Period: ${format(startDate, 'PP')} - ${format(endDate, 'PP')} <br/>
                    ${selectedDept ? `Department: ${departments.find(d => d.id === selectedDept)?.name}` : 'All Departments'}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Ref #</th>
                            <th>Title</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Date Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.title}</td>
                                <td>${item.departments?.name || 'N/A'}</td>
                                <td>${item.status}</td>
                                <td>${format(new Date(item.created_at), 'MMM dd, yyyy')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Print.printAsync({ uri });
        } catch (e) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Audit Reports</Text>
                <TouchableOpacity onPress={generatePdf} style={styles.exportBtn}>
                    <Download size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.exportBtnText}>Export PDF</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
                <Text style={styles.sectionLabel}>Filter by Department</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, !selectedDept && styles.filterChipActive]}
                        onPress={() => setSelectedDept(null)}
                    >
                        <Text style={[styles.filterChipText, !selectedDept && styles.filterChipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {departments.map((dept) => (
                        <TouchableOpacity
                            key={dept.id}
                            style={[styles.filterChip, selectedDept === dept.id && styles.filterChipActive]}
                            onPress={() => setSelectedDept(dept.id)}
                        >
                            <Text style={[styles.filterChipText, selectedDept === dept.id && styles.filterChipTextActive]}>{dept.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.tableHeader}>
                <Text style={[styles.columnHeader, { flex: 2 }]}>Recommendation</Text>
                <Text style={[styles.columnHeader, { flex: 1 }]}>Dept</Text>
                <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Status</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.tableBody}>
                    {reportData.length > 0 ? (
                        reportData.map((item) => (
                            <View key={item.id} style={styles.tableRow}>
                                <View style={{ flex: 2, paddingRight: 8 }}>
                                    <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                                    <Text style={styles.rowDate}>{format(new Date(item.created_at), 'MMM dd, yyyy')}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowDept} numberOfLines={1}>{item.departments?.name}</Text>
                                </View>
                                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                    <View style={[styles.statusBadge, {
                                        backgroundColor: item.status === 'Green' ? '#DEF7EC' :
                                            item.status === 'Red' ? '#FDE8E8' : '#FEF3C7'
                                    }]}>
                                        <Text style={[styles.statusText, {
                                            color: item.status === 'Green' ? '#03543F' :
                                                item.status === 'Red' ? '#9B1C1C' : '#92400E'
                                        }]}>
                                            {item.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No recommendations found for this period.</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    exportBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    filterSection: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginLeft: 20,
        marginBottom: 12,
    },
    filterScroll: {
        paddingHorizontal: 20,
        gap: 12,
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
        backgroundColor: '#EFF6FF',
        borderColor: Colors.light.primary,
    },
    filterChipText: {
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: Colors.light.primary,
        fontWeight: '600',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    columnHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    tableBody: {
        paddingBottom: 40,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    rowTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    rowDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    rowDept: {
        fontSize: 13,
        color: '#4B5563',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
});
