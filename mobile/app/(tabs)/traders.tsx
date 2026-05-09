import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useManagers, ManagerWithVaults } from '../../src/hooks/useManagers';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeSlideIn } from '../../src/components/AnimatedEntry';
import { formatUSD, truncateAddress, formatAge } from '../../src/lib/format';

const ND = Platform.OS !== 'web';

const RANK_COLORS = [colors.warning, colors.textMuted, '#CD7F32'];
const RANK_ICONS: React.ComponentProps<typeof Ionicons>['name'][] = ['trophy', 'medal', 'ribbon'];

function TraderCard({ manager, rank, onPress, delay }: {
  manager: ManagerWithVaults;
  rank: number;
  onPress: () => void;
  delay: number;
}) {
  const totalTvl = manager.vaults.reduce((s, v) => s + v.tvl, 0);
  const avgHealth = manager.vaults.length > 0
    ? manager.vaults.reduce((s, v) => s + v.juniorHealth, 0) / manager.vaults.length : 0;
  const hColor = avgHealth >= 0.8 ? colors.signal : avgHealth >= 0.6 ? colors.warning : colors.danger;
  const isTop = rank <= 3;
  const initial = manager.owner.slice(0, 2).toUpperCase();

  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(20)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 360, delay, useNativeDriver: ND }),
      Animated.timing(entryY, { toValue: 0, duration: 360, delay, useNativeDriver: ND }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: entryOpacity, transform: [{ translateY: entryY }, { scale: pressScale }] }}>
      <Pressable
        style={[styles.card, isTop && styles.cardTop]}
        onPress={onPress}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.975, useNativeDriver: ND, speed: 50 }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, useNativeDriver: ND, speed: 40 }).start()}
      >
        {isTop && (
          <LinearGradient
            colors={['rgba(0,217,140,0.06)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        )}

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <View style={[
              styles.avatar,
              isTop && { backgroundColor: colors.signalDim, borderColor: colors.signalBorder },
            ]}>
              <Text style={[styles.avatarText, isTop && { color: colors.signal }]}>
                {initial}
              </Text>
            </View>
            {rank <= 3 && (
              <View style={[styles.rankPin, { backgroundColor: colors.bg }]}>
                <Ionicons
                  name={RANK_ICONS[rank - 1]}
                  size={9}
                  color={RANK_COLORS[rank - 1]}
                />
              </View>
            )}
          </View>

          <View style={styles.cardMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.cardAddr}>{truncateAddress(manager.owner, 8)}</Text>
              {rank <= 3 && (
                <View style={[styles.rankBadge, { borderColor: RANK_COLORS[rank - 1] + '40' }]}>
                  <Text style={[styles.rankBadgeText, { color: RANK_COLORS[rank - 1] }]}>
                    #{rank}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.cardSub}>
              {manager.activeVaults} live · joined {formatAge(manager.createdAt)} ago
            </Text>
          </View>

          <View style={styles.tvlBlock}>
            <Text style={styles.tvlValue}>{formatUSD(totalTvl, true)}</Text>
            <Text style={styles.tvlLabel}>TVL</Text>
          </View>
        </View>

        {/* Stats bento */}
        <View style={styles.bento}>
          <View style={styles.bentoCell}>
            <Text style={styles.bentoVal}>{manager.totalVaults}</Text>
            <Text style={styles.bentoKey}>Vaults</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={[styles.bentoVal, { color: colors.signal }]}>{manager.activeVaults}</Text>
            <Text style={styles.bentoKey}>Live</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={styles.bentoVal}>{formatUSD(manager.totalJuniorDeposited, true)}</Text>
            <Text style={styles.bentoKey}>Skin</Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <Text style={[styles.bentoVal, { color: hColor }]}>{(avgHealth * 100).toFixed(0)}%</Text>
            <Text style={styles.bentoKey}>Health</Text>
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
    </Animated.View>
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
    <FadeSlideIn delay={0}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.pageTitle}>Traders</Text>
        <Text style={styles.pageSub}>{sorted.length} verified managers · ranked by TVL</Text>
      </View>
    </FadeSlideIn>
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
        data={sorted}
        keyExtractor={m => m.pubkey}
        ListHeaderComponent={Header}
        renderItem={({ item, index }) => (
          <TraderCard
            manager={item}
            rank={index + 1}
            delay={Math.min(index * 60, 240)}
            onPress={() => router.push(`/trader/${item.pubkey}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState iconName="people-outline" title="No traders yet" />
        }
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, paddingBottom: 18, gap: 4 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  pageSub: { fontSize: 12, color: colors.textQuiet, fontWeight: '400' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 48 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
    overflow: 'hidden',
  },
  cardTop: {
    borderColor: colors.signalBorder,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  rankPin: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardMeta: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAddr: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  rankBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,184,48,0.08)',
    borderWidth: 1,
  },
  rankBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  cardSub: { fontSize: 11, color: colors.textQuiet },

  tvlBlock: { alignItems: 'flex-end', gap: 2 },
  tvlValue: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  tvlLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '500' },

  bento: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bentoCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  bentoDivider: { width: 1, backgroundColor: colors.border },
  bentoVal: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  bentoKey: { fontSize: 9, fontWeight: '500', color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.4 },

  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 180,
  },
  chipName: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
});
