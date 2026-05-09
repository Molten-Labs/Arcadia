import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';

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
      <Text numberOfLines={1} style={[styles.value, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 4,
  },
  cardAccent: {
    borderColor: colors.signalBorder,
    backgroundColor: colors.signalDim,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sub: {
    fontSize: 11,
    color: colors.textQuiet,
    fontFamily: 'Courier',
  },
});
