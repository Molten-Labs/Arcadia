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
import { StatCard } from '../../src/components/StatCard';
import { EmptyState } from '../../src/components/EmptyState';
import { TxModal, TxState } from '../../src/components/TxModal';
import { PrivateIntentPanel } from '../../src/components/PrivateIntentPanel';
import { formatUSD, formatBps, formatNav, formatAge, truncateAddress } from '../../src/lib/format';
import { parseUsdcToUnits } from '../../src/lib/amounts';

type Tab = 'overview' | 'deposit' | 'withdraw';

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
      try {
        await connect();
      } catch (err: any) {
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
      setTxState({ type: 'error', message: err?.message ?? 'Unknown error' });
    }
  }

  async function handleWithdraw() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const usdcUnits = parseUsdcToUnits(amount);
    if (!usdcUnits || usdcUnits <= 0n) { Alert.alert('Invalid Amount'); return; }
    if (!connected) {
      try {
        await connect();
      } catch (err: any) {
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
              setTxState({ type: 'error', message: err?.message ?? 'Unknown error' });
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

        {/* Hero card */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(163,230,53,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTop}>
            <StatusBadge status={vault.status} />
            <View style={styles.navBlock}>
              <Text style={styles.navLabel}>NAV</Text>
              <Text style={styles.navVal}>{formatNav(vault.currentNav)}</Text>
              <Text style={[styles.navDelta, { color: navPositive ? colors.signal : colors.danger }]}>
                {navPositive ? '▲' : '▼'} {Math.abs(navChange * 100).toFixed(2)}%
              </Text>
            </View>
          </View>
          <Text style={styles.heroName}>{vault.name}</Text>
          <Text style={styles.heroSub}>Manager · {truncateAddress(vault.managerPubkey, 10)}</Text>
        </View>

        {/* NAV chart */}
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
                const h = Math.max(4, ((p.nav - minNav) / navRange) * 80);
                const isLast = i === navPts.length - 1;
                return (
                  <View key={i} style={styles.barWrap}>
                    <View style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: isLast ? colors.signal
                          : p.nav >= 1 ? colors.signalDeep + 'CC'
                          : colors.surfaceHigh,
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

        {/* Stats bento */}
        <View style={styles.statsGrid}>
          <StatCard label="TVL" value={formatUSD(vault.tvl, true)} flex={1} />
          <StatCard label="Fee" value={formatBps(vault.feeBps)} flex={1} />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            label="24h Loss"
            value={formatBps(vault.rolling24hLossBps)}
            valueColor={vault.rolling24hLossBps > 100 ? colors.danger : colors.signal}
            flex={1}
          />
          <StatCard
            label="7d Loss"
            value={formatBps(vault.rolling7dLossBps)}
            valueColor={vault.rolling7dLossBps > 300 ? colors.danger : vault.rolling7dLossBps > 100 ? colors.warning : colors.signal}
            flex={1}
          />
        </View>

        <View style={styles.card}><HealthMeter health={vault.juniorHealth} /></View>
        <View style={styles.card}><CapitalStack juniorCapital={vault.juniorCapital} seniorCapital={vault.seniorCapital} /></View>
        <View style={styles.privateIntentWrap}>
          <PrivateIntentPanel vaultConfigPubkey={vault.configPubkey} mode="investor" />
        </View>

        {/* Risk detail */}
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

        {/* Action card */}
        <View style={styles.actionCard}>
          {/* Tab strip */}
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
                    : `Deposits are unavailable — vault is ${vault.status}.`}
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
  scroll: { gap: 10, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  heroCard: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  navBlock: { alignItems: 'flex-end' },
  navLabel: { fontSize: 9, color: colors.textQuiet, fontFamily: 'Courier', letterSpacing: 0.5, textTransform: 'uppercase' },
  navVal: { fontSize: 26, fontWeight: '600', color: colors.text, fontFamily: 'Courier', letterSpacing: -0.5 },
  navDelta: { fontSize: 12, fontWeight: '700', fontFamily: 'Courier' },
  heroName: { fontSize: 26, fontWeight: '600', color: colors.text, letterSpacing: -0.4 },
  heroSub: { fontSize: 11, color: colors.textQuiet, fontFamily: 'Courier' },

  chartCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'Courier' },
  chartRange: { fontSize: 9, color: colors.textQuiet, fontFamily: 'Courier' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 88, gap: 1.5 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 3 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { fontSize: 9, color: colors.textQuiet, fontFamily: 'Courier' },

  statsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: spacing.md },
  card: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  privateIntentWrap: { marginHorizontal: spacing.md },
  cardTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Courier',
    marginBottom: 12,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paramKey: { fontSize: 13, color: colors.textMuted },
  paramVal: { fontSize: 12, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },

  actionCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.signal },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: 'Courier' },
  tabTextActive: { color: colors.signal },
  tabBody: { padding: spacing.md, gap: 14 },

  infoText: { fontSize: 13, color: colors.textMuted, lineHeight: 22 },
  gate: { gap: 14, alignItems: 'center', paddingVertical: 8 },
  gateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  gateBtn: { borderRadius: radius.full, overflow: 'hidden', width: '100%' },
  gateBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  gateBtnText: { fontSize: 15, fontWeight: '700', color: colors.bg },

  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabelSm: { fontSize: 10, fontWeight: '600', color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Courier' },
  balanceAmt: { fontSize: 14, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },

  amtWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
  },
  amtInput: {
    flex: 1,
    height: 56,
    fontSize: 22,
    color: colors.text,
    fontFamily: 'Courier',
    fontWeight: '600',
  },
  amtUnit: { fontSize: 12, color: colors.textMuted, fontWeight: '600', fontFamily: 'Courier' },
  maxChip: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '40',
  },
  maxChipText: { fontSize: 9, fontWeight: '700', color: colors.signal, letterSpacing: 0.5, fontFamily: 'Courier' },
  exitNote: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exitNoteText: { fontSize: 12, color: colors.textMuted, fontFamily: 'Courier' },
  submitBtn: { borderRadius: radius.full, overflow: 'hidden' },
  submitBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: radius.full },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
});
