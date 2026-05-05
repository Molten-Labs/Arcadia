import React from 'react';
import {
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
import { formatUSD, truncateAddress, formatAge } from '../../src/lib/format';

function healthColor(h: number) {
  if (h >= 0.8) return colors.signal;
  if (h >= 0.6) return colors.warning;
  return colors.danger;
}

function TraderCard({ manager, rank, onPress }: { manager: ManagerWithVaults; rank: number; onPress: () => void }) {
  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth = manager.vaults.length > 0
    ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length : 0;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      {rank === 1 && (
        <LinearGradient
          colors={['rgba(0,181,164,0.10)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <View style={styles.cardTop}>
        <View style={[styles.rankBadge, rank <= 3 && styles.rankBadgeTop]}>
          <Text style={[styles.rankText, rank <= 3 && { color: colors.signal }]}>
            {rank === 1 ? '★' : rank === 2 ? '◆' : rank === 3 ? '●' : `#${rank}`}
          </Text>
        </View>

        <View style={styles.cardMid}>
          <Text style={styles.cardAddr}>{truncateAddress(manager.owner, 6)}</Text>
          <Text style={styles.cardSince}>Manager · {formatAge(manager.createdAt)} ago</Text>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.cardTvl}>{formatUSD(totalTvl, true)}</Text>
          <Text style={styles.cardTvlLabel}>TVL</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>VAULTS</Text>
          <Text style={styles.statVal}>{manager.totalVaults}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>ACTIVE</Text>
          <Text style={[styles.statVal, { color: colors.signal }]}>{manager.activeVaults}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>JR. POSTED</Text>
          <Text style={styles.statVal}>{formatUSD(manager.totalJuniorDeposited, true)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>AVG HEALTH</Text>
          <Text style={[styles.statVal, { color: healthColor(avgHealth) }]}>
            {(avgHealth * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      {manager.vaults.length > 0 && (
        <View style={styles.vaultChips}>
          {manager.vaults.slice(0, 3).map(v => (
            <View key={v.id} style={styles.vaultChip}>
              <StatusBadge status={v.status} size="sm" />
              <Text style={styles.vaultChipName} numberOfLines={1}>{v.name}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function TradersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: managers, isLoading, refetch, isRefetching } = useManagers();

  const sorted = [...(managers ?? [])].sort((a, b) => {
    const tvlA = a.vaults.reduce((s, v) => s + v.tvl, 0);
    const tvlB = b.vaults.reduce((s, v) => s + v.tvl, 0);
    return tvlB - tvlA;
  });

  const Header = () => (
    <LinearGradient
      colors={[colors.signalDeep + '22', colors.bg]}
      style={[styles.hero, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.heroTitle}>Traders</Text>
      <Text style={styles.heroSub}>
        {sorted.length} verified managers · Ranked by TVL
      </Text>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
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
          <TraderCard
            manager={item}
            rank={index + 1}
            onPress={() => router.push(`/trader/${item.pubkey}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<EmptyState icon="◎" title="No traders yet" />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hero: { paddingHorizontal: spacing.md, paddingBottom: 20, gap: 6 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: colors.textQuiet },
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.78, borderColor: colors.signal + '55' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: { borderColor: colors.signal + '55', backgroundColor: colors.signalDim },
  rankText: { fontSize: 16, fontWeight: '800', color: colors.textMuted, fontFamily: 'Courier' },
  cardMid: { flex: 1, gap: 2 },
  cardAddr: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  cardSince: { fontSize: 11, color: colors.textQuiet },
  cardRight: { alignItems: 'flex-end' },
  cardTvl: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  cardTvlLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statLabel: { fontSize: 8, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  statVal: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  vaultChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  vaultChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceElevated, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border, maxWidth: 160 },
  vaultChipName: { fontSize: 11, color: colors.textMuted },
});
