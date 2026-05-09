import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon?: string;
  iconName?: IoniconName;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, iconName, title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {iconName ? (
          <Ionicons name={iconName} size={28} color={colors.textQuiet} />
        ) : (
          <Text style={styles.iconText}>{icon ?? '○'}</Text>
        )}
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
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconText: {
    fontSize: 26,
    color: colors.textQuiet,
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
