// Comprehensive color system for ARTS
const tintColorLight = '#2563EB'; // Blue 600
const tintColorDark = '#3B82F6'; // Blue 500

export const AuditStatusColors = {
  Green: '#10B981', // Fully implemented
  Yellow: '#F59E0B', // Partially implemented
  Red: '#EF4444', // Not implemented
  Purple: '#8B5CF6', // Beyond management control
  Blue: '#3B82F6', // Not applicable
};

export const Colors = {
  light: {
    text: '#111827', // Gray 900
    textSecondary: '#6B7280', // Gray 500
    background: '#F9FAFB', // Gray 50
    card: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    border: '#E5E7EB',
    primary: '#2563EB',
    success: AuditStatusColors.Green,
    warning: AuditStatusColors.Yellow,
    danger: AuditStatusColors.Red,
    info: AuditStatusColors.Blue,
    purple: AuditStatusColors.Purple,
  },
  dark: {
    text: '#F3F4F6', // Gray 100
    textSecondary: '#9CA3AF', // Gray 400
    background: '#111827', // Gray 900
    card: '#1F2937', // Gray 800
    tint: tintColorDark,
    tabIconDefault: '#4B5563',
    tabIconSelected: tintColorDark,
    border: '#374151',
    primary: '#3B82F6',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
    purple: '#A78BFA',
  },
};

export default Colors;
