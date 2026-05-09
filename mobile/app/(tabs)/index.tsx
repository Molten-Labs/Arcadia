import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
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
import { MarketTicker } from '../../src/components/MarketTicker';
import { FadeSlideIn } from '../../src/components/AnimatedEntry';
import { formatUSD } from '../../src/lib/format';

type Filter = 'all' | 'active' | 'paper' | 'cooldown';
type Sort = 'tvl' | 'apy' | 'health';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Live' },
  { key: 'paper', label: 'Paper' },
  { key: 'cooldown', label: 'Cooldown' },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: 'tvl', label: 'TVL' },
  { key: 'apy', label: 'APY' },
  { key: 'health', label: 'Health' },
];

const now = Math.floor(Date.now() / 1000);

function calcAPYNum(vault: VaultView): number {
  const days = vault.graduatedAt > 0
    ? Math.max(1, (now - vault.graduatedAt) / 86400)
    : null;
  if (!days || vault.status === 'paper') return 0;
  return (Math.pow(vault.currentNav, 365 / days) - 1) * 100;
}

function AnimatedTVL({ value }: { value: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('$0');

  useEffect(() => {
    animVal.addListener(({ value: v }) => setDisplay(formatUSD(v)));
    Animated.timing(animVal, {
      toValue: value,
      duration: 1400,
      delay: 300,
      useNativeDriver: false,
    }).start();
    return () => animVal.removeAllListeners();
  }, [value]);

  return <Text style={styles.heroBalance}>{display}</Text>;
}

export default function VaultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: vaults, isLoading, refetch, isRefetching } = useVaults();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('tvl');

  const filtered = (vaults ?? []).filter(v =>
    filter === 'all' ? true : v.status === filter
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'tvl') return b.tvl - a.tvl;
    if (sort === 'apy') return calcAPYNum(b) - calcAPYNum(a);
    if (sort === 'health') return b.juniorHealth - a.juniorHealth;
    return 0;
  });

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
      {/* Navbar */}
      <FadeSlideIn delay={0}>
        <View style={[styles.navbar, { paddingTop: insets.top + 10 }]}>
          <View>
            <Text style={styles.wordmark}>Arcadia</Text>
            <Text style={styles.tagline}>Proof-gated vaults · Solana</Text>
          </View>
          <WalletButton />
        </View>
      </FadeSlideIn>

      {/* Market ticker */}
      <FadeSlideIn delay={60}>
        <View style={styles.tickerWrap}>
          <MarketTicker />
        </View>
      </FadeSlideIn>

      {/* Hero TVL card */}
      <FadeSlideIn delay={130}>
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(0,217,140,0.10)', 'rgba(0,217,140,0.02)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <Text style={styles.heroLabel}>Protocol TVL</Text>
          <AnimatedTVL value={totalTvl} />

          <View style={styles.heroStats}>
            <View style={styles.heroStatCell}>
              <Text style={[styles.heroStatValue, { color: colors.signal }]}>{activeCount}</Text>
              <Text style={styles.heroStatLabel}>Live Vaults</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatCell}>
              <Text style={styles.heroStatValue}>{(vaults ?? []).length}</Text>
              <Text style={styles.heroStatLabel}>Total Vaults</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatCell}>
              <Text style={[styles.heroStatValue, { color: colors.signal }]}>{avgNav}</Text>
              <Text style={styles.heroStatLabel}>Avg NAV</Text>
            </View>
          </View>
        </View>
      </FadeSlideIn>

      {/* Filters */}
      <FadeSlideIn delay={200}>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </FadeSlideIn>

      {/* Sort + count */}
      <FadeSlideIn delay={250}>
        <View style={styles.sortRow}>
          <Text style={styles.countLabel}>
            {sorted.length} vault{sorted.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.sortGroup}>
            <Text style={styles.sortLabel}>Sort</Text>
            {SORTS.map(s => (
              <Pressable
                key={s.key}
                style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
                onPress={() => setSort(s.key)}
              >
                <Text style={[styles.sortChipText, sort === s.key && styles.sortChipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </FadeSlideIn>
    </>
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.loadingIcon}>
          <Text style={styles.loadingEmoji}>📦</Text>
        </View>
        <Text style={styles.loadingText}>Loading vaults...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={sorted}
        keyExtractor={v => v.id}
        renderItem={({ item, index }) => (
          <VaultCard
            vault={item}
            onPress={() => handleVaultPress(item)}
            sparkData={mockNavHistory(item.configPubkey).map(p => p.nav)}
            entryDelay={Math.min(index * 50, 260)}
          />
        )}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState
            iconName="layers-outline"
            title="No vaults found"
            subtitle="Try a different filter"
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },

  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingEmoji: {
    fontSize: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },

  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 11,
    color: colors.textQuiet,
    marginTop: 2,
    letterSpacing: 0.1,
  },

  tickerWrap: {
    marginHorizontal: spacing.md,
    marginBottom: 12,
  },

  heroCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    padding: spacing.lg,
    gap: 6,
    overflow: 'hidden',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: colors.signal,
        shadowOpacity: 0.10,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroBalance: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1.5,
    fontFamily: 'Courier',
    lineHeight: 50,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  heroStatCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  heroStatDivider: { width: 1, backgroundColor: colors.border },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  heroStatLabel: {
    fontSize: 9,
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipActive: {
    borderColor: colors.signalBorder,
    backgroundColor: colors.signalDim,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: { color: colors.signal },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textQuiet,
  },
  sortGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortLabel: {
    fontSize: 11,
    color: colors.textQuiet,
    fontWeight: '500',
    marginRight: 2,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  sortChipActive: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signalBorder,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textQuiet,
  },
  sortChipTextActive: { color: colors.signal },
});
