import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

const now = Math.floor(Date.now() / 1000);

function calcAPY(vault: VaultView): string {
  const days = vault.graduatedAt > 0
    ? Math.max(1, (now - vault.graduatedAt) / 86400)
    : vault.paperTradeCount > 0 ? vault.paperTradeCount : null;
  if (!days || vault.status === 'paper') return '—';
  const apy = (Math.pow(vault.currentNav, 365 / days) - 1) * 100;
  if (!isFinite(apy) || apy > 9999) return '>999%';
  return `${apy.toFixed(1)}%`;
}

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.9, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={dotStyles.wrap}>
      <Animated.View style={[dotStyles.ring, { transform: [{ scale }], opacity }]} />
      <View style={dotStyles.core} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  wrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.signal },
  core: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.signal, position: 'absolute' },
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
  const hColor = vault.juniorHealth >= 0.8 ? colors.signal
    : vault.juniorHealth >= 0.6 ? colors.warning : colors.danger;
  const apy = calcAPY(vault);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 380, delay: entryDelay, useNativeDriver: true }),
      Animated.timing(entryY, { toValue: 0, duration: 380, delay: entryDelay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: entryOpacity, transform: [{ translateY: entryY }] }}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 340 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
        style={[styles.card, animatedStyle]}
      >
        {vault.status === 'active' && (
          <LinearGradient
            colors={['rgba(0,200,150,0.07)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        <View style={styles.top}>
          <View style={styles.iconCol}>
            <LinearGradient
              colors={vault.status === 'active'
                ? [colors.signal + 'CC', colors.signalDeep]
                : [colors.surfaceHigh, colors.surfaceElevated]}
              style={styles.icon}
            >
              <Text style={[styles.iconInitial, {
                color: vault.status === 'active' ? colors.white : colors.textMuted
              }]}>
                {vault.name.charAt(0)}
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.nameCol}>
            <View style={styles.nameRow}>
              {vault.status === 'active' && <PulseDot />}
              <Text style={styles.name} numberOfLines={1}>{vault.name}</Text>
            </View>
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

        <View style={styles.bentoRow}>
          <View style={styles.bentoCell}>
            <Text style={styles.bentoLabel}>TVL</Text>
            <Text style={styles.bentoValue}>{formatUSD(vault.tvl, true)}</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={styles.bentoLabel}>APY</Text>
            <Text style={[styles.bentoValue, { color: apy !== '—' ? colors.signal : colors.textMuted }]}>
              {apy}
            </Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={styles.bentoLabel}>HEALTH</Text>
            <Text style={[styles.bentoValue, { color: hColor }]}>
              {(vault.juniorHealth * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={styles.bentoLabel}>FEE</Text>
            <Text style={styles.bentoValue}>{formatBps(vault.feeBps)}</Text>
          </View>
        </View>

        <View style={styles.healthBar}>
          <Animated.View style={[styles.healthFill, {
            width: `${vault.juniorHealth * 100}%`,
            backgroundColor: hColor,
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
    padding: spacing.md,
    gap: 14,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCol: { paddingTop: 2 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInitial: { fontSize: 18, fontWeight: '700', fontFamily: 'Courier' },
  nameCol: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2, flex: 1 },
  navCol: { alignItems: 'flex-end', gap: 1 },
  navValue: { fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  navDelta: { fontSize: 11, fontWeight: '700', fontFamily: 'Courier' },
  bentoRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  bentoCell: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  bentoDivider: { width: 1, backgroundColor: colors.border },
  bentoLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textQuiet,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Courier',
  },
  bentoValue: { fontSize: 12, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  healthBar: { height: 3, backgroundColor: colors.surfaceHigh, borderRadius: radius.full, overflow: 'hidden' },
  healthFill: { height: 3, borderRadius: radius.full },
});
