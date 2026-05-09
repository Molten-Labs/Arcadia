import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated2, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../lib/theme';
import { VaultView } from '../lib/mockData';
import { StatusBadge } from './StatusBadge';
import { NavSparkline } from './NavSparkline';
import { formatUSD, formatBps, formatNav } from '../lib/format';

const AnimatedPressable = Animated2.createAnimatedComponent(Pressable);

const NOW = Math.floor(Date.now() / 1000);

function calcAPY(vault: VaultView): { value: string; num: number } {
  const days = vault.graduatedAt > 0
    ? Math.max(1, (NOW - vault.graduatedAt) / 86400)
    : null;
  if (!days || vault.status === 'paper') return { value: '—', num: 0 };
  const apy = (Math.pow(vault.currentNav, 365 / days) - 1) * 100;
  if (!isFinite(apy) || apy > 9999) return { value: '>999%', num: 9999 };
  return { value: `${apy.toFixed(1)}%`, num: apy };
}

function LivePulse() {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  };

  return (
    <View style={pulse.wrap}>
      <Animated.View style={[pulse.ring, ringStyle]} />
      <View style={pulse.dot} />
    </View>
  );
}

const pulse = StyleSheet.create({
  wrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.signal },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.signal },
});

interface Props {
  vault: VaultView;
  onPress: () => void;
  sparkData?: number[];
  entryDelay?: number;
}

export function VaultCard({ vault, onPress, sparkData, entryDelay = 0 }: Props) {
  const navChange = vault.currentNav - 1;
  const navPositive = navChange >= 0;
  const hPct = vault.juniorHealth * 100;
  const hColor = vault.juniorHealth >= 0.8 ? colors.signal
    : vault.juniorHealth >= 0.6 ? colors.warning : colors.danger;
  const { value: apyStr, num: apyNum } = calcAPY(vault);
  const isActive = vault.status === 'active';

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fadeOp = useRef(new Animated.Value(0)).current;
  const fadeY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeOp, { toValue: 1, duration: 420, delay: entryDelay, useNativeDriver: true }),
      Animated.timing(fadeY, { toValue: 0, duration: 420, delay: entryDelay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeOp, transform: [{ translateY: fadeY }] }}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => scale.value = withSpring(0.975, { damping: 20, stiffness: 380 })}
        onPressOut={() => scale.value = withSpring(1, { damping: 14, stiffness: 260 })}
        style={[styles.card, animStyle, isActive && styles.cardActive]}
      >
        {isActive && (
          <LinearGradient
            colors={['rgba(0,200,150,0.06)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        )}

        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={isActive ? [colors.signal, colors.signalDeep] : [colors.surfaceHigh, colors.surfaceElevated]}
              style={styles.icon}
            >
              <Text style={[styles.iconText, { color: isActive ? colors.white : colors.textMuted }]}>
                {vault.name.charAt(0)}
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              {isActive && <LivePulse />}
              <Text style={styles.vaultName} numberOfLines={1}>{vault.name}</Text>
            </View>
            <StatusBadge status={vault.status} size="sm" />
          </View>

          {/* APY pill — big accent */}
          <View style={[
            styles.apyPill,
            apyNum > 0 && { backgroundColor: colors.signalDim, borderColor: colors.signal + '50' },
          ]}>
            <Text style={styles.apyLabel}>APY</Text>
            <Text style={[styles.apyValue, apyNum > 0 && { color: colors.signal }]}>
              {apyStr}
            </Text>
          </View>
        </View>

        {/* NAV + Sparkline */}
        <View style={styles.navRow}>
          <View style={styles.navBlock}>
            <Text style={styles.navLabel}>NAV</Text>
            <Text style={styles.navValue}>{formatNav(vault.currentNav)}</Text>
            <Text style={[styles.navDelta, { color: navPositive ? colors.signal : colors.danger }]}>
              {navPositive ? '▲' : '▼'} {Math.abs(navChange * 100).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.sparkWrap}>
            {sparkData && sparkData.length > 2 && (
              <NavSparkline data={sparkData} width={100} height={44} positive={navPositive} />
            )}
          </View>
        </View>

        {/* Stats row — values intentionally bigger than labels */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatUSD(vault.tvl, true)}</Text>
            <Text style={styles.statLabel}>TVL</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: hColor }]}>{hPct.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>HEALTH</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatBps(vault.feeBps)}</Text>
            <Text style={styles.statLabel}>PERF FEE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: vault.instantExit ? colors.signal : colors.textMuted }]}>
              {vault.instantExit ? 'INSTANT' : 'COOL'}
            </Text>
            <Text style={styles.statLabel}>EXIT</Text>
          </View>
        </View>

        {/* Health bar with glow */}
        <View style={styles.healthTrack}>
          <View style={[styles.healthFill, {
            width: `${vault.juniorHealth * 100}%` as any,
            backgroundColor: hColor,
            shadowColor: hColor,
            shadowOpacity: 0.6,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          }]} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: colors.signal + '28',
    shadowColor: colors.signal,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {},
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 19, fontWeight: '800', fontFamily: 'Courier' },

  titleBlock: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vaultName: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.3, flex: 1 },

  apyPill: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 56,
  },
  apyLabel: { fontSize: 8, fontWeight: '700', color: colors.textQuiet, letterSpacing: 0.8, fontFamily: 'Courier' },
  apyValue: { fontSize: 17, fontWeight: '800', color: colors.textMuted, fontFamily: 'Courier', marginTop: 1 },

  navRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  navBlock: { gap: 2 },
  navLabel: { fontSize: 9, fontWeight: '600', color: colors.textQuiet, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: 'Courier' },
  navValue: { fontSize: 28, fontWeight: '600', color: colors.text, fontFamily: 'Courier', letterSpacing: -1 },
  navDelta: { fontSize: 12, fontWeight: '700', fontFamily: 'Courier' },
  sparkWrap: { alignItems: 'flex-end' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  statLabel: { fontSize: 7, fontWeight: '700', color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Courier' },

  healthTrack: {
    height: 4,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 99,
    overflow: 'hidden',
  },
  healthFill: { height: 4, borderRadius: 99 },
});
