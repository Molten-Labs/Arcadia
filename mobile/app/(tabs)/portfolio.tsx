import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
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

function ActivityRow({
  label, sub, value, positive, onPress,
}: { label: string; sub: string; value: string; positive: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actRow, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={[styles.actDot, { backgroundColor: positive ? colors.signalDim : colors.dangerDim }]}>
        <Text style={{ fontSize: 14, color: positive ? colors.signal : colors.danger }}>
          {positive ? '↑' : '↓'}
        </Text>
      </View>
      <View style={styles.actInfo}>
        <Text style={styles.actLabel}>{label}</Text>
        <Text style={styles.actSub}>{sub}</Text>
      </View>
      <Text style={[styles.actValue, { color: positive ? colors.signal : colors.danger }]}>
        {value}
      </Text>
    </Pressable>
  );
}

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connected, connect, isDemoWallet, publicKey } = useWallet();
  const { data: positions, isLoading, refetch, isRefetching } = usePositions(publicKey);
  const { data: balance } = useBalance();

  const totalDeposited = (positions ?? []).reduce((s, p) => s + p.totalDeposited, 0);
  const totalCurrent = (positions ?? []).reduce((s, p) => s + p.currentValue, 0);
  const totalPnL = totalCurrent - totalDeposited;
  const pnlC = pnlColor(totalDeposited, totalCurrent, colors);
  const pnlPct = totalDeposited > 0
    ? ((totalPnL / totalDeposited) * 100).toFixed(2) : '0.00';

  async function handleConnect() {
    try {
      await connect();
    } catch (err: any) {
      Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
    }
  }

  if (!connected) {
    return (
      <View style={[styles.screen]}>
        <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.pageTitle}>Portfolio</Text>
          <WalletButton />
        </View>
        <EmptyState
          icon="◈"
          title="Connect your wallet"
          subtitle="View positions, P&L, and manage your capital"
        />
        <View style={[styles.connectWrap, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable style={styles.connectBtn} onPress={handleConnect}>
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
        }
      >
        {/* Nav */}
        <View style={styles.navbar}>
          <Text style={styles.pageTitle}>Portfolio</Text>
          <WalletButton />
        </View>

        {isDemoWallet && (
          <View style={[styles.demoBanner, { marginHorizontal: spacing.md }]}>
            <Text style={styles.demoBannerText}>◐ Demo wallet — simulated data</Text>
          </View>
        )}

        {/* Total balance hero */}
        <View style={styles.balanceHero}>
          <LinearGradient
            colors={[colors.signalDim, 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceBig}>{formatUSD(totalCurrent)}</Text>
            </View>
            <View style={[
              styles.pnlPill,
              { backgroundColor: totalPnL >= 0 ? colors.signalDim : colors.dangerDim }
            ]}>
              <Text style={[styles.pnlPillText, { color: totalPnL >= 0 ? colors.signal : colors.danger }]}>
                {totalPnL >= 0 ? '+' : ''}{pnlPct}%
              </Text>
            </View>
          </View>

          {/* Wallet balances */}
          {balance && (
            <View style={styles.walletTokens}>
              <View style={styles.tokenRow}>
                <View style={styles.tokenIcon}><Text style={styles.tokenIconText}>◎</Text></View>
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenName}>SOL</Text>
                  <Text style={styles.tokenSub}>Solana</Text>
                </View>
                <Text style={styles.tokenAmount}>{balance.sol.toFixed(4)}</Text>
              </View>
              <View style={styles.tokenDivider} />
              <View style={styles.tokenRow}>
                <View style={[styles.tokenIcon, { backgroundColor: colors.surfaceHigh }]}>
                  <Text style={styles.tokenIconText}>$</Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenName}>USDC</Text>
                  <Text style={styles.tokenSub}>USD Coin</Text>
                </View>
                <Text style={styles.tokenAmount}>{formatUSD(balance.usdc)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* P&L strip */}
        {(positions ?? []).length > 0 && (
          <View style={styles.pnlStrip}>
            <View style={styles.pnlCell}>
              <Text style={styles.pnlLabel}>DEPOSITED</Text>
              <Text style={styles.pnlValue}>{formatUSD(totalDeposited, true)}</Text>
            </View>
            <View style={styles.pnlDivider} />
            <View style={styles.pnlCell}>
              <Text style={styles.pnlLabel}>TOTAL P&L</Text>
              <Text style={[styles.pnlValue, { color: pnlC }]}>
                {formatPnL(totalDeposited, totalCurrent)}
              </Text>
            </View>
            <View style={styles.pnlDivider} />
            <View style={styles.pnlCell}>
              <Text style={styles.pnlLabel}>POSITIONS</Text>
              <Text style={styles.pnlValue}>{(positions ?? []).length}</Text>
            </View>
          </View>
        )}

        {/* Activity log header */}
        <Text style={styles.sectionTitle}>Active Positions</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.signal} style={{ marginTop: 24 }} />
        ) : (positions ?? []).length === 0 ? (
          <EmptyState
            icon="◈"
            title="No positions yet"
            subtitle="Deposit into a graduated vault to start earning"
          />
        ) : (
          <View style={styles.activityCard}>
            {(positions ?? []).map((pos, i) => {
              const positive = pos.currentValue >= pos.totalDeposited;
              const pnlStr = formatPnL(pos.totalDeposited, pos.currentValue);
              const ret = pos.totalDeposited > 0
                ? ((pos.currentValue - pos.totalDeposited) / pos.totalDeposited * 100).toFixed(2)
                : '0.00';
              return (
                <React.Fragment key={pos.pubkey}>
                  {i > 0 && <View style={styles.actDivider} />}
                  <ActivityRow
                    label={pos.vault?.name ?? 'Unknown Vault'}
                    sub={`${formatAge(pos.depositedAt)} ago · ${formatUSD(pos.currentValue, true)} current claim`}
                    value={`${pnlStr} (${ret}%)`}
                    positive={positive}
                    onPress={() => router.push(`/vault/${pos.vaultConfigPubkey}`)}
                  />
                  {pos.vault && (
                    <View style={styles.actHealth}>
                      <StatusBadge status={pos.vault.status} size="sm" />
                      <View style={{ flex: 1 }}>
                        <HealthMeter health={pos.vault.juniorHealth} showLabel={false} height={3} />
                      </View>
                      <Text style={styles.actPositionVal}>{formatUSD(pos.currentValue, true)}</Text>
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { gap: spacing.sm, paddingBottom: 48 },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.6,
  },
  demoBanner: {
    backgroundColor: colors.warningDim,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    alignSelf: 'flex-start',
  },
  demoBannerText: { fontSize: 11, color: colors.warning, fontWeight: '600', fontFamily: 'Courier' },
  connectWrap: { paddingHorizontal: spacing.md },
  connectBtn: { borderRadius: radius.full, overflow: 'hidden' },
  connectBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },

  balanceHero: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 16,
    overflow: 'hidden',
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  balanceBig: {
    fontSize: 40,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -1.5,
    fontFamily: 'Courier',
  },
  pnlPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginTop: 6,
  },
  pnlPillText: { fontSize: 13, fontWeight: '700', fontFamily: 'Courier' },

  walletTokens: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tokenDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  tokenIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: { fontSize: 15, color: colors.signal, fontWeight: '700' },
  tokenInfo: { flex: 1 },
  tokenName: { fontSize: 14, fontWeight: '600', color: colors.text },
  tokenSub: { fontSize: 11, color: colors.textQuiet, fontFamily: 'Courier' },
  tokenAmount: { fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },

  pnlStrip: {
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pnlCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  pnlDivider: { width: 1, backgroundColor: colors.border },
  pnlLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  pnlValue: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Courier',
    paddingHorizontal: spacing.md,
  },
  activityCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
  },
  actDot: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actInfo: { flex: 1 },
  actLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  actSub: { fontSize: 11, color: colors.textQuiet, marginTop: 1, fontFamily: 'Courier' },
  actValue: { fontSize: 14, fontWeight: '700', fontFamily: 'Courier' },
  actHealth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  actPositionVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
});
