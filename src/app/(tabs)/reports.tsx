import { AuditStatusColors, Colors } from '@/constants/Colors';
import { supabase } from '@/services/supabase';
import { Database } from '@/types/database.types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import { Download, FileText, Filter, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Department = Database['public']['Tables']['departments']['Row'];
type Recommendation = Database['public']['Tables']['audit_recommendations']['Row'] & {
    departments: { name: string } | null;
};

const STATUS_OPTIONS = ['All', 'Green', 'Yellow', 'Red', 'Purple', 'Blue'] as const;

export default function ReportsScreen() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Default to last 1 year
    const [startDate, setStartDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
    const [endDate, setEndDate] = useState(new Date());

    const [reportData, setReportData] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchReport();
    }, []);

    const fetchDepartments = async () => {
        const { data } = await supabase.from('departments').select('*');
        if (data) setDepartments(data);
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            // Fetch all data within date range first, then filter locally for Search/Status
            // This is better for UX on small-medium datasets
            const { data, error } = await supabase
                .from('audit_recommendations')
                .select('*, departments(name)')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReportData(data || []);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', 'Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const filteredData = reportData.filter(item => {
        const matchesDept = !selectedDept || item.department_id === selectedDept;
        const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
        const matchesSearch =
            (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.departments?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

        return matchesDept && matchesStatus && matchesSearch;
    });

    const getStatusColor = (status: string) => {
        return (AuditStatusColors as any)[status] || Colors.light.textSecondary;
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'Green': return '#D1FAE5';
            case 'Yellow': return '#FEF3C7';
            case 'Red': return '#FEE2E2';
            case 'Purple': return '#EDE9FE';
            case 'Blue': return '#DBEAFE';
            default: return '#F3F4F6';
        }
    };

    const generatePdf = async () => {
        if (filteredData.length === 0) {
            Alert.alert('Notice', 'No data to export');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
                    h1 { color: #1E3A8A; text-align: center; margin-bottom: 5px; font-size: 24px; }
                    .subtitle { text-align: center; color: #6B7280; font-size: 14px; margin-bottom: 40px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
                    th, td { border: 1px solid #E5E7EB; padding: 12px 16px; text-align: left; font-size: 12px; }
                    th { background-color: #F9FAFB; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
                    tr:nth-child(even) { background-color: #F9FAFB; }
                    .status-badge { padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; display: inline-block; text-align: center; min-width: 60px; }
                </style>
            </head>
            <body>
                <h1>ARTS Audit Report</h1>
                <div class="subtitle">
                    Generated on ${format(new Date(), 'PPP')} <br/>
                    Filter: ${statusFilter} Status | ${selectedDept ? departments.find(d => d.id === selectedDept)?.name : 'All Departments'}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">#</th>
                            <th style="width: 40%">Recommendation Title</th>
                            <th style="width: 25%">Department</th>
                            <th style="width: 15%">Status</th>
                            <th style="width: 15%">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map((item, index) => {
            const bg = getStatusBg(item.status);
            const color = getStatusColor(item.status);
            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td><strong>${item.title}</strong></td>
                                    <td>${item.departments?.name || 'N/A'}</td>
                                    <td>
                                        <span class="status-badge" style="background-color: ${bg}; color: ${color};">
                                            ${item.status}
                                        </span>
                                    </td>
                                    <td>${format(new Date(item.created_at), 'MMM dd, yyyy')}</td>
                                </tr>
                            `;
        }).join('')}
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

    const exportCsv = async () => {
        if (filteredData.length === 0) {
            Alert.alert('Notice', 'No data to export');
            return;
        }

        const headers = "ID,Title,Description,Department,Status,Created At";
        const rows = filteredData.map(item =>
            // Escape quotes and handle commas for CSV format
            `"${item.id}","${item.title.replace(/"/g, '""')}","${(item.description || '').replace(/"/g, '""')}","${item.departments?.name || ''}","${item.status}","${item.created_at}"`
        ).join('\n');

        const csvContent = `${headers}\n${rows}`;

        try {
            const result = await Share.share({
                message: csvContent,
                title: 'ARTS_Export.csv'
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share CSV data');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerSubtitle}>Overview</Text>
                    <Text style={styles.headerTitle}>Reports & Analytics</Text>
                </View>
            </View>

            <View style={styles.controlsContainer}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Search size={20} color={Colors.light.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by title or department..."
                        placeholderTextColor={Colors.light.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filters ScrollView */}
                <View style={styles.filtersWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                        style={{ marginBottom: 12 }}
                    >
                        <View style={styles.filterGroupLabel}>
                            <Filter size={14} color="#6B7280" />
                            <Text style={styles.filterGroupText}>Dept:</Text>
                        </View>
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

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                    >
                        <View style={styles.filterGroupLabel}>
                            <ActivityIndicator size={1} color="transparent" />
                            {/* Hack for alignment or just separate label */}
                            <Text style={styles.filterGroupText}>Status:</Text>
                        </View>
                        {STATUS_OPTIONS.map((status) => (
                            <TouchableOpacity
                                key={status}
                                style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                                onPress={() => setStatusFilter(status)}
                            >
                                <View style={[styles.statusDot, { backgroundColor: status === 'All' ? '#9CA3AF' : getStatusColor(status) }]} />
                                <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>{status}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Results Header with Actions */}
            <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                    Showing {filteredData.length} records
                </Text>
                <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={exportCsv} style={[styles.iconButton, { marginRight: 8 }]}>
                        <FileText size={20} color={Colors.light.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={generatePdf} style={styles.iconButton}>
                        <Download size={20} color={Colors.light.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={[styles.center, { flex: 1 }]}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent}>
                    {filteredData.length > 0 ? (
                        filteredData.map((item) => (
                            <View key={item.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                            {item.status}
                                        </Text>
                                    </View>
                                    <Text style={styles.dateText}>{format(new Date(item.created_at), 'MMM dd, yyyy')}</Text>
                                </View>

                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardDept}>
                                    Dept: <Text style={{ fontWeight: '600' }}>{item.departments?.name || 'N/A'}</Text>
                                </Text>

                                <View style={styles.cardFooter}>
                                    <Text style={styles.idText}>ID: ...{item.id.slice(-6)}</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No recommendations match your filters.</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        backgroundColor: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111827',
    },
    controlsContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
    },
    filtersWrapper: {
        gap: 0,
    },
    filterRow: {
        alignItems: 'center',
        paddingRight: 10,
    },
    filterGroupLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
        width: 60,
    },
    filterGroupText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginLeft: 4,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#EFF6FF',
        borderColor: Colors.light.primary,
    },
    filterChipText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: Colors.light.primary,
        fontWeight: '600',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    resultsCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    actionButtons: {
        flexDirection: 'row',
    },
    iconButton: {
        padding: 8,
        backgroundColor: '#DBEAFE',
        borderRadius: 8,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    dateText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
        lineHeight: 22,
    },
    cardDept: {
        fontSize: 13,
        color: '#4B5563',
        marginBottom: 8,
    },
    cardFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: 8,
    },
    idText: {
        fontSize: 11,
        color: '#9CA3AF',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
