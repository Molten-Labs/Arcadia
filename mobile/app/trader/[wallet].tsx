import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useNavigation,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useLayoutEffect } from 'react';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useManager } from '../../src/hooks/useManagers';
import { VaultCard } from '../../src/components/VaultCard';
import { StatCard } from '../../src/components/StatCard';
import { EmptyState } from '../../src/components/EmptyState';
import { formatUSD, truncateAddress, formatAge } from '../../src/lib/format';
import { VaultView } from '../../src/lib/mockData';

export default function TraderProfileScreen() {
  const { wallet } = useLocalSearchParams<{ wallet: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { data: manager, isLoading } = useManager(wallet);

  useLayoutEffect(() => {
    if (manager) {
      navigation.setOptions({ title: truncateAddress(manager.owner, 8) });
    }
  }, [manager, navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }

  if (!manager) {
    return <EmptyState icon="◎" title="Trader not found" />;
  }

  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth =
    manager.vaults.length > 0
      ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length
      : 0;
  const avgNav =
    manager.vaults.length > 0
      ? manager.vaults.reduce((s, v) => s + v.currentNav, 0) / manager.vaults.length
      : 1;

  const healthColor =
    avgHealth >= 0.8 ? colors.signal : avgHealth >= 0.6 ? colors.warning : colors.danger;

  function handleVaultPress(vault: VaultView) {
    router.push(`/vault/${vault.configPubkey}`);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {manager.owner.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileAddr}>{truncateAddress(manager.owner, 8)}</Text>
          <Text style={styles.profileSince}>Manager since {formatAge(manager.createdAt)} ago</Text>
        </View>
        <View style={styles.profileBadge}>
          <Text style={styles.profileBadgeText}>
            {totalTvl > 100_000 ? '★ Proven' : totalTvl > 50_000 ? '◆ Active' : '● New'}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Total TVL" value={formatUSD(totalTvl, true)} flex={1} />
        <StatCard label="Avg NAV" value={avgNav.toFixed(4)} flex={1} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          label="Avg Jr. Health"
          value={`${(avgHealth * 100).toFixed(0)}%`}
          valueColor={healthColor}
          flex={1}
        />
        <StatCard label="Jr. Posted" value={formatUSD(manager.totalJuniorDeposited, true)} flex={1} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="Total Vaults" value={String(manager.totalVaults)} flex={1} />
        <StatCard label="Active Vaults" value={String(manager.activeVaults)} valueColor={colors.signal} flex={1} />
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>PROFILE</Text>
        {[
          ['Manager Pubkey', truncateAddress(manager.pubkey, 8)],
          ['Owner Wallet', truncateAddress(manager.owner, 8)],
          ['Member Since', formatAge(manager.createdAt) + ' ago'],
        ].map(([k, v]) => (
          <View key={k} style={styles.detailRow}>
            <Text style={styles.detailKey}>{k}</Text>
            <Text style={styles.detailVal}>{v}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Vaults ({manager.vaults.length})</Text>

      {manager.vaults.length === 0 ? (
        <EmptyState icon="⬡" title="No vaults yet" subtitle="This manager hasn't created any vaults" />
      ) : (
        manager.vaults.map(vault => (
          <VaultCard
            key={vault.id}
            vault={vault}
            onPress={() => handleVaultPress(vault)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.signal + '66',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.signalDeep,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.signal,
    fontFamily: 'Courier',
  },
  profileInfo: { flex: 1, gap: 3 },
  profileAddr: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  profileSince: { fontSize: 11, color: colors.textQuiet },
  profileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '44',
  },
  profileBadgeText: { fontSize: 11, fontWeight: '700', color: colors.signal },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  detailTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailKey: { fontSize: 13, color: colors.textMuted },
  detailVal: { fontSize: 12, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
});
