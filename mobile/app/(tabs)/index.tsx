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
  { key: 'active', label: 'Active' },
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
    animVal.addListener(({ value: v }) => {
      setDisplay(formatUSD(v));
    });
    Animated.timing(animVal, {
      toValue: value,
      duration: 1200,
      delay: 200,
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

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

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
      <FadeSlideIn delay={0}>
        <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
          <View>
            <Text style={styles.wordmark}>ARCADIA</Text>
            <Text style={styles.tagline}>first-loss managed vaults · solana</Text>
          </View>
          <WalletButton />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={80}>
        <View style={[styles.tickerWrap]}>
          <MarketTicker />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={160}>
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(0,200,150,0.12)', 'rgba(0,200,150,0.04)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <Text style={styles.heroLabel}>Total Protocol TVL</Text>
          <AnimatedTVL value={totalTvl} />

          <View style={styles.heroBento}>
            <View style={styles.heroBentoCell}>
              <Text style={[styles.heroBentoValue, { color: colors.signal }]}>{activeCount}</Text>
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
      </FadeSlideIn>

      <FadeSlideIn delay={240}>
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
      </FadeSlideIn>

      <FadeSlideIn delay={300}>
        <View style={styles.sortRow}>
          <Text style={styles.sectionHeader}>
            {sorted.length} vault{sorted.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.sortChips}>
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
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.loadingGlyph}>⬡</Text>
        <Text style={styles.loadingText}>Syncing vaults...</Text>
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
            entryDelay={Math.min(index * 60, 300)}
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
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },
  loadingGlyph: { fontSize: 36, color: colors.signal },
  loadingText: { fontSize: 12, color: colors.textMuted, fontFamily: 'Courier' },

  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 4,
    fontFamily: 'Courier',
  },
  tagline: {
    fontSize: 9,
    color: colors.textQuiet,
    marginTop: 3,
    fontFamily: 'Courier',
    letterSpacing: 0.3,
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
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 10,
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
    paddingBottom: 10,
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

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  sortChips: { flexDirection: 'row', gap: 4 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signal + '50',
  },
  sortChipText: { fontSize: 9, fontWeight: '700', color: colors.textQuiet, fontFamily: 'Courier' },
  sortChipTextActive: { color: colors.signal },
});
