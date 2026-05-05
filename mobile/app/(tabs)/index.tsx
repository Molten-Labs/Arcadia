import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../../src/lib/theme';
import { VaultView } from '../../src/lib/mockData';
import { useVaults } from '../../src/hooks/useVaults';
import { VaultCard } from '../../src/components/VaultCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { formatUSD } from '../../src/lib/format';

type Filter = 'all' | 'active' | 'paper' | 'cooldown';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paper', label: 'Paper' },
  { key: 'cooldown', label: 'Cooldown' },
];

export default function VaultsScreen() {
  const router = useRouter();
  const { data: vaults, isLoading, refetch, isRefetching } = useVaults();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = (vaults ?? []).filter(v =>
    filter === 'all' ? true : v.status === filter
  );

  const totalTvl = (vaults ?? []).reduce((s, v) => s + v.tvl, 0);
  const activeCount = (vaults ?? []).filter(v => v.status === 'active').length;

  function handleVaultPress(vault: VaultView) {
    router.push(`/vault/${vault.configPubkey}`);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Arcadia"
        subtitle="Proof-gated capital protocol"
        showWallet
      />

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL TVL</Text>
          <Text style={styles.summaryValue}>{formatUSD(totalTvl, true)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>ACTIVE VAULTS</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL VAULTS</Text>
          <Text style={styles.summaryValue}>{(vaults ?? []).length}</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.signal} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={v => v.id}
          renderItem={({ item }) => (
            <VaultCard vault={item} onPress={() => handleVaultPress(item)} />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              icon="⬡"
              title="No vaults found"
              subtitle="Try a different filter or check back later"
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.signal}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textQuiet,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterActive: {
    borderColor: colors.signal,
    backgroundColor: colors.signalDim,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterLabelActive: {
    color: colors.signal,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 32,
  },
});
