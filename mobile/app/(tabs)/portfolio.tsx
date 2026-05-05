import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useWallet } from '../../src/lib/wallet';
import { usePositions } from '../../src/hooks/usePositions';
import { useBalance } from '../../src/hooks/useBalance';
import { StatusBadge } from '../../src/components/StatusBadge';
import { HealthMeter } from '../../src/components/HealthMeter';
import { EmptyState } from '../../src/components/EmptyState';
import { WalletButton } from '../../src/components/WalletButton';
import { formatUSD, formatPnL, pnlColor, formatAge } from '../../src/lib/format';

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connected, connect, isDemoWallet } = useWallet();
  const { publicKey } = useWallet();
  const { data: positions, isLoading, refetch, isRefetching } = usePositions(publicKey);
  const { data: balance } = useBalance();

  const totalDeposited = (positions ?? []).reduce((s, p) => s + p.totalDeposited, 0);
  const totalCurrent = (positions ?? []).reduce((s, p) => s + p.currentValue, 0);
  const totalPnL = totalCurrent - totalDeposited;
  const pnlC = pnlColor(totalDeposited, totalCurrent, colors);
  const pnlPct = totalDeposited > 0 ? ((totalPnL / totalDeposited) * 100).toFixed(2) : '0.00';

  if (!connected) {
    return (
      <View style={[styles.screen]}>
        <LinearGradient
          colors={[colors.signalDeep + '22', colors.bg]}
          style={[styles.disconnectedHero, { paddingTop: insets.top + 20 }]}
        >
          <Text style={styles.disconnectedTitle}>ARCADIA</Text>
          <Text style={styles.disconnectedSub}>Your investment portfolio</Text>
        </LinearGradient>
        <EmptyState
          icon="◈"
          title="Connect your wallet"
          subtitle="Connect to view positions, P&L, and manage your senior capital"
        />
        <View style={[styles.connectWrap, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable style={styles.connectBtn} onPress={connect}>
            <LinearGradient
              colors={[colors.signal, colors.signalDeep]}
              style={styles.connectBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.connectBtnText}>Connect Wallet</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.signalDeep + '22', colors.bg]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Portfolio</Text>
            <WalletButton />
          </View>

          {isDemoWallet && (
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerText}>
                ◈ Demo wallet — balances are simulated
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Wallet balances */}
        {balance && (
          <View style={styles.balanceCard}>
            <Text style={styles.sectionLabel}>Wallet Balances</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>SOL</Text>
                <Text style={styles.balanceValue}>{balance.sol.toFixed(4)}</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>USDC</Text>
                <Text style={styles.balanceValue}>{formatUSD(balance.usdc)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Summary card */}
        {(positions ?? []).length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Position Value</Text>
            <Text style={styles.summaryBig}>{formatUSD(totalCurrent)}</Text>
            <View style={styles.summaryStats}>
              <View>
                <Text style={styles.statLabel}>DEPOSITED</Text>
                <Text style={styles.statMono}>{formatUSD(totalDeposited, true)}</Text>
              </View>
              <View style={styles.summaryCenter}>
                <Text style={styles.statLabel}>TOTAL P&L</Text>
                <Text style={[styles.statMono, { color: pnlC }]}>
                  {formatPnL(totalDeposited, totalCurrent)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.statLabel}>RETURN</Text>
                <Text style={[styles.statMono, { color: pnlC }]}>
                  {totalPnL >= 0 ? '+' : ''}{pnlPct}%
                </Text>
              </View>
            </View>
            {totalDeposited > 0 && (
              <View style={styles.pnlBar}>
                <View style={[styles.pnlFill, {
                  width: `${Math.min(100, Math.max(0, ((totalCurrent / totalDeposited)) * 50))}%`,
                  backgroundColor: totalPnL >= 0 ? colors.signal : colors.danger,
                }]} />
              </View>
            )}
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={colors.signal} style={{ marginTop: 40 }} />
        ) : (positions ?? []).length === 0 ? (
          <EmptyState
            icon="◈"
            title="No positions yet"
            subtitle="Deposit into a graduated vault to start earning"
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Open Positions</Text>
            {(positions ?? []).map(pos => {
              const pc = pnlColor(pos.totalDeposited, pos.currentValue, colors);
              const ret = pos.totalDeposited > 0
                ? (((pos.currentValue - pos.totalDeposited) / pos.totalDeposited) * 100).toFixed(2)
                : '0.00';
              return (
                <Pressable
                  key={pos.pubkey}
                  style={({ pressed }) => [styles.posCard, pressed && styles.posCardPressed]}
                  onPress={() => router.push(`/vault/${pos.vaultConfigPubkey}`)}
                >
                  <View style={styles.posHeader}>
                    <View style={styles.posLeft}>
                      <Text style={styles.posName}>{pos.vault?.name ?? 'Unknown Vault'}</Text>
                      {pos.vault && <StatusBadge status={pos.vault.status} size="sm" />}
                    </View>
                    <View style={styles.posRight}>
                      <Text style={styles.posValue}>{formatUSD(pos.currentValue)}</Text>
                      <Text style={[styles.posPnL, { color: pc }]}>
                        {formatPnL(pos.totalDeposited, pos.currentValue)} ({ret}%)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.posStats}>
                    <View>
                      <Text style={styles.posStatLabel}>DEPOSITED</Text>
                      <Text style={styles.posStatVal}>{formatUSD(pos.totalDeposited, true)}</Text>
                    </View>
                    <View>
                      <Text style={styles.posStatLabel}>SHARES</Text>
                      <Text style={styles.posStatVal}>{pos.seniorShares.toLocaleString()}</Text>
                    </View>
                    <View>
                      <Text style={styles.posStatLabel}>AGE</Text>
                      <Text style={styles.posStatVal}>{formatAge(pos.depositedAt)} ago</Text>
                    </View>
                  </View>

                  {pos.vault && <HealthMeter health={pos.vault.juniorHealth} showLabel={false} height={3} />}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { gap: spacing.sm, paddingBottom: 48 },
  disconnectedHero: { padding: spacing.md, paddingBottom: 24, alignItems: 'center', gap: 6 },
  disconnectedTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: 4, fontFamily: 'Courier' },
  disconnectedSub: { fontSize: 13, color: colors.textQuiet },
  connectWrap: { position: 'absolute', bottom: 0, left: spacing.md, right: spacing.md },
  connectBtn: { borderRadius: radius.lg, overflow: 'hidden' },
  connectBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingBottom: 16, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  demoBanner: {
    backgroundColor: colors.warningDim,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.warning + '44',
  },
  demoBannerText: { fontSize: 11, color: colors.warning, fontWeight: '600' },
  balanceCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceItem: { flex: 1, alignItems: 'center', gap: 3 },
  balanceDivider: { width: 1, height: 32, backgroundColor: colors.border },
  balanceLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  balanceValue: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  summaryCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.signal + '33',
    padding: spacing.md,
    gap: 12,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
  summaryBig: { fontSize: 36, fontWeight: '800', color: colors.text, fontFamily: 'Courier', letterSpacing: -1 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryCenter: { alignItems: 'center' },
  statLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  statMono: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  pnlBar: { height: 3, backgroundColor: colors.surfaceHigh, borderRadius: radius.full, overflow: 'hidden' },
  pnlFill: { height: 3, borderRadius: radius.full },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: spacing.md, marginTop: 4 },
  posCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  posCardPressed: { opacity: 0.78, borderColor: colors.signal + '55' },
  posHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  posLeft: { gap: 5, flex: 1 },
  posName: { fontSize: 16, fontWeight: '700', color: colors.text },
  posRight: { alignItems: 'flex-end' },
  posValue: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  posPnL: { fontSize: 12, fontWeight: '600', fontFamily: 'Courier' },
  posStats: { flexDirection: 'row', justifyContent: 'space-between' },
  posStatLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  posStatVal: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
});
