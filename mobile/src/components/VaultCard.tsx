import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../lib/theme';
import { VaultView } from '../lib/mockData';
import { StatusBadge } from './StatusBadge';
import { NavSparkline } from './NavSparkline';
import { formatUSD, formatBps, formatNav } from '../lib/format';

interface Props {
  vault: VaultView;
  onPress: () => void;
  sparkData?: number[];
}

export function VaultCard({ vault, onPress, sparkData }: Props) {
  const navChange = vault.currentNav - 1;
  const navPositive = navChange >= 0;
  const hColor = vault.juniorHealth >= 0.8 ? colors.signal
    : vault.juniorHealth >= 0.6 ? colors.warning : colors.danger;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {vault.status === 'active' && (
        <LinearGradient
          colors={['rgba(0,181,164,0.08)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Top row */}
      <View style={styles.top}>
        <View style={styles.iconCol}>
          <View style={styles.icon}>
            <Text style={styles.iconInitial}>{vault.name.charAt(0)}</Text>
          </View>
        </View>

        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{vault.name}</Text>
          <StatusBadge status={vault.status} size="sm" />
        </View>

        <View style={styles.navCol}>
          {sparkData && sparkData.length > 2 && (
            <NavSparkline data={sparkData} width={56} height={24} positive={navPositive} />
          )}
          <Text style={styles.navValue}>{formatNav(vault.currentNav)}</Text>
          <Text style={[styles.navDelta, { color: navPositive ? colors.signal : colors.danger }]}>
            {navPositive ? '▲' : '▼'} {Math.abs(navChange * 100).toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Bento stats */}
      <View style={styles.bentoRow}>
        <View style={styles.bentoCell}>
          <Text style={styles.bentoLabel}>TVL</Text>
          <Text style={styles.bentoValue}>{formatUSD(vault.tvl, true)}</Text>
        </View>
        <View style={styles.bentoCell}>
          <Text style={styles.bentoLabel}>FEE</Text>
          <Text style={styles.bentoValue}>{formatBps(vault.feeBps)}</Text>
        </View>
        <View style={styles.bentoCell}>
          <Text style={styles.bentoLabel}>HEALTH</Text>
          <Text style={[styles.bentoValue, { color: hColor }]}>
            {(vault.juniorHealth * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.bentoCell}>
          <Text style={styles.bentoLabel}>EXIT</Text>
          <Text style={[styles.bentoValue, { color: vault.instantExit ? colors.signal : colors.textMuted }]}>
            {vault.instantExit ? '⚡' : '⏳'}
          </Text>
        </View>
      </View>

      {/* Health bar */}
      <View style={styles.healthBar}>
        <View style={[styles.healthFill, {
          width: `${vault.juniorHealth * 100}%`,
          backgroundColor: hColor,
        }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 14,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.78, borderColor: colors.signal + '50' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCol: { paddingTop: 2 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.signal,
    fontFamily: 'Courier',
  },
  nameCol: { flex: 1, gap: 6 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  navCol: { alignItems: 'flex-end', gap: 1 },
  navValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Courier',
  },
  navDelta: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  bentoRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  bentoCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  bentoLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textQuiet,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Courier',
  },
  bentoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  healthBar: {
    height: 3,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  healthFill: { height: 3, borderRadius: radius.full },
});
