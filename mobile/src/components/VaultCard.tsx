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
import { Ionicons } from '@expo/vector-icons';
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
        Animated.timing(ring, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={pulse.wrap}>
      <Animated.View style={[pulse.ring, {
        opacity: ring.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 0, 0] }),
        transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
      }]} />
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
  const fadeY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeOp, { toValue: 1, duration: 380, delay: entryDelay, useNativeDriver: true }),
      Animated.timing(fadeY, { toValue: 0, duration: 380, delay: entryDelay, useNativeDriver: true }),
    ]).start();
  }, []);

  const initial = vault.name.charAt(0).toUpperCase();
  const navPct = Math.abs(navChange * 100).toFixed(2);

  return (
    <Animated.View style={{ opacity: fadeOp, transform: [{ translateY: fadeY }] }}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => scale.value = withSpring(0.978, { damping: 22, stiffness: 400 })}
        onPressOut={() => scale.value = withSpring(1, { damping: 16, stiffness: 280 })}
        style={[styles.card, animStyle]}
      >
        {isActive && (
          <LinearGradient
            colors={['rgba(0,217,140,0.05)', 'rgba(0,217,140,0.01)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        )}

        {/* Header */}
        <View style={styles.header}>
          {/* Avatar */}
          <View style={[styles.avatar, isActive && styles.avatarActive]}>
            <Text style={[styles.avatarText, isActive && styles.avatarTextActive]}>
              {initial}
            </Text>
          </View>

          {/* Title + status */}
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              {isActive && <LivePulse />}
              <Text style={styles.vaultName} numberOfLines={1}>{vault.name}</Text>
            </View>
            <StatusBadge status={vault.status} size="sm" />
          </View>

          {/* APY block */}
          <View style={[
            styles.apyBlock,
            apyNum > 0 && styles.apyBlockActive,
          ]}>
            <Text style={styles.apyLabel}>APY</Text>
            <Text style={[styles.apyValue, apyNum > 0 && { color: colors.signal }]}>
              {apyStr}
            </Text>
          </View>
        </View>

        {/* NAV row */}
        <View style={styles.navRow}>
          <View style={styles.navLeft}>
            <Text style={styles.navLabel}>NAV</Text>
            <Text style={styles.navValue}>{formatNav(vault.currentNav)}</Text>
            <View style={styles.navDeltaRow}>
              <Ionicons
                name={navPositive ? 'trending-up' : 'trending-down'}
                size={12}
                color={navPositive ? colors.signal : colors.danger}
              />
              <Text style={[styles.navDelta, { color: navPositive ? colors.signal : colors.danger }]}>
                {navPct}%
              </Text>
            </View>
          </View>
          <View style={styles.sparkWrap}>
            {sparkData && sparkData.length > 2 && (
              <NavSparkline data={sparkData} width={110} height={48} positive={navPositive} />
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatUSD(vault.tvl, true)}</Text>
            <Text style={styles.statLabel}>TVL</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: hColor }]}>{hPct.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Health</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatBps(vault.feeBps)}</Text>
            <Text style={styles.statLabel}>Perf Fee</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, {
              color: vault.instantExit ? colors.signal : colors.textMuted,
              fontSize: 11,
            }]}>
              {vault.instantExit ? 'Instant' : 'Delayed'}
            </Text>
            <Text style={styles.statLabel}>Exit</Text>
          </View>
        </View>

        {/* Health bar */}
        <View style={styles.healthTrack}>
          <View style={[styles.healthFill, {
            width: `${vault.juniorHealth * 100}%` as any,
            backgroundColor: hColor,
            shadowColor: hColor,
            shadowOpacity: 0.5,
            shadowRadius: 5,
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
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.20,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signalBorder,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
  },
  avatarTextActive: {
    color: colors.signal,
  },

  titleBlock: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  vaultName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },

  apyBlock: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 58,
    gap: 2,
  },
  apyBlockActive: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signalBorder,
  },
  apyLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textQuiet,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  apyValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
    fontFamily: 'Courier',
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  navLeft: { gap: 2 },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  navValue: {
    fontSize: 30,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Courier',
    letterSpacing: -1,
    lineHeight: 36,
  },
  navDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navDelta: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  sparkWrap: { alignItems: 'flex-end', paddingBottom: 2 },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -18,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statSep: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  healthTrack: {
    height: 3,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  healthFill: {
    height: 3,
    borderRadius: radius.full,
  },
});
