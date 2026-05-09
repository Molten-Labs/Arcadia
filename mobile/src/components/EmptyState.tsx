import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';

interface Props {
  icon?: string;
  iconName?: string;
  title: string;
  subtitle?: string;
}

const ACCENT_MAP: Record<string, string> = {
  'briefcase-outline': colors.signal,
  'layers-outline': colors.signal,
  'people-outline': colors.textQuiet,
  'stats-chart-outline': colors.signal,
  'wallet-outline': colors.textMuted,
  'flask-outline': colors.warning,
  'swap-horizontal-outline': colors.textMuted,
  'trending-up': colors.signal,
  'trending-down': colors.danger,
  'shield-checkmark-outline': colors.signal,
  'alert-circle-outline': colors.warning,
  'trophy-outline': colors.warning,
  'search-outline': colors.textMuted,
  'lock-closed-outline': colors.textQuiet,
};

export function EmptyState({ iconName, title, subtitle }: Props) {
  const accent = ACCENT_MAP[iconName ?? ''] ?? colors.textQuiet;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconDot, { backgroundColor: accent + '40' }]}>
          <View style={[styles.innerDot, { backgroundColor: accent }]} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: 10,
    minHeight: 220,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textQuiet,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
});
