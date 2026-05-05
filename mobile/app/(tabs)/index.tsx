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
  const avgNav = vaults?.length
    ? (vaults.reduce((s, v) => s + v.currentNav, 0) / vaults.length).toFixed(4)
    : '—';

  function handleVaultPress(vault: VaultView) {
    router.push(`/vault/${vault.configPubkey}`);
  }

  const Header = () => (
    <>
      {/* Nav bar */}
      <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.wordmark}>ARCADIA</Text>
          <Text style={styles.tagline}>First-loss managed vaults</Text>
        </View>
        <WalletButton />
      </View>

      {/* Balance hero card */}
      <View style={styles.heroCard}>
        <LinearGradient
          colors={['rgba(163,230,53,0.10)', 'rgba(163,230,53,0.02)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <Text style={styles.heroLabel}>Total Protocol TVL</Text>
        <Text style={styles.heroBalance}>{formatUSD(totalTvl)}</Text>

        {/* Mini bento metrics */}
        <View style={styles.heroBento}>
          <View style={styles.heroBentoCell}>
            <Text style={styles.heroBentoValue}>{activeCount}</Text>
            <Text style={styles.heroBentoLabel}>Active Vaults</Text>
          </View>
          <View style={styles.heroBentoDivider} />
          <View style={styles.heroBentoCell}>
            <Text style={styles.heroBentoValue}>{(vaults ?? []).length}</Text>
            <Text style={styles.heroBentoLabel}>Total Vaults</Text>
          </View>
          <View style={styles.heroBentoDivider} />
          <View style={styles.heroBentoCell}>
            <Text style={[styles.heroBentoValue, { color: colors.signal }]}>{avgNav}</Text>
            <Text style={styles.heroBentoLabel}>Avg NAV</Text>
          </View>
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
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

      <Text style={styles.sectionHeader}>
        {filtered.length} vault{filtered.length !== 1 ? 's' : ''}
      </Text>
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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState icon="⬡" title="No vaults" subtitle="Try a different filter" />
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
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },

  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: 16,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 4,
    fontFamily: 'Courier',
  },
  tagline: {
    fontSize: 10,
    color: colors.textQuiet,
    marginTop: 2,
    fontFamily: 'Courier',
  },

  heroCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  heroBalance: {
    fontSize: 40,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -1.5,
    fontFamily: 'Courier',
  },
  heroBento: {
    flexDirection: 'row',
    marginTop: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  heroBentoCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  heroBentoDivider: { width: 1, backgroundColor: colors.border },
  heroBentoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Courier',
  },
  heroBentoLabel: {
    fontSize: 9,
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'Courier',
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    paddingTop: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.signal + '60',
    backgroundColor: colors.signalDim,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  chipTextActive: { color: colors.signal },

  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
    paddingHorizontal: spacing.md,
    marginBottom: 6,
  },
});
