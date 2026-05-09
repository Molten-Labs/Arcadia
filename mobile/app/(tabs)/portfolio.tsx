import React, { useEffect, useRef } from 'react';
import {
  Animated,
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
import { FadeSlideIn } from '../../src/components/AnimatedEntry';
import { formatUSD, formatPnL, pnlColor, formatAge } from '../../src/lib/format';

function AnimatedBalance({ value }: { value: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = React.useState('$0.00');

  useEffect(() => {
    animVal.addListener(({ value: v }) => setDisplay(formatUSD(v)));
    Animated.timing(animVal, { toValue: value, duration: 1100, delay: 300, useNativeDriver: false }).start();
    return () => animVal.removeAllListeners();
  }, [value]);

  return <Text style={styles.balanceBig}>{display}</Text>;
}

function PositionRow({
  label, sub, value, valueColor, returnStr, positive, onPress,
}: {
  label: string; sub: string; value: string; valueColor: string;
  returnStr: string; positive: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={styles.posRow}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
      >
        <View style={[styles.posDot, { backgroundColor: positive ? colors.signalDim : colors.dangerDim }]}>
          <Text style={{ fontSize: 18, color: positive ? colors.signal : colors.danger }}>
            {positive ? '↑' : '↓'}
          </Text>
        </View>
        <View style={styles.posInfo}>
          <Text style={styles.posLabel}>{label}</Text>
          <Text style={styles.posSub}>{sub}</Text>
        </View>
        <View style={styles.posRight}>
          <Text style={[styles.posValue, { color: valueColor }]}>{value}</Text>
          <Text style={[styles.posReturn, { color: positive ? colors.signal : colors.danger }]}>
            {returnStr}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
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
  const pnlPositive = totalPnL >= 0;

  async function handleConnect() {
    try { await connect(); } catch (err: any) {
      Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
    }
  }

  if (!connected) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <FadeSlideIn delay={0}>
          <View style={styles.navbar}>
            <Text style={styles.pageTitle}>Portfolio</Text>
            <WalletButton />
          </View>
        </FadeSlideIn>
        <EmptyState
          icon="◈"
          title="Connect your wallet"
          subtitle="View positions, P&L, and manage your capital"
        />
        <FadeSlideIn delay={200} style={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 24 }}>
          <Pressable style={styles.connectBtn} onPress={handleConnect}>
            <LinearGradient
              colors={[colors.signal, colors.signalDeep]}
              style={styles.connectBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.connectBtnText}>Connect Wallet</Text>
            </LinearGradient>
          </Pressable>
        </FadeSlideIn>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
        }
      >
        <FadeSlideIn delay={0}>
          <View style={styles.navbar}>
            <Text style={styles.pageTitle}>Portfolio</Text>
            <WalletButton />
          </View>
        </FadeSlideIn>

        {isDemoWallet && (
          <FadeSlideIn delay={60} style={{ marginHorizontal: spacing.md }}>
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerText}>◐ Demo wallet · simulated data</Text>
            </View>
          </FadeSlideIn>
        )}

        {/* Balance hero — the primary "peak" moment */}
        <FadeSlideIn delay={100}>
          <View style={styles.balanceHero}>
            <LinearGradient
              colors={['rgba(0,200,150,0.10)', 'rgba(0,200,150,0.02)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <AnimatedBalance value={totalCurrent} />

            {/* P&L pill under the balance */}
            <View style={styles.pnlRow}>
              <View style={[
                styles.pnlPill,
                { backgroundColor: pnlPositive ? colors.signalDim : colors.dangerDim,
                  borderColor: pnlPositive ? colors.signal + '40' : colors.danger + '40' }
              ]}>
                <Text style={[styles.pnlPillText, { color: pnlPositive ? colors.signal : colors.danger }]}>
                  {pnlPositive ? '▲' : '▼'} {Math.abs(Number(pnlPct))}% all time
                </Text>
              </View>
              <Text style={[styles.pnlAbs, { color: pnlC }]}>
                {pnlPositive ? '+' : ''}{formatUSD(totalPnL)}
              </Text>
            </View>
          </View>
        </FadeSlideIn>

        {/* Wallet tokens */}
        {balance && (
          <FadeSlideIn delay={160}>
            <View style={styles.tokensCard}>
              <Text style={styles.sectionLabel}>Wallet</Text>
              <View style={styles.tokenRow}>
                <View style={[styles.tokenIcon, { backgroundColor: colors.signalDim }]}>
                  <Text style={[styles.tokenIconText, { color: colors.signal }]}>◎</Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenName}>Solana</Text>
                  <Text style={styles.tokenTicker}>SOL</Text>
                </View>
                <View style={styles.tokenRight}>
                  <Text style={styles.tokenAmount}>{balance.sol.toFixed(4)}</Text>
                  <Text style={styles.tokenTicker}>SOL</Text>
                </View>
              </View>
              <View style={styles.tokenDivider} />
              <View style={styles.tokenRow}>
                <View style={[styles.tokenIcon, { backgroundColor: colors.surfaceHigh }]}>
                  <Text style={[styles.tokenIconText, { color: colors.textMuted }]}>$</Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenName}>USD Coin</Text>
                  <Text style={styles.tokenTicker}>USDC</Text>
                </View>
                <View style={styles.tokenRight}>
                  <Text style={styles.tokenAmount}>{formatUSD(balance.usdc)}</Text>
                  <Text style={styles.tokenTicker}>USDC</Text>
                </View>
              </View>
            </View>
          </FadeSlideIn>
        )}

        {/* Stats strip — values big */}
        {(positions ?? []).length > 0 && (
          <FadeSlideIn delay={220}>
            <View style={styles.statsStrip}>
              <View style={styles.statsCell}>
                <Text style={styles.statsValue}>{formatUSD(totalDeposited, true)}</Text>
                <Text style={styles.statsLabel}>DEPOSITED</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsCell}>
                <Text style={[styles.statsValue, { color: pnlC }]}>
                  {pnlPositive ? '+' : ''}{formatUSD(totalPnL, true)}
                </Text>
                <Text style={styles.statsLabel}>TOTAL P&L</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsCell}>
                <Text style={styles.statsValue}>{(positions ?? []).length}</Text>
                <Text style={styles.statsLabel}>POSITIONS</Text>
              </View>
            </View>
          </FadeSlideIn>
        )}

        <FadeSlideIn delay={280}>
          <Text style={styles.sectionTitle}>Active Positions</Text>
        </FadeSlideIn>

        {isLoading ? (
          <ActivityIndicator color={colors.signal} style={{ marginTop: 24 }} />
        ) : (positions ?? []).length === 0 ? (
          <EmptyState
            icon="◈"
            title="No positions yet"
            subtitle="Deposit into a graduated vault to start earning"
          />
        ) : (
          <FadeSlideIn delay={320}>
            <View style={styles.positionsCard}>
              {(positions ?? []).map((pos, i) => {
                const positive = pos.currentValue >= pos.totalDeposited;
                const pnlStr = formatPnL(pos.totalDeposited, pos.currentValue);
                const ret = pos.totalDeposited > 0
                  ? `${positive ? '+' : ''}${((pos.currentValue - pos.totalDeposited) / pos.totalDeposited * 100).toFixed(2)}%`
                  : '0.00%';
                return (
                  <React.Fragment key={pos.pubkey}>
                    {i > 0 && <View style={styles.posDivider} />}
                    <PositionRow
                      label={pos.vault?.name ?? 'Unknown Vault'}
                      sub={`${formatAge(pos.depositedAt)} ago · ${formatUSD(pos.currentValue, true)}`}
                      value={pnlStr}
                      valueColor={positive ? colors.signal : colors.danger}
                      returnStr={ret}
                      positive={positive}
                      onPress={() => router.push(`/vault/${pos.vaultConfigPubkey}`)}
                    />
                    {pos.vault && (
                      <View style={styles.posHealth}>
                        <StatusBadge status={pos.vault.status} size="sm" />
                        <View style={{ flex: 1 }}>
                          <HealthMeter health={pos.vault.juniorHealth} showLabel={false} height={3} />
                        </View>
                        <Text style={styles.posVal}>{formatUSD(pos.currentValue, true)}</Text>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </FadeSlideIn>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { gap: 12 },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },

  demoBanner: {
    backgroundColor: colors.warningDim,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  demoBannerText: { fontSize: 11, color: colors.warning, fontWeight: '600', fontFamily: 'Courier' },

  connectBtn: { borderRadius: radius.full, overflow: 'hidden' },
  connectBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  connectBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },

  /* Balance hero */
  balanceHero: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.signal + '20',
    padding: 24,
    gap: 8,
    overflow: 'hidden',
    shadowColor: colors.signal,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
  },
  balanceLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Courier',
  },
  balanceBig: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -2,
    fontFamily: 'Courier',
  },
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  pnlPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
  },
  pnlPillText: { fontSize: 12, fontWeight: '700', fontFamily: 'Courier' },
  pnlAbs: { fontSize: 14, fontWeight: '700', fontFamily: 'Courier' },

  /* Wallet tokens */
  tokensCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Courier',
    marginBottom: 8,
  },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  tokenDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  tokenIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tokenIconText: { fontSize: 16, fontWeight: '800' },
  tokenInfo: { flex: 1 },
  tokenName: { fontSize: 15, fontWeight: '600', color: colors.text },
  tokenTicker: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier', marginTop: 1 },
  tokenRight: { alignItems: 'flex-end' },
  tokenAmount: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },

  /* Stats strip */
  statsStrip: {
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statsCell: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statsDivider: { width: 1, backgroundColor: colors.border },
  statsValue: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  statsLabel: {
    fontSize: 7, fontWeight: '700', color: colors.textQuiet,
    textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Courier',
  },

  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Courier',
    paddingHorizontal: spacing.md,
  },

  /* Positions */
  positionsCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  posDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  posRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 },
  posDot: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  posInfo: { flex: 1 },
  posLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  posSub: { fontSize: 11, color: colors.textQuiet, marginTop: 2, fontFamily: 'Courier' },
  posRight: { alignItems: 'flex-end', gap: 2 },
  posValue: { fontSize: 15, fontWeight: '700', fontFamily: 'Courier' },
  posReturn: { fontSize: 11, fontWeight: '700', fontFamily: 'Courier' },
  posHealth: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  posVal: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: 'Courier' },
});
