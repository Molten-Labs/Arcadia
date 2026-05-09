import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useManagers, ManagerWithVaults } from '../../src/hooks/useManagers';
import { FadeSlideIn } from '../../src/components/AnimatedEntry';
import { formatUSD, truncateAddress, formatAge } from '../../src/lib/format';

const ND = Platform.OS !== 'web';

const PODIUM_COLORS = [
  { ring: '#FFD700', dim: 'rgba(255,215,0,0.10)', label: 'GOLD' },
  { ring: '#C0C8D4', dim: 'rgba(192,200,212,0.10)', label: 'SILVER' },
  { ring: '#CD7F32', dim: 'rgba(205,127,50,0.10)', label: 'BRONZE' },
];

function getAvgHealth(m: ManagerWithVaults) {
  if (!m.vaults.length) return 0;
  return m.vaults.reduce((s, v) => s + v.juniorHealth, 0) / m.vaults.length;
}

function getTvl(m: ManagerWithVaults) {
  return m.vaults.reduce((s, v) => s + v.tvl, 0);
}

function getWinRate(m: ManagerWithVaults) {
  const active = m.vaults.filter(v => v.status === 'active').length;
  if (!m.vaults.length) return 0;
  return (active / m.vaults.length) * 100;
}

function healthColor(h: number) {
  return h >= 0.80 ? colors.signal : h >= 0.60 ? colors.warning : colors.danger;
}

function PodiumCard({
  manager,
  rank,
  onPress,
  large,
}: {
  manager: ManagerWithVaults;
  rank: number;
  onPress: () => void;
  large?: boolean;
}) {
  const p = PODIUM_COLORS[rank - 1];
  const tvl = getTvl(manager);
  const health = getAvgHealth(manager);
  const hColor = healthColor(health);
  const initial = manager.owner.slice(0, 2).toUpperCase();

  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: ND, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: ND, speed: 40 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[
          styles.podiumCard,
          large && styles.podiumCardLarge,
          { borderColor: p.ring + '55' },
        ]}>
          <LinearGradient
            colors={[p.dim, 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          />

          <View style={styles.podiumRankBadge}>
            <Text style={[styles.podiumRankText, { color: p.ring }]}>#{rank}</Text>
            <Text style={[{ fontSize: 8, fontWeight: '700', color: p.ring, letterSpacing: 0.5 }]}>{p.label}</Text>
          </View>

          <View style={[
            styles.podiumAvatar,
            large && styles.podiumAvatarLarge,
            { backgroundColor: p.dim, borderColor: p.ring + '44' },
          ]}>
            <Text style={[
              styles.podiumAvatarText,
              large && { fontSize: 22 },
              { color: p.ring },
            ]}>{initial}</Text>
          </View>

          <Text style={[styles.podiumAddr, large && { fontSize: 12 }]} numberOfLines={1}>
            {truncateAddress(manager.owner, 5)}
          </Text>

          <Text style={[styles.podiumTvl, large && { fontSize: 17 }]}>
            {formatUSD(tvl, true)}
          </Text>
          <Text style={styles.podiumTvlLabel}>TVL</Text>

          <View style={styles.podiumStats}>
            <View style={styles.podiumStat}>
              <Text style={[styles.podiumStatVal, { color: hColor }]}>
                {(health * 100).toFixed(0)}%
              </Text>
              <Text style={styles.podiumStatKey}>Health</Text>
            </View>
            <View style={[styles.podiumStatDivider]} />
            <View style={styles.podiumStat}>
              <Text style={styles.podiumStatVal}>{manager.activeVaults}</Text>
              <Text style={styles.podiumStatKey}>Live</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function RankRow({
  manager,
  rank,
  onPress,
  delay,
}: {
  manager: ManagerWithVaults;
  rank: number;
  onPress: () => void;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-16)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: ND }),
      Animated.timing(translateX, { toValue: 0, duration: 300, delay, useNativeDriver: ND }),
    ]).start();
  }, []);

  const tvl = getTvl(manager);
  const health = getAvgHealth(manager);
  const hColor = healthColor(health);
  const initial = manager.owner.slice(0, 2).toUpperCase();

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }, { scale }] }}>
      <Pressable
        style={styles.rankRow}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: ND, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: ND, speed: 40 }).start()}
      >
        <Text style={styles.rankNum}>#{rank}</Text>

        <View style={styles.rankAvatar}>
          <Text style={styles.rankAvatarText}>{initial}</Text>
        </View>

        <View style={styles.rankInfo}>
          <Text style={styles.rankAddr}>{truncateAddress(manager.owner, 7)}</Text>
          <Text style={styles.rankSub}>
            {manager.activeVaults} live · {formatAge(manager.createdAt)} ago
          </Text>
        </View>

        <View style={styles.rankRight}>
          <Text style={styles.rankTvl}>{formatUSD(tvl, true)}</Text>
          <View style={styles.rankHealthRow}>
            <View style={[styles.rankHealthDot, { backgroundColor: hColor }]} />
            <Text style={[styles.rankHealthText, { color: hColor }]}>
              {(health * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, color: colors.textQuiet }}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function TradersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: managers, isLoading, refetch, isRefetching } = useManagers();
  const [sort, setSort] = useState<'tvl' | 'health' | 'vaults'>('tvl');

  const sorted = [...(managers ?? [])].sort((a, b) => {
    if (sort === 'tvl') return getTvl(b) - getTvl(a);
    if (sort === 'health') return getAvgHealth(b) - getAvgHealth(a);
    return b.totalVaults - a.totalVaults;
  });

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
      }
    >
      {/* Header */}
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Leaderboard</Text>
            <Text style={styles.pageSub}>{sorted.length} verified traders</Text>
          </View>
          <View style={styles.seasonBadge}>
            <Text style={styles.seasonText}>S1</Text>
          </View>
        </View>
      </FadeSlideIn>

      {/* Sort tabs */}
      <FadeSlideIn delay={60}>
        <View style={styles.sortRow}>
          {(['tvl', 'health', 'vaults'] as const).map(s => (
            <Pressable
              key={s}
              style={[styles.sortChip, sort === s && styles.sortChipActive]}
              onPress={() => setSort(s)}
            >
              <Text style={[styles.sortChipText, sort === s && styles.sortChipTextActive]}>
                {s === 'tvl' ? 'By TVL' : s === 'health' ? 'By Health' : 'By Vaults'}
              </Text>
            </Pressable>
          ))}
        </View>
      </FadeSlideIn>

      {/* Podium — top 3 */}
      {top3.length >= 3 && (
        <FadeSlideIn delay={100}>
          <View style={styles.podiumSection}>
            <Text style={styles.sectionLabel}>Top Performers</Text>

            {/* 2nd - 1st - 3rd layout */}
            <View style={styles.podiumRow}>
              <View style={styles.podiumCol}>
                <PodiumCard
                  manager={top3[1]}
                  rank={2}
                  onPress={() => router.push(`/trader/${top3[1].pubkey}`)}
                />
                <View style={[styles.pedestal, styles.pedestalSilver]}>
                  <Text style={styles.pedestalNum}>2</Text>
                </View>
              </View>

              <View style={styles.podiumColCenter}>
                <PodiumCard
                  manager={top3[0]}
                  rank={1}
                  large
                  onPress={() => router.push(`/trader/${top3[0].pubkey}`)}
                />
                <View style={[styles.pedestal, styles.pedestalGold]}>
                  <Text style={styles.pedestalNum}>1</Text>
                </View>
              </View>

              <View style={styles.podiumCol}>
                <PodiumCard
                  manager={top3[2]}
                  rank={3}
                  onPress={() => router.push(`/trader/${top3[2].pubkey}`)}
                />
                <View style={[styles.pedestal, styles.pedestalBronze]}>
                  <Text style={styles.pedestalNum}>3</Text>
                </View>
              </View>
            </View>
          </View>
        </FadeSlideIn>
      )}

      {/* Rank list — 4th onward */}
      {rest.length > 0 && (
        <View style={styles.rankSection}>
          <Text style={styles.sectionLabel}>Rankings</Text>
          <View style={styles.rankList}>
            {rest.map((manager, i) => (
              <RankRow
                key={manager.pubkey}
                manager={manager}
                rank={i + 4}
                delay={Math.min(i * 40, 200)}
                onPress={() => router.push(`/trader/${manager.pubkey}`)}
              />
            ))}
          </View>
        </View>
      )}

      {sorted.length === 0 && (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border }} />
          </View>
          <Text style={styles.emptyTitle}>No traders yet</Text>
          <Text style={styles.emptySub}>Rankings will appear once traders register</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  headerLeft: { gap: 3 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  pageSub: { fontSize: 12, color: colors.textQuiet },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.warningDim,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  seasonText: { fontSize: 11, fontWeight: '700', color: colors.warning, letterSpacing: 0.3 },

  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  sortChipActive: { borderColor: colors.signalBorder, backgroundColor: colors.signalDim },
  sortChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sortChipTextActive: { color: colors.signal },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textQuiet,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  podiumSection: { marginBottom: 28 },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumColCenter: { flex: 1.15, alignItems: 'center' },

  podiumCard: {
    width: '100%',
    borderRadius: radius.card,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  podiumCardLarge: { paddingVertical: 16 },
  podiumRankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  podiumRankText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarLarge: { width: 54, height: 54, borderRadius: 17 },
  podiumAvatarText: { fontSize: 17, fontWeight: '700' },
  podiumAddr: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  podiumTvl: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  podiumTvlLabel: { fontSize: 8, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: -4 },
  podiumStats: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 4 },
  podiumStat: { flex: 1, alignItems: 'center', gap: 2 },
  podiumStatDivider: { width: 1, height: 24, backgroundColor: colors.border },
  podiumStatVal: { fontSize: 12, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  podiumStatKey: { fontSize: 7, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.4 },

  pedestal: {
    width: '90%',
    paddingVertical: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  pedestalGold: { backgroundColor: 'rgba(255,215,0,0.15)', height: 36 },
  pedestalSilver: { backgroundColor: 'rgba(192,200,212,0.10)', height: 26 },
  pedestalBronze: { backgroundColor: 'rgba(205,127,50,0.10)', height: 20 },
  pedestalNum: { fontSize: 11, fontWeight: '800', color: colors.textMuted },

  rankSection: { marginBottom: 12 },
  rankList: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textQuiet,
    fontFamily: 'Courier',
    width: 28,
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  rankInfo: { flex: 1, gap: 2 },
  rankAddr: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  rankSub: { fontSize: 10, color: colors.textQuiet },
  rankRight: { alignItems: 'flex-end', gap: 3 },
  rankTvl: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  rankHealthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankHealthDot: { width: 5, height: 5, borderRadius: 3 },
  rankHealthText: { fontSize: 10, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSub },
  emptySub: { fontSize: 13, color: colors.textQuiet, textAlign: 'center' },
});
