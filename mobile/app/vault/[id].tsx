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
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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
import { formatUSD, formatBps, formatNav, formatAge, truncateAddress } from '../../src/lib/format';

type Tab = 'overview' | 'deposit' | 'withdraw';

export default function VaultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { connected, role, connect, isDemoWallet } = useWallet();
  const { data: vault, isLoading } = useVault(id);
  const { data: navHistory } = useNavHistory(id);
  const { data: balance } = useBalance();
  const { depositSenior, withdrawSenior } = useArcadiaTransactions();

  const [tab, setTab] = useState<Tab>('overview');
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

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
  const canWithdraw = connected && role === 'investor';

  const navPts = navHistory ?? [];
  const minNav = Math.min(...navPts.map(p => p.nav), vault.currentNav);
  const maxNav = Math.max(...navPts.map(p => p.nav), vault.currentNav);
  const navRange = maxNav - minNav || 0.01;

  async function handleDeposit() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { Alert.alert('Invalid Amount', 'Enter a positive number.'); return; }
    if (!connected) { connect(); return; }

    try {
      setTxState({ type: 'building' });
      const usdcUnits = BigInt(Math.floor(parsed * 1_000_000));
      const configKey = new PublicKey(vault!.configPubkey);
      setTxState({ type: 'signing' });
      const result = await depositSenior(configKey, usdcUnits);
      setTxState({ type: 'confirming' });
      await new Promise(r => setTimeout(r, 500));
      setTxState({ type: 'success', sig: result.sig, demo: result.demo });
      setAmount('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setTxState({ type: 'error', message: err?.message ?? 'Unknown error' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function handleWithdraw() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { Alert.alert('Invalid Amount', 'Enter a positive number.'); return; }
    if (!connected) { connect(); return; }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${formatUSD(parsed)} from ${vault!.name}?\n\nExit type: ${vault!.instantExit ? 'Instant' : 'Cooldown (pro-rata)'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', style: 'destructive',
          onPress: async () => {
            try {
              setTxState({ type: 'building' });
              const usdcUnits = BigInt(Math.floor(parsed * 1_000_000));
              const configKey = new PublicKey(vault!.configPubkey);
              const dummyPriceAccount = new PublicKey('11111111111111111111111111111111');
              setTxState({ type: 'signing' });
              const result = await withdrawSenior(configKey, usdcUnits, dummyPriceAccount, dummyPriceAccount);
              setTxState({ type: 'confirming' });
              await new Promise(r => setTimeout(r, 500));
              setTxState({ type: 'success', sig: result.sig, demo: result.demo });
              setAmount('');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient
          colors={[colors.signalDeep + '28', colors.bg]}
          style={styles.heroGrad}
        >
          <View style={styles.heroHeader}>
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
          <Text style={styles.heroManager}>
            Manager · {truncateAddress(vault.managerPubkey, 8)}
          </Text>
        </LinearGradient>

        {/* NAV Chart */}
        {navPts.length > 1 && (
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              <Text style={styles.chartTitle}>NAV HISTORY · 30D</Text>
              <Text style={styles.chartRange}>
                {formatNav(minNav)} — {formatNav(maxNav)}
              </Text>
            </View>
            <View style={styles.chartBars}>
              {navPts.map((p, i) => {
                const h = Math.max(4, ((p.nav - minNav) / navRange) * 72);
                const isLast = i === navPts.length - 1;
                return (
                  <View key={i} style={styles.barWrap}>
                    <View style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: isLast ? colors.signal
                          : p.nav >= 1 ? colors.signalDeep
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

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard label="TVL" value={formatUSD(vault.tvl, true)} flex={1} />
          <StatCard label="Manager Fee" value={formatBps(vault.feeBps)} flex={1} />
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

        {/* Health + Capital */}
        <View style={styles.card}><HealthMeter health={vault.juniorHealth} /></View>
        <View style={styles.card}>
          <CapitalStack juniorCapital={vault.juniorCapital} seniorCapital={vault.seniorCapital} />
        </View>

        {/* Risk params */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RISK PARAMETERS</Text>
          {([
            ['Max Slippage', formatBps(vault.maxSlippageBps)],
            ['High Water Mark', formatNav(vault.highWaterMark)],
            ['Exit Type', vault.instantExit ? '⚡ Instant' : '⏳ Cooldown'],
            ['Paper Trades', `${vault.paperTradeCount} / ${vault.minQualifyingTrades}`],
            ['Created', formatAge(vault.createdAt) + ' ago'],
            ['Graduated', vault.graduatedAt ? formatAge(vault.graduatedAt) + ' ago' : '—'],
          ] as [string, string][]).map(([k, v]) => (
            <View key={k} style={styles.paramRow}>
              <Text style={styles.paramKey}>{k}</Text>
              <Text style={styles.paramVal}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Action tabs */}
        <View style={styles.txCard}>
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

          <View style={styles.txBody}>
            {tab === 'overview' && (
              <Text style={styles.infoText}>
                {vault.status === 'paper' ? 'This vault is in paper trading mode. It has not yet graduated and cannot accept senior capital.' :
                 vault.status === 'active' ? 'This vault is active and accepting senior capital deposits. The manager has proven their strategy through qualifying trades.' :
                 vault.status === 'cooldown' ? 'This vault is in cooldown. Deposits are paused while the manager recovers from drawdown.' :
                 vault.status === 'frozen' ? 'This vault is frozen due to excessive drawdown. Withdrawals only.' :
                 'This vault has been closed.'}
              </Text>
            )}

            {(tab === 'deposit' || tab === 'withdraw') && (
              <>
                {!connected ? (
                  <View style={styles.gate}>
                    <Text style={styles.gateText}>Connect your wallet to {tab}.</Text>
                    <Pressable style={styles.connectBtn} onPress={connect}>
                      <Text style={styles.connectBtnText}>Connect Wallet</Text>
                    </Pressable>
                  </View>
                ) : tab === 'deposit' && !canDeposit ? (
                  <Text style={styles.gateText}>
                    {role !== 'investor' ? 'Switch to Investor role in Settings.' : `Deposits unavailable — vault is ${vault.status}.`}
                  </Text>
                ) : (
                  <>
                    {balance && (
                      <View style={styles.balanceRow}>
                        <Text style={styles.balanceLabel}>Your USDC balance</Text>
                        <Text style={styles.balanceValue}>
                          {formatUSD(balance.usdc)}
                          {isDemoWallet && <Text style={styles.demoTag}> (demo)</Text>}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.inputLabel}>USDC Amount</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        placeholderTextColor={colors.textQuiet}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                      />
                      <Text style={styles.inputUnit}>USDC</Text>
                      {balance && balance.usdc > 0 && (
                        <Pressable
                          style={styles.maxBtn}
                          onPress={() => setAmount(balance.usdc.toFixed(2))}
                        >
                          <Text style={styles.maxBtnText}>MAX</Text>
                        </Pressable>
                      )}
                    </View>

                    {tab === 'withdraw' && (
                      <View style={styles.exitBadge}>
                        <Text style={styles.exitBadgeText}>
                          {vault.instantExit ? '⚡ Instant exit enabled' : '⏳ Cooldown-based exit'}
                        </Text>
                      </View>
                    )}

                    <Pressable
                      style={[
                        styles.actionBtn,
                        tab === 'withdraw' && styles.actionBtnWithdraw,
                        (!amount || parseFloat(amount) <= 0) && styles.actionBtnDisabled,
                      ]}
                      onPress={tab === 'deposit' ? handleDeposit : handleWithdraw}
                      disabled={!amount || parseFloat(amount) <= 0}
                    >
                      <LinearGradient
                        colors={tab === 'deposit'
                          ? [colors.signal, colors.signalDeep]
                          : [colors.surfaceHigh, colors.surface]}
                        style={styles.actionBtnGrad}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={[styles.actionBtnText, tab === 'withdraw' && { color: colors.textMuted }]}>
                          {tab === 'deposit' ? 'Deposit Senior Capital' : 'Withdraw Senior Capital'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { gap: spacing.sm, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  heroGrad: { padding: spacing.md, paddingTop: 8, gap: 6 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  navBlock: { alignItems: 'flex-end' },
  navLabel: { fontSize: 9, color: colors.textQuiet, letterSpacing: 0.6, textTransform: 'uppercase' },
  navVal: { fontSize: 24, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  navDelta: { fontSize: 13, fontWeight: '700', fontFamily: 'Courier' },
  heroName: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  heroManager: { fontSize: 12, color: colors.textQuiet, fontFamily: 'Courier' },
  chartCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  chartRange: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 1 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 2 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { fontSize: 9, color: colors.textQuiet, fontFamily: 'Courier' },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md },
  card: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  paramKey: { fontSize: 13, color: colors.textMuted },
  paramVal: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  txCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.signal, backgroundColor: colors.signalDim },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.signal },
  txBody: { padding: spacing.md, gap: 12 },
  infoText: { fontSize: 13, color: colors.textMuted, lineHeight: 21 },
  gate: { gap: 14, alignItems: 'center', paddingVertical: 8 },
  gateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  connectBtn: { backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 28 },
  connectBtnText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: colors.textQuiet },
  balanceValue: { fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  demoTag: { color: colors.warning, fontSize: 11 },
  inputLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, height: 52, fontSize: 20, color: colors.text, fontFamily: 'Courier', fontWeight: '700' },
  inputUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  maxBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '55',
  },
  maxBtnText: { fontSize: 10, fontWeight: '700', color: colors.signal, letterSpacing: 0.4 },
  exitBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exitBadgeText: { fontSize: 12, color: colors.textMuted },
  actionBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionBtnWithdraw: {},
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: radius.md },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
});
