import { Text, View } from '@/components/Themed';
import { AuditStatusColors, Colors } from '@/constants/Colors';
import { supabase } from '@/services/supabase';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { Activity, Bell, ChevronRight, PieChart, ShieldCheck } from 'lucide-react-native';
import React from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
// I'll build custom progress bars.

export default function DashboardScreen() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_recommendations')
        .select('status');

      if (error) throw error;

      const counts = {
        total: data.length,
        Green: data.filter(r => r.status === 'Green').length,
        Yellow: data.filter(r => r.status === 'Yellow').length,
        Red: data.filter(r => r.status === 'Red').length,
        Purple: data.filter(r => r.status === 'Purple').length,
        Blue: data.filter(r => r.status === 'Blue').length,
      };
      return counts;
    }
  });

  const router = useRouter();

  const QuickStat = ({ label, count, icon, color }: any) => (
    <View style={[styles.quickStatCard, { backgroundColor: color + '15' }]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={styles.quickStatCount}>{count}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="white" />}
      >
        {/* Premium Header Section */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Dashboard</Text>
              <Text style={styles.subGreeting}>Compliance Overview</Text>
            </View>
            <TouchableOpacity style={styles.notifButton}>
              <Bell color="white" size={24} />
              <View style={styles.badge} />
            </TouchableOpacity>
          </View>

          {/* Key Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats?.total || 0}</Text>
              <Text style={styles.metricLabel}>Total Audits</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats?.Green || 0}</Text>
              <Text style={styles.metricLabel}>Compliant</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{(stats?.total ? Math.round((stats.Green / stats.total) * 100) : 0)}%</Text>
              <Text style={styles.metricLabel}>Score</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContent}>

          {/* Status Grid */}
          <Text style={styles.sectionTitle}>Recommendations Status</Text>
          <View style={styles.gridContainer}>
            <QuickStat
              label="Fully Implemented"
              count={stats?.Green || 0}
              color={AuditStatusColors.Green}
              icon={<ShieldCheck size={20} color={AuditStatusColors.Green} />}
            />
            <QuickStat
              label="Partially Implemented"
              count={stats?.Yellow || 0}
              color={AuditStatusColors.Yellow}
              icon={<Activity size={20} color={AuditStatusColors.Yellow} />}
            />
            <QuickStat
              label="Not Implemented"
              count={stats?.Red || 0}
              color={AuditStatusColors.Red} // Using Red for urgent attention
              icon={<Activity size={20} color={AuditStatusColors.Red} />}
            />
            <QuickStat
              label="Mgmt Control"
              count={stats?.Purple || 0}
              color={AuditStatusColors.Purple}
              icon={<PieChart size={20} color={AuditStatusColors.Purple} />}
            />
          </View>

          {/* Action Card */}
          <View style={styles.actionCard}>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View All Recommendations</Text>
              <Text style={styles.actionDesc}>Check details and update status</Text>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/recommendations')}
            >
              <ChevronRight color="white" size={24} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 0.5,
  },
  subGreeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  notifButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    backdropFilter: 'blur(10px)',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  bodyContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    marginLeft: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickStatCard: {
    width: (Dimensions.get('window').width - 52) / 2, // 20px padding * 2 + 12px gap
    padding: 16,
    borderRadius: 20,
    alignItems: 'flex-start',
  },
  iconCircle: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  quickStatCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionButton: {
    backgroundColor: Colors.light.primary,
    padding: 12,
    borderRadius: 12,
  },
});
