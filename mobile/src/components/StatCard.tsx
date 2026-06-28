import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  flex?: number;
  accent?: boolean;
}

export function StatCard({ label, value, sub, valueColor, flex, accent }: Props) {
  return (
    <View style={[
      styles.card,
      flex !== undefined && { flex },
      accent && styles.cardAccent,
    ]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardAccent: {
    borderColor: colors.signal + '50',
    backgroundColor: colors.signalDim,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  value: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Courier',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 11,
    color: colors.textQuiet,
    fontFamily: 'Courier',
  },
});
