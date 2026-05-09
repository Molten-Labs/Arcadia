import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useVault, useNavHistory } from '../../src/hooks/useVaults';
import { useBalance } from '../../src/hooks/useBalance';
import { useArcadiaTransactions } from '../../src/hooks/useTransactions';
import { useWallet } from '../../src/lib/wallet';
import { StatusBadge } from '../../src/components/StatusBadge';
import { HealthMeter } from '../../src/components/HealthMeter';
import { CapitalStack } from '../../src/components/CapitalStack';
import { EmptyState } from '../../src/components/EmptyState';
import { TxModal, TxState, txFailureState } from '../../src/components/TxModal';
import { formatUSD, formatBps, formatNav, formatAge, truncateAddress } from '../../src/lib/format';
import { parseUsdcToUnits } from '../../src/lib/amounts';

type Tab = 'overview' | 'deposit' | 'withdraw';

function StatPill({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={pill.wrap}>
      <Text style={[pill.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      <Text style={pill.label}>{label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  value: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  label: { fontSize: 7, fontWeight: '700', color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: 'Courier' },
});

export default function VaultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { connected, role, connect, isDemoWallet } = useWallet();
  const { data: vault, isLoading, refetch: refetchVault } = useVault(id);
  const { data: navHistory, refetch: refetchNav } = useNavHistory(id);
  const { data: balance } = useBalance();
  const { depositSenior, withdrawSenior } = useArcadiaTransactions();

  const [tab, setTab] = useState<Tab>('overview');
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchVault(),
        refetchNav(),
        queryClient.invalidateQueries({ queryKey: ['balance'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  useLayoutEffect(() => {
    if (vault) navigation.setOptions({ headerTitle: vault.name });
  }, [vault, navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }
  if (!vault) return <EmptyState icon="⬡" title="Vault not found" />;

  const navChange = vault.currentNav - 1;
  const navPositive = navChange >= 0;
  const canDeposit = connected && role === 'investor' && vault.status === 'active';
  const hColor = vault.juniorHealth >= 0.8 ? colors.signal
    : vault.juniorHealth >= 0.6 ? colors.warning : colors.danger;

  const navPts = navHistory ?? [];
  const minNav = Math.min(...navPts.map(p => p.nav), vault.currentNav);
  const maxNav = Math.max(...navPts.map(p => p.nav), vault.currentNav);
  const navRange = maxNav - minNav || 0.01;

  const getVaultConfigKey = () => {
    try {
      return new PublicKey(vault!.configPubkey);
    } catch {
      if (isDemoWallet) return new PublicKey('11111111111111111111111111111111');
      throw new Error('Vault address is not a valid Solana public key');
    }
  };

  async function handleDeposit() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const usdcUnits = parseUsdcToUnits(amount);
    if (!usdcUnits || usdcUnits <= 0n) { Alert.alert('Invalid Amount'); return; }
    if (!connected) {
      try { await connect(); } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
      return;
    }
    try {
      setTxState({ type: 'building' });
      const configKey = getVaultConfigKey();
      setTxState({ type: 'signing' });
      const result = await depositSenior(configKey, usdcUnits);
      setTxState({ type: 'confirming' });
      await new Promise(r => setTimeout(r, 400));
      setTxState({ type: 'success', sig: result.sig, demo: result.demo });
      setAmount('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setTxState(txFailureState(err, 'Unknown error'));
    }
  }

  async function handleWithdraw() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const usdcUnits = parseUsdcToUnits(amount);
    if (!usdcUnits || usdcUnits <= 0n) { Alert.alert('Invalid Amount'); return; }
    if (!connected) {
      try { await connect(); } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
      return;
    }
    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${formatUSD(Number(usdcUnits) / 1_000_000)} from ${vault!.name}?\nExit: ${vault!.instantExit ? 'Instant' : 'Cooldown'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', style: 'destructive',
          onPress: async () => {
            try {
              setTxState({ type: 'building' });
              const configKey = getVaultConfigKey();
              setTxState({ type: 'signing' });
              const result = await withdrawSenior(configKey, usdcUnits);
              setTxState({ type: 'confirming' });
              await new Promise(r => setTimeout(r, 400));
              setTxState({ type: 'success', sig: result.sig, demo: result.demo });
              setAmount('');
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              setTxState(txFailureState(err, 'Unknown error'));
            }
          }
        }
      ]
    );
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label={tab === 'deposit' ? 'Deposit' : 'Withdrawal'} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.signal}
            colors={[colors.signal]}
          />
        }
      >
        {/* Hero — NAV is the star, value much bigger than labels */}
        <View style={[styles.heroCard, vault.status === 'active' && styles.heroCardActive]}>
          <LinearGradient
            colors={['rgba(0,200,150,0.10)', 'rgba(0,200,150,0.03)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          <View style={styles.heroTopRow}>
            <StatusBadge status={vault.status} />
            <Text style={styles.heroSubAddr}>{truncateAddress(vault.managerPubkey, 8)}</Text>
          </View>

          <Text style={styles.heroName}>{vault.name}</Text>

          {/* NAV is the primary hero metric */}
          <View style={styles.navHero}>
            <View>
              <Text style={styles.navHeroLabel}>NET ASSET VALUE</Text>
              <Text style={styles.navHeroValue}>{formatNav(vault.currentNav)}</Text>
            </View>
            <View style={[
              styles.navDeltaBadge,
              { backgroundColor: navPositive ? colors.signalDim : colors.dangerDim,
                borderColor: navPositive ? colors.signal + '40' : colors.danger + '40' }
            ]}>
              <Text style={[styles.navDeltaText, { color: navPositive ? colors.signal : colors.danger }]}>
                {navPositive ? '▲' : '▼'} {Math.abs(navChange * 100).toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* NAV chart — area chart with gradient bars */}
        {navPts.length > 1 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>NAV · 30 DAYS</Text>
              <Text style={styles.chartRange}>
                {formatNav(minNav)} — {formatNav(maxNav)}
              </Text>
            </View>
            <View style={styles.chartBars}>
              {navPts.map((p, i) => {
                const h = Math.max(6, ((p.nav - minNav) / navRange) * 80);
                const isLast = i === navPts.length - 1;
                const abovePar = p.nav >= 1;
                return (
                  <View key={i} style={styles.barWrap}>
                    <View style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: isLast ? colors.signal
                          : abovePar ? colors.signal + 'AA'
                          : colors.surfaceHigh,
                        shadowColor: isLast ? colors.signal : 'transparent',
                        shadowOpacity: isLast ? 0.7 : 0,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 0 },
                      }
                    ]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.chartFooter}>
              <Text style={styles.chartLabel}>30d ago</Text>
              <Text style={styles.chartLabel}>Today</Text>
            </View>
          </View>
        )}

        {/* Stats grid — values larger than labels */}
        <View style={styles.statsGrid}>
          <View style={styles.statsCard}>
            <StatPill label="TVL" value={formatUSD(vault.tvl, true)} />
            <View style={styles.statsDivider} />
            <StatPill label="PERF FEE" value={formatBps(vault.feeBps)} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsCard}>
            <StatPill
              label="24H LOSS"
              value={formatBps(vault.rolling24hLossBps)}
              valueColor={vault.rolling24hLossBps > 100 ? colors.danger : colors.signal}
            />
            <View style={styles.statsDivider} />
            <StatPill
              label="7D LOSS"
              value={formatBps(vault.rolling7dLossBps)}
              valueColor={vault.rolling7dLossBps > 300 ? colors.danger : vault.rolling7dLossBps > 100 ? colors.warning : colors.signal}
            />
            <View style={styles.statsDivider} />
            <StatPill
              label="HEALTH"
              value={`${(vault.juniorHealth * 100).toFixed(0)}%`}
              valueColor={hColor}
            />
          </View>
        </View>

        {/* Health meter */}
        <View style={styles.card}>
          <HealthMeter health={vault.juniorHealth} />
        </View>

        {/* Capital stack */}
        <View style={styles.card}>
          <CapitalStack juniorCapital={vault.juniorCapital} seniorCapital={vault.seniorCapital} />
        </View>

        {/* Parameters */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PARAMETERS</Text>
          {([
            ['Max Slippage', formatBps(vault.maxSlippageBps)],
            ['High Water Mark', formatNav(vault.highWaterMark)],
            ['Exit Type', vault.instantExit ? '⚡ Instant' : '⏳ Cooldown'],
            ['Paper Trades', `${vault.paperTradeCount} / ${vault.minQualifyingTrades}`],
            ['Vault Age', formatAge(vault.createdAt) + ' ago'],
            ['Graduated', vault.graduatedAt ? formatAge(vault.graduatedAt) + ' ago' : '—'],
          ] as [string, string][]).map(([k, v]) => (
            <View key={k} style={styles.paramRow}>
              <Text style={styles.paramKey}>{k}</Text>
              <Text style={styles.paramVal}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Action card — in thumb zone at bottom of scroll */}
        <View style={styles.actionCard}>
          <View style={styles.tabs}>
            {(['overview', 'deposit', 'withdraw'] as Tab[]).map(t => (
              <Pressable
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'overview' ? 'Info' : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.tabBody}>
            {tab === 'overview' && (
              <Text style={styles.infoText}>
                {vault.status === 'paper'
                  ? 'This vault is in paper trading mode. The manager is building a qualifying track record before it can accept senior capital.'
                  : vault.status === 'active'
                  ? 'Active and accepting senior capital. The manager has graduated by proving performance with their own junior stake.'
                  : vault.status === 'cooldown'
                  ? 'In cooldown due to drawdown. Deposits are paused while the manager recovers to the high-water mark.'
                  : vault.status === 'frozen'
                  ? 'Frozen due to excessive drawdown. Withdrawals only — no new deposits.'
                  : 'This vault has been closed permanently.'}
              </Text>
            )}

            {(tab === 'deposit' || tab === 'withdraw') && (
              !connected ? (
                <View style={styles.gate}>
                  <Text style={styles.gateText}>Connect your wallet to continue</Text>
                  <Pressable
                    style={styles.gateBtn}
                    onPress={() => connect().catch((err: any) => Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet'))}
                  >
                    <LinearGradient
                      colors={[colors.signal, colors.signalDeep]}
                      style={styles.gateBtnGrad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.gateBtnText}>Connect Wallet</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : tab === 'deposit' && !canDeposit ? (
                <Text style={styles.gateText}>
                  {role !== 'investor'
                    ? 'Switch to Investor role in Settings to deposit.'
                    : `Deposits unavailable — vault is ${vault.status}.`}
                </Text>
              ) : (
                <>
                  {balance && (
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabelSm}>USDC balance</Text>
                      <Text style={styles.balanceAmt}>
                        {formatUSD(balance.usdc)}
                        {isDemoWallet && <Text style={{ color: colors.warning, fontSize: 11 }}> demo</Text>}
                      </Text>
                    </View>
                  )}

                  <View style={styles.amtWrap}>
                    <TextInput
                      style={styles.amtInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textQuiet}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                    <Text style={styles.amtUnit}>USDC</Text>
                    {balance && balance.usdc > 0 && (
                      <Pressable
                        style={styles.maxChip}
                        onPress={() => setAmount(balance.usdc.toFixed(2))}
                      >
                        <Text style={styles.maxChipText}>MAX</Text>
                      </Pressable>
                    )}
                  </View>

                  {tab === 'withdraw' && (
                    <View style={styles.exitNote}>
                      <Text style={styles.exitNoteText}>
                        {vault.instantExit ? '⚡ Instant exit — no cooldown' : '⏳ Pro-rata cooldown exit'}
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={[styles.submitBtn, (!amount || parseFloat(amount) <= 0) && { opacity: 0.4 }]}
                    onPress={tab === 'deposit' ? handleDeposit : handleWithdraw}
                    disabled={!amount || parseFloat(amount) <= 0}
                  >
                    <LinearGradient
                      colors={tab === 'deposit' ? [colors.signal, colors.signalDeep] : [colors.surfaceHigh, colors.surfaceElevated]}
                      style={styles.submitBtnGrad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    >
                      <Text style={[
                        styles.submitBtnText,
                        tab === 'withdraw' && { color: colors.textMuted },
                      ]}>
                        {tab === 'deposit' ? 'Deposit Senior Capital' : 'Withdraw'}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </>
              )
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { gap: 12, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  heroCard: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 10,
    overflow: 'hidden',
  },
  heroCardActive: {
    borderColor: colors.signal + '30',
    shadowColor: colors.signal,
    shadowOpacity: 0.10,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 4 },
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSubAddr: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier' },
  heroName: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.6 },

  navHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  navHeroLabel: {
    fontSize: 9, fontWeight: '700', color: colors.textQuiet,
    textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: 'Courier', marginBottom: 4,
  },
  navHeroValue: {
    fontSize: 40, fontWeight: '600', color: colors.text,
    fontFamily: 'Courier', letterSpacing: -1.5,
  },
  navDeltaBadge: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1,
  },
  navDeltaText: { fontSize: 14, fontWeight: '800', fontFamily: 'Courier' },

  chartCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'Courier' },
  chartRange: { fontSize: 9, color: colors.textQuiet, fontFamily: 'Courier' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 88, gap: 2 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 4 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { fontSize: 9, color: colors.textQuiet, fontFamily: 'Courier' },

  statsGrid: { marginHorizontal: spacing.md },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statsDivider: { width: 1, backgroundColor: colors.border },

  card: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  cardTitle: {
    fontSize: 9, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'Courier', marginBottom: 12,
  },
  paramRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  paramKey: { fontSize: 13, color: colors.textMuted },
  paramVal: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },

  actionCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: {
    flex: 1, paddingVertical: 16, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.signal },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, fontFamily: 'Courier', letterSpacing: 0.4 },
  tabTextActive: { color: colors.signal },
  tabBody: { padding: 20, gap: 16 },

  infoText: { fontSize: 14, color: colors.textMuted, lineHeight: 24 },

  gate: { gap: 16, alignItems: 'center', paddingVertical: 8 },
  gateText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  gateBtn: { borderRadius: radius.full, overflow: 'hidden', width: '100%' },
  gateBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  gateBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabelSm: { fontSize: 10, fontWeight: '700', color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Courier' },
  balanceAmt: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },

  amtWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md,
  },
  amtInput: {
    flex: 1, height: 60, fontSize: 26, color: colors.text,
    fontFamily: 'Courier', fontWeight: '600',
  },
  amtUnit: { fontSize: 12, color: colors.textMuted, fontWeight: '700', fontFamily: 'Courier' },
  maxChip: {
    marginLeft: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.signalDim,
    borderWidth: 1, borderColor: colors.signal + '40',
  },
  maxChipText: { fontSize: 9, fontWeight: '800', color: colors.signal, letterSpacing: 0.5, fontFamily: 'Courier' },

  exitNote: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  exitNoteText: { fontSize: 13, color: colors.textMuted, fontFamily: 'Courier' },

  submitBtn: { borderRadius: radius.full, overflow: 'hidden' },
  submitBtnGrad: { paddingVertical: 18, alignItems: 'center', borderRadius: radius.full },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
