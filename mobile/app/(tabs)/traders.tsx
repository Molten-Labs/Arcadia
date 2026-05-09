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

const RANK_ICONS = ['★', '◆', '●'];

function TraderCard({ manager, rank, onPress }: {
  manager: ManagerWithVaults;
  rank: number;
  onPress: () => void;
}) {
  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth = manager.vaults.length > 0
    ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length : 0;
  const hColor = avgHealth >= 0.8 ? colors.signal : avgHealth >= 0.6 ? colors.warning : colors.danger;
  const isTop = rank <= 3;
  const initial = manager.owner.slice(0, 2).toUpperCase();

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      {isTop && (
        <LinearGradient
          colors={['rgba(0,181,164,0.10)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <View style={styles.cardTop}>
        {/* Avatar */}
        <LinearGradient
          colors={isTop ? [colors.signal + 'CC', colors.signalDeep] : [colors.surfaceHigh, colors.surfaceElevated]}
          style={styles.avatar}
        >
          <Text style={[styles.avatarText, { color: isTop ? colors.white : colors.textMuted }]}>
            {initial}
          </Text>
        </LinearGradient>

        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardAddr}>{truncateAddress(manager.owner, 8)}</Text>
            {isTop && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{RANK_ICONS[rank - 1]}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSub}>
            {manager.activeVaults} active · {formatAge(manager.createdAt)} ago
          </Text>
        </View>

        <View style={styles.tvlBlock}>
          <Text style={styles.tvlValue}>{formatUSD(totalTvl, true)}</Text>
          <Text style={styles.tvlLabel}>TVL</Text>
        </View>
      </View>

      {/* Bento stats */}
      <View style={styles.bento}>
        <View style={styles.bentoCell}>
          <Text style={styles.bentoVal}>{manager.totalVaults}</Text>
          <Text style={styles.bentoKey}>VAULTS</Text>
        </View>
        <View style={styles.bentoDivider} />
        <View style={styles.bentoCell}>
          <Text style={[styles.bentoVal, { color: colors.signal }]}>{manager.activeVaults}</Text>
          <Text style={styles.bentoKey}>ACTIVE</Text>
        </View>
        <View style={styles.bentoDivider} />
        <View style={styles.bentoCell}>
          <Text style={styles.bentoVal}>{formatUSD(manager.totalJuniorDeposited, true)}</Text>
          <Text style={styles.bentoKey}>JR. POSTED</Text>
        </View>
        <View style={styles.bentoDivider} />
        <View style={styles.bentoCell}>
          <Text style={[styles.bentoVal, { color: hColor }]}>{(avgHealth * 100).toFixed(0)}%</Text>
          <Text style={styles.bentoKey}>AVG HEALTH</Text>
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
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.pageTitle}>Traders</Text>
      <Text style={styles.pageSub}>{sorted.length} verified managers · ranked by TVL</Text>
    </View>
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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingBottom: 16, gap: 4 },
  pageTitle: { fontSize: 28, fontWeight: '600', color: colors.text, letterSpacing: -0.6 },
  pageSub: { fontSize: 11, color: colors.textQuiet, fontFamily: 'Courier' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 14,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.76, borderColor: colors.signal + '40' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', fontFamily: 'Courier' },
  cardInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAddr: { fontSize: 14, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '40',
  },
  rankText: { fontSize: 10, fontWeight: '700', color: colors.signal },
  cardSub: { fontSize: 11, color: colors.textQuiet, fontFamily: 'Courier' },
  tvlBlock: { alignItems: 'flex-end' },
  tvlValue: { fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  tvlLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Courier' },

  bento: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  bentoCell: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  bentoDivider: { width: 1, backgroundColor: colors.border },
  bentoVal: { fontSize: 12, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  bentoKey: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Courier',
  },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 180,
  },
  chipName: { fontSize: 11, color: colors.textMuted },
});
