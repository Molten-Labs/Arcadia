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
import { colors, spacing, radius } from '../../src/lib/theme';
import { useManagers, ManagerWithVaults } from '../../src/hooks/useManagers';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { StatusBadge } from '../../src/components/StatusBadge';
import { formatUSD, truncateAddress, formatAge } from '../../src/lib/format';

function TraderCard({
  manager,
  rank,
  onPress,
}: {
  manager: ManagerWithVaults;
  rank: number;
  onPress: () => void;
}) {
  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth =
    manager.vaults.length > 0
      ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardAddr}>{truncateAddress(manager.owner, 6)}</Text>
          <Text style={styles.cardSince}>Since {formatAge(manager.createdAt)} ago</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardTvl}>{formatUSD(totalTvl, true)}</Text>
          <Text style={styles.cardTvlLabel}>TVL</Text>
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TOTAL VAULTS</Text>
          <Text style={styles.statValue}>{manager.totalVaults}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>ACTIVE</Text>
          <Text style={[styles.statValue, { color: colors.signal }]}>{manager.activeVaults}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>JR. POSTED</Text>
          <Text style={styles.statValue}>{formatUSD(manager.totalJuniorDeposited, true)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>AVG HEALTH</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  avgHealth >= 0.8 ? colors.signal : avgHealth >= 0.6 ? colors.warning : colors.danger,
              },
            ]}
          >
            {(avgHealth * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      {manager.vaults.length > 0 && (
        <View style={styles.vaultRow}>
          {manager.vaults.slice(0, 3).map(v => (
            <View key={v.id} style={styles.vaultChip}>
              <StatusBadge status={v.status} size="sm" />
              <Text style={styles.vaultChipName}>{v.name}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function TradersScreen() {
  const router = useRouter();
  const { data: managers, isLoading, refetch, isRefetching } = useManagers();

  const sorted = [...(managers ?? [])].sort((a, b) => {
    const tvlA = a.vaults.reduce((s, v) => s + v.tvl, 0);
    const tvlB = b.vaults.reduce((s, v) => s + v.tvl, 0);
    return tvlB - tvlA;
  });

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Traders"
        subtitle={`${sorted.length} verified managers`}
        showWallet
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.signal} size="large" />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={m => m.pubkey}
          renderItem={({ item, index }) => (
            <TraderCard
              manager={item}
              rank={index + 1}
              onPress={() => router.push(`/trader/${item.pubkey}`)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState icon="◎" title="No traders yet" subtitle="Managers appear here once they create a vault" />
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  pressed: { opacity: 0.75, borderColor: colors.signal + '44' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankText: { fontSize: 13, fontWeight: '700', color: colors.signal, fontFamily: 'Courier' },
  cardInfo: { flex: 1, gap: 2 },
  cardAddr: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  cardSince: { fontSize: 11, color: colors.textQuiet },
  cardRight: { alignItems: 'flex-end' },
  cardTvl: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  cardTvlLabel: { fontSize: 9, color: colors.textQuiet, letterSpacing: 0.5, textTransform: 'uppercase' },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { gap: 2, alignItems: 'center' },
  statLabel: { fontSize: 9, color: colors.textQuiet, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  statValue: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  vaultRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  vaultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vaultChipName: { fontSize: 11, color: colors.textMuted },
});
