import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  flex?: number;
}

export function StatCard({ label, value, sub, valueColor, flex }: Props) {
  return (
    <View style={[styles.card, flex !== undefined && { flex }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 11,
    color: colors.textQuiet,
  },
});
