import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const EMOJI_FALLBACK: Partial<Record<string, string>> = {
  'layers-outline': '📦',
  'briefcase-outline': '💼',
  'people-outline': '👥',
  'stats-chart-outline': '📊',
  'wallet-outline': '👛',
  'flask-outline': '🧪',
  'swap-horizontal-outline': '🔁',
  'trending-up': '📈',
  'trending-down': '📉',
  'shield-checkmark-outline': '🛡️',
  'alert-circle-outline': '⚠️',
  'checkmark-circle-outline': '✅',
  'close-circle-outline': '❌',
  'information-circle-outline': 'ℹ️',
  'search-outline': '🔍',
  'lock-closed-outline': '🔒',
  'time-outline': '⏱️',
  'star-outline': '⭐',
  'trophy-outline': '🏆',
  'diamond-outline': '💎',
};

interface Props {
  icon?: string;
  iconName?: IoniconName;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, iconName, title, subtitle }: Props) {
  const emojiIcon = iconName ? EMOJI_FALLBACK[iconName] : null;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {iconName && !emojiIcon ? (
          <Ionicons name={iconName} size={28} color={colors.textQuiet} />
        ) : (
          <Text style={styles.iconText}>
            {emojiIcon ?? icon ?? '○'}
          </Text>
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
  iconText: {
    fontSize: 30,
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
