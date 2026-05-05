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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/lib/theme';
import { VaultView, mockNavHistory } from '../../src/lib/mockData';
import { useVaults } from '../../src/hooks/useVaults';
import { VaultCard } from '../../src/components/VaultCard';
import { WalletButton } from '../../src/components/WalletButton';
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
  const insets = useSafeAreaInsets();
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

  const Header = () => (
    <>
      <LinearGradient
        colors={[colors.signalDeep + '22', colors.bg, colors.bg]}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.wordmark}>ARCADIA</Text>
            <Text style={styles.tagline}>Proof-gated capital protocol</Text>
          </View>
          <WalletButton />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatUSD(totalTvl, true)}</Text>
            <Text style={styles.metricLabel}>Total TVL</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.signal }]}>{activeCount}</Text>
            <Text style={styles.metricLabel}>Active</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{(vaults ?? []).length}</Text>
            <Text style={styles.metricLabel}>Vaults</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {(vaults ?? []).length > 0
                ? ((vaults ?? []).reduce((s, v) => s + v.currentNav, 0) / (vaults ?? []).length).toFixed(4)
                : '–'}
            </Text>
            <Text style={styles.metricLabel}>Avg NAV</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
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
        data={filtered}
        keyExtractor={v => v.id}
        renderItem={({ item }) => (
          <VaultCard
            vault={item}
            onPress={() => handleVaultPress(item)}
            sparkData={mockNavHistory(item.configPubkey).map(p => p.nav)}
          />
        )}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState icon="⬡" title="No vaults found" subtitle="Try a different filter" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: 20,
    gap: 20,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 4,
    fontFamily: 'Courier',
  },
  tagline: {
    fontSize: 11,
    color: colors.textQuiet,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  metricLabel: {
    fontSize: 9,
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  metricDivider: { width: 1, backgroundColor: colors.border },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    paddingTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.signal,
    backgroundColor: colors.signalDim,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.signal },
  list: { paddingHorizontal: spacing.md, paddingBottom: 40 },
});
