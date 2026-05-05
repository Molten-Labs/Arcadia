import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { VaultView } from '../lib/mockData';
import { StatusBadge } from './StatusBadge';
import { HealthMeter } from './HealthMeter';
import { formatUSD, formatBps, formatNav } from '../lib/format';

interface Props {
  vault: VaultView;
  onPress: () => void;
}

export function VaultCard({ vault, onPress }: Props) {
  const navChange = vault.currentNav - 1;
  const navPositive = navChange >= 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{vault.name}</Text>
          <StatusBadge status={vault.status} size="sm" />
        </View>
        <View style={styles.navCol}>
          <Text style={styles.navLabel}>NAV</Text>
          <Text style={styles.navValue}>{formatNav(vault.currentNav)}</Text>
          <Text style={[styles.navChange, { color: navPositive ? colors.signal : colors.danger }]}>
            {navPositive ? '+' : ''}{(navChange * 100).toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TVL</Text>
          <Text style={styles.statValue}>{formatUSD(vault.tvl, true)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>FEE</Text>
          <Text style={styles.statValue}>{formatBps(vault.feeBps)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>EXIT</Text>
          <Text style={[styles.statValue, { color: vault.instantExit ? colors.signal : colors.textMuted }]}>
            {vault.instantExit ? 'Instant' : 'Cooldown'}
          </Text>
        </View>
      </View>

      <HealthMeter health={vault.juniorHealth} height={5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 14,
  },
  pressed: {
    opacity: 0.75,
    borderColor: colors.signal + '55',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    gap: 6,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  navCol: {
    alignItems: 'flex-end',
  },
  navLabel: {
    fontSize: 9,
    color: colors.textQuiet,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  navValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  navChange: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Courier',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 9,
    color: colors.textQuiet,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Courier',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
});
