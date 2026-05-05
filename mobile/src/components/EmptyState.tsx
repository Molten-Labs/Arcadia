import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../lib/theme';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = '◇', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
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
  },
  icon: {
    fontSize: 36,
    color: colors.textQuiet,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textQuiet,
    textAlign: 'center',
    lineHeight: 20,
  },
});
