import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  Activity,
  AlertCircle,
  Bell,
  ChevronRight,
  PieChart,
  ShieldCheck
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      let query = supabase
        .from('audit_recommendations')
        .select('status');

      // ENFORCE RLS (Client-side filtering for stats)
      // Note: Ideally proper RLS policies on Supabase prevent fetching, but we filter here for UI consistency
      if (profile && profile.role !== 'auditor' && profile.role !== 'director') {
        if (profile.department_id) {
          query = query.eq('department_id', profile.department_id);
        } else {
          return { Green: 0, Yellow: 0, Red: 0, Purple: 0 };
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        Green: data.filter(r => r.status === 'Green').length,
        Yellow: data.filter(r => r.status === 'Yellow').length,
        Red: data.filter(r => r.status === 'Red').length,
        Purple: data.filter(r => r.status === 'Purple').length,
      };
    }
  });

  const StatCard = ({ label, count, color, bgColor, icon }: { label: string, count: number, color: string, bgColor: string, icon: React.ReactNode }) => (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        {icon}
      </View>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#FFFFFF" />}
      >
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerSubtitle}>Audit Recommendation Tracking System</Text>
            <Text style={styles.headerTitle}>Hello, {profile?.full_name || 'Auditor'}</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Bell size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {isLoading && !stats ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
          ) : (
            <>
              {/* Statistics Grid */}
              <View style={styles.gridContainer}>
                <StatCard
                  label="Fully Implemented"
                  count={stats?.Green || 0}
                  color="#10B981"
                  bgColor="#D1FAE5"
                  icon={<ShieldCheck size={24} color="#10B981" />}
                />
                <StatCard
                  label="Partially"
                  count={stats?.Yellow || 0}
                  color="#F59E0B"
                  bgColor="#FEF3C7"
                  icon={<Activity size={24} color="#F59E0B" />}
                />
                <StatCard
                  label="Not Implemented"
                  count={stats?.Red || 0}
                  color="#EF4444"
                  bgColor="#FEE2E2"
                  icon={<AlertCircle size={24} color="#EF4444" />}
                />
                <StatCard
                  label="Mgmt Control"
                  count={stats?.Purple || 0}
                  color="#8B5CF6"
                  bgColor="#EDE9FE"
                  icon={<PieChart size={24} color="#8B5CF6" />}
                />
              </View>

              {/* Quick Actions Section */}
              <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/(tabs)/recommendations')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>View All Recommendations</Text>
                  <ChevronRight size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E3A8A', // Deep Blue for the top notch area
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Light Gray for the main content background
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingTop: 20, // Adjust based on preference, SafeAreaView handles the notch
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bellButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24, // Overlap the header slightly for a modern look
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    overflow: 'hidden', // Ensures the radius clips content
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  card: {
    width: '48%', // 2-column grid with gap handled by space-between
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    // Shadow properties
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'flex-start',
  },
  iconContainer: {
    padding: 10,
    borderRadius: 50,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCount: {
    fontSize: 28, // Big Bold Number
    fontWeight: '800',
    color: '#111827', // Black/Dark Gray
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280', // Medium Gray
  },
  actionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
