import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
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
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeSlideIn } from '../../src/components/AnimatedEntry';
import { formatUSD, truncateAddress, formatAge } from '../../src/lib/format';

const RANK_ICONS = ['★', '◆', '●'];
const RANK_LABELS = ['#1', '#2', '#3'];

function AnimatedTraderCard({ manager, rank, onPress, delay }: {
  manager: ManagerWithVaults;
  rank: number;
  onPress: () => void;
  delay: number;
}) {
  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth = manager.vaults.length > 0
    ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length : 0;
  const hColor = avgHealth >= 0.8 ? colors.signal : avgHealth >= 0.6 ? colors.warning : colors.danger;
  const isTop = rank <= 3;
  const initial = manager.owner.slice(0, 2).toUpperCase();

  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(24)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(entryY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: entryOpacity, transform: [{ translateY: entryY }, { scale: pressScale }] }}>
      <Pressable
        style={[styles.card, isTop && styles.cardTop]}
        onPress={onPress}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.975, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
      >
        {isTop && (
          <LinearGradient
            colors={['rgba(0,200,150,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        )}

        {/* Header: avatar + name + TVL */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarArea}>
            <LinearGradient
              colors={isTop ? [colors.signal + 'CC', colors.signalDeep] : [colors.surfaceHigh, colors.surfaceElevated]}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { color: isTop ? colors.white : colors.textMuted }]}>
                {initial}
              </Text>
            </LinearGradient>
            {isTop && (
              <View style={styles.rankPin}>
                <Text style={styles.rankPinText}>{RANK_ICONS[rank - 1]}</Text>
              </View>
            )}
          </View>

          <View style={styles.cardMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.cardAddr}>{truncateAddress(manager.owner, 8)}</Text>
              {isTop && (
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>{RANK_LABELS[rank - 1]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardSub}>
              {manager.activeVaults} active · joined {formatAge(manager.createdAt)} ago
            </Text>
          </View>

          {/* TVL — value bigger than label */}
          <View style={styles.tvlBlock}>
            <Text style={styles.tvlValue}>{formatUSD(totalTvl, true)}</Text>
            <Text style={styles.tvlLabel}>TVL</Text>
          </View>
        </View>

        {/* Stats bento — values intentionally much bigger than labels */}
        <View style={styles.bento}>
          <View style={styles.bentoCell}>
            <Text style={styles.bentoVal}>{manager.totalVaults}</Text>
            <Text style={styles.bentoKey}>VAULTS</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={[styles.bentoVal, { color: colors.signal }]}>{manager.activeVaults}</Text>
            <Text style={styles.bentoKey}>LIVE</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={styles.bentoVal}>{formatUSD(manager.totalJuniorDeposited, true)}</Text>
            <Text style={styles.bentoKey}>SKIN</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={[styles.bentoVal, { color: hColor }]}>{(avgHealth * 100).toFixed(0)}%</Text>
            <Text style={styles.bentoKey}>HEALTH</Text>
          </View>
        </View>

        {/* Vault chips */}
        {manager.vaults.length > 0 && (
          <View style={styles.chips}>
            {manager.vaults.slice(0, 3).map(v => (
              <View key={v.id} style={styles.chip}>
                <StatusBadge status={v.status} size="sm" />
                <Text style={styles.chipName} numberOfLines={1}>{v.name}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function TradersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: managers, isLoading, refetch, isRefetching } = useManagers();

  const sorted = [...(managers ?? [])].sort((a, b) => {
    const ta = a.vaults.reduce((s, v) => s + v.tvl, 0);
    const tb = b.vaults.reduce((s, v) => s + v.tvl, 0);
    return tb - ta;
  });

  const Header = () => (
    <FadeSlideIn delay={0}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.pageTitle}>Traders</Text>
        <Text style={styles.pageSub}>{sorted.length} verified managers · ranked by TVL</Text>
      </View>
    </FadeSlideIn>
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={sorted}
        keyExtractor={m => m.pubkey}
        ListHeaderComponent={Header}
        renderItem={({ item, index }) => (
          <AnimatedTraderCard
            manager={item}
            rank={index + 1}
            delay={Math.min(index * 70, 280)}
            onPress={() => router.push(`/trader/${item.pubkey}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState icon="◎" title="No traders yet" />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, paddingBottom: 20, gap: 4 },
  pageTitle: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  pageSub: { fontSize: 11, color: colors.textQuiet, fontFamily: 'Courier' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
    overflow: 'hidden',
  },
  cardTop: {
    borderColor: colors.signal + '28',
    shadowColor: colors.signal,
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarArea: { position: 'relative' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', fontFamily: 'Courier' },
  rankPin: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.signal + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPinText: { fontSize: 9 },

  cardMeta: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAddr: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  rankBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '40',
  },
  rankBadgeText: { fontSize: 9, fontWeight: '800', color: colors.signal, fontFamily: 'Courier' },
  cardSub: { fontSize: 11, color: colors.textQuiet, fontFamily: 'Courier' },

  tvlBlock: { alignItems: 'flex-end', gap: 2 },
  tvlValue: { fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  tvlLabel: {
    fontSize: 8, color: colors.textQuiet, textTransform: 'uppercase',
    letterSpacing: 0.6, fontFamily: 'Courier', fontWeight: '700',
  },

  bento: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bentoCell: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  bentoDivider: { width: 1, backgroundColor: colors.border },
  bentoVal: { fontSize: 17, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  bentoKey: {
    fontSize: 7, fontWeight: '700', color: colors.textQuiet,
    textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Courier',
  },

  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceElevated, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
    borderColor: colors.border, maxWidth: 180,
  },
  chipName: { fontSize: 11, color: colors.textMuted },
});
