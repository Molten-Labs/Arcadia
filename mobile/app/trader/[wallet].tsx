import React, { useLayoutEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useManager } from '../../src/hooks/useManagers';
import { VaultCard } from '../../src/components/VaultCard';
import { StatCard } from '../../src/components/StatCard';
import { EmptyState } from '../../src/components/EmptyState';
import { formatUSD, truncateAddress, formatAge, formatNav } from '../../src/lib/format';
import { VaultView, mockNavHistory } from '../../src/lib/mockData';

export default function TraderProfileScreen() {
  const { wallet } = useLocalSearchParams<{ wallet: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { data: manager, isLoading } = useManager(wallet);

  useLayoutEffect(() => {
    if (manager) navigation.setOptions({ headerTitle: truncateAddress(manager.owner, 10) });
  }, [manager, navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }
  if (!manager) return <EmptyState icon="◎" title="Trader not found" />;

  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth = manager.vaults.length > 0
    ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length : 0;
  const avgNav = manager.vaults.length > 0
    ? manager.vaults.reduce((s, v) => s + v.currentNav, 0) / manager.vaults.length : 1;
  const hColor = avgHealth >= 0.8 ? colors.signal : avgHealth >= 0.6 ? colors.warning : colors.danger;

  const tier = totalTvl > 100_000 ? '★ Proven' : totalTvl > 50_000 ? '◆ Active' : '● New';
  const initial = manager.owner.slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Profile hero */}
      <LinearGradient colors={[colors.signalDeep + '28', colors.bg]} style={styles.hero}>
        <View style={styles.profileRow}>
          <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.avatarGrad}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={styles.profileAddr}>{truncateAddress(manager.owner, 10)}</Text>
            <Text style={styles.profileSince}>Active {formatAge(manager.createdAt)} ago</Text>
          </View>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard label="Total TVL" value={formatUSD(totalTvl, true)} flex={1} />
        <StatCard label="Avg NAV" value={formatNav(avgNav)} flex={1} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="Avg Jr. Health" value={`${(avgHealth * 100).toFixed(0)}%`} valueColor={hColor} flex={1} />
        <StatCard label="Jr. Posted" value={formatUSD(manager.totalJuniorDeposited, true)} flex={1} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="Total Vaults" value={String(manager.totalVaults)} flex={1} />
        <StatCard label="Active" value={String(manager.activeVaults)} valueColor={colors.signal} flex={1} />
      </View>

      {/* Profile details */}
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>PROFILE</Text>
        {([
          ['Owner', truncateAddress(manager.owner, 10)],
          ['Manager PDA', truncateAddress(manager.pubkey, 10)],
          ['Member Since', formatAge(manager.createdAt) + ' ago'],
        ] as [string, string][]).map(([k, v]) => (
          <View key={k} style={styles.detailRow}>
            <Text style={styles.detailKey}>{k}</Text>
            <Text style={styles.detailVal}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Vaults */}
      <Text style={styles.sectionTitle}>Vaults ({manager.vaults.length})</Text>

      {manager.vaults.length === 0 ? (
        <EmptyState icon="⬡" title="No vaults yet" subtitle="This manager hasn't created any vaults" />
      ) : (
        manager.vaults.map((vault: VaultView) => (
          <VaultCard
            key={vault.id}
            vault={vault}
            onPress={() => router.push(`/vault/${vault.configPubkey}`)}
            sparkData={mockNavHistory(vault.configPubkey).map(p => p.nav)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { gap: spacing.sm, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hero: { padding: spacing.md, paddingTop: 8, paddingBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarGrad: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.bg, fontFamily: 'Courier' },
  profileInfo: { flex: 1, gap: 3 },
  profileAddr: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  profileSince: { fontSize: 12, color: colors.textQuiet },
  tierBadge: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: colors.signalDim, borderWidth: 1, borderColor: colors.signal + '55',
  },
  tierText: { fontSize: 12, fontWeight: '700', color: colors.signal },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md },
  detailCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  detailTitle: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailKey: { fontSize: 13, color: colors.textMuted },
  detailVal: { fontSize: 12, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: spacing.md, marginTop: 4 },
});
