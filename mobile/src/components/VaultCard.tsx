import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '../lib/theme';
import { VaultView } from '../lib/mockData';
import { StatusBadge } from './StatusBadge';
import { HealthMeter } from './HealthMeter';
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

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {vault.status === 'active' && (
        <LinearGradient
          colors={['rgba(0,181,164,0.08)', 'transparent']}
          style={styles.glowOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <View style={styles.top}>
        <View style={styles.topLeft}>
          <View style={styles.hexIcon}>
            <Text style={styles.hexInitial}>{vault.name.charAt(0)}</Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>{vault.name}</Text>
            <StatusBadge status={vault.status} size="sm" />
          </View>
        </View>

        <View style={styles.navBlock}>
          {sparkData && sparkData.length > 2 && (
            <View style={styles.sparkWrap}>
              <NavSparkline data={sparkData} width={60} height={28} positive={navPositive} />
            </View>
          )}
          <Text style={styles.navValue}>{formatNav(vault.currentNav)}</Text>
          <Text style={[styles.navChange, { color: navPositive ? colors.signal : colors.danger }]}>
            {navPositive ? '▲' : '▼'} {Math.abs(navChange * 100).toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>TVL</Text>
          <Text style={styles.statValue}>{formatUSD(vault.tvl, true)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>FEE</Text>
          <Text style={styles.statValue}>{formatBps(vault.feeBps)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>EXIT</Text>
          <Text style={[styles.statValue, { color: vault.instantExit ? colors.signal : colors.textMuted }]}>
            {vault.instantExit ? '⚡ Instant' : '⏳ Cool'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>JR. HEALTH</Text>
          <Text style={[styles.statValue, {
            color: vault.juniorHealth >= 0.8 ? colors.signal
              : vault.juniorHealth >= 0.6 ? colors.warning : colors.danger
          }]}>
            {(vault.juniorHealth * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      <HealthMeter health={vault.juniorHealth} showLabel={false} height={3} />
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
    overflow: 'hidden',
    position: 'relative',
  },
  pressed: {
    opacity: 0.82,
    borderColor: colors.signal + '66',
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  hexIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.signal,
    fontFamily: 'Courier',
  },
  nameBlock: {
    gap: 5,
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  navBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  sparkWrap: {
    marginBottom: 2,
  },
  navValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  navChange: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  statLabel: {
    fontSize: 8,
    color: colors.textQuiet,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
});
