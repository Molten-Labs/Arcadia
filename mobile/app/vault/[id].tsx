import React, { useState } from 'react';
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
import { useLayoutEffect } from 'react';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useVault, useNavHistory } from '../../src/hooks/useVaults';
import { useWallet } from '../../src/lib/wallet';
import { StatusBadge } from '../../src/components/StatusBadge';
import { HealthMeter } from '../../src/components/HealthMeter';
import { CapitalStack } from '../../src/components/CapitalStack';
import { StatCard } from '../../src/components/StatCard';
import { EmptyState } from '../../src/components/EmptyState';
import { formatUSD, formatBps, formatNav, formatAge, truncateAddress } from '../../src/lib/format';

type Tab = 'overview' | 'deposit' | 'withdraw';

export default function VaultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { connected, role, connect } = useWallet();
  const { data: vault, isLoading } = useVault(id);
  const { data: navHistory } = useNavHistory(id);
  const [tab, setTab] = useState<Tab>('overview');
  const [amount, setAmount] = useState('');
  const [txPending, setTxPending] = useState(false);

  useLayoutEffect(() => {
    if (vault) {
      navigation.setOptions({ title: vault.name });
    }
  }, [vault, navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }

  if (!vault) {
    return <EmptyState icon="⬡" title="Vault not found" />;
  }

  const navChange = vault.currentNav - 1;
  const navPositive = navChange >= 0;
  const canDeposit = connected && role === 'investor' && vault.status === 'active';
  const canWithdraw = connected && role === 'investor';

  function handleTx(type: 'deposit' | 'withdraw') {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (!connected) { connect(); return; }
    setTxPending(true);
    setTimeout(() => {
      setTxPending(false);
      setAmount('');
      Alert.alert(
        type === 'deposit' ? 'Deposit Submitted' : 'Withdrawal Submitted',
        `Your ${type} of ${formatUSD(parsed)} has been submitted.\n\nThis is a demo — connect to Solana devnet to execute real transactions.`,
      );
    }, 1500);
  }

  const minNav = Math.min(...(navHistory ?? [{ nav: vault.currentNav }]).map(p => p.nav));
  const maxNav = Math.max(...(navHistory ?? [{ nav: vault.currentNav }]).map(p => p.nav));
  const navRange = maxNav - minNav || 0.01;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <StatusBadge status={vault.status} />
          <View style={styles.heroNav}>
            <Text style={styles.heroNavLabel}>NAV</Text>
            <Text style={styles.heroNavValue}>{formatNav(vault.currentNav)}</Text>
            <Text style={[styles.heroNavChange, { color: navPositive ? colors.signal : colors.danger }]}>
              {navPositive ? '+' : ''}{(navChange * 100).toFixed(2)}%
            </Text>
          </View>
        </View>
        <Text style={styles.heroName}>{vault.name}</Text>
        <Text style={styles.heroManager}>
          Manager · {truncateAddress(vault.managerPubkey, 6)}
        </Text>
      </View>

      {navHistory && navHistory.length > 1 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>NAV HISTORY · 30D</Text>
          <View style={styles.chartArea}>
            {navHistory.map((point, i) => {
              const h = ((point.nav - minNav) / navRange) * 100;
              const isLast = i === navHistory.length - 1;
              return (
                <View key={i} style={styles.chartBar}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: `${Math.max(4, h)}%`,
                        backgroundColor: isLast
                          ? colors.signal
                          : point.nav >= 1
                          ? colors.signalDeep
                          : colors.surfaceHigh,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>{formatNav(minNav)}</Text>
            <Text style={styles.chartLabel}>30d range</Text>
            <Text style={styles.chartLabel}>{formatNav(maxNav)}</Text>
          </View>
        </View>
      )}

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

      <View style={styles.card}>
        <HealthMeter health={vault.juniorHealth} />
      </View>

      <View style={styles.card}>
        <CapitalStack juniorCapital={vault.juniorCapital} seniorCapital={vault.seniorCapital} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>RISK PARAMETERS</Text>
        <View style={styles.paramList}>
          {[
            ['Max Slippage', formatBps(vault.maxSlippageBps)],
            ['High Water Mark', formatNav(vault.highWaterMark)],
            ['Exit Type', vault.instantExit ? 'Instant' : 'Cooldown'],
            ['Paper Trades', `${vault.paperTradeCount} / ${vault.minQualifyingTrades}`],
            ['Created', formatAge(vault.createdAt) + ' ago'],
            ['Graduated', vault.graduatedAt ? formatAge(vault.graduatedAt) + ' ago' : '—'],
          ].map(([k, v]) => (
            <View key={k} style={styles.paramRow}>
              <Text style={styles.paramKey}>{k}</Text>
              <Text style={styles.paramVal}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.txCard}>
        <View style={styles.tabs}>
          {(['overview', 'deposit', 'withdraw'] as Tab[]).map(t => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' && (
          <View style={styles.txBody}>
            <Text style={styles.txInfoText}>
              {vault.status === 'paper'
                ? 'This vault is in paper mode. It has not graduated and does not accept senior capital yet.'
                : vault.status === 'active'
                ? 'This vault is active and accepting senior capital deposits from investors.'
                : vault.status === 'cooldown'
                ? 'This vault is in cooldown. Deposits are paused while the manager recovers.'
                : vault.status === 'frozen'
                ? 'This vault is frozen due to excessive drawdown. Withdrawals only.'
                : 'This vault is closed.'}
            </Text>
          </View>
        )}

        {tab === 'deposit' && (
          <View style={styles.txBody}>
            {!canDeposit ? (
              <View style={styles.txGate}>
                <Text style={styles.txGateText}>
                  {!connected
                    ? 'Connect your wallet to deposit.'
                    : role !== 'investor'
                    ? 'Switch to investor role in Settings to deposit.'
                    : vault.status !== 'active'
                    ? `Deposits unavailable — vault is ${vault.status}.`
                    : 'Deposits unavailable.'}
                </Text>
                {!connected && (
                  <Pressable style={styles.connectBtn} onPress={connect}>
                    <Text style={styles.connectBtnText}>Connect Wallet</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.inputLabel}>USDC Amount</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={colors.textQuiet}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.inputCurrency}>USDC</Text>
                </View>
                <Pressable
                  style={[styles.actionBtn, txPending && styles.actionBtnDisabled]}
                  onPress={() => handleTx('deposit')}
                  disabled={txPending}
                >
                  <Text style={styles.actionBtnText}>
                    {txPending ? 'Confirming…' : 'Deposit Senior Capital'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {tab === 'withdraw' && (
          <View style={styles.txBody}>
            {!canWithdraw ? (
              <View style={styles.txGate}>
                <Text style={styles.txGateText}>
                  {!connected ? 'Connect your wallet to withdraw.' : 'Switch to investor role to withdraw.'}
                </Text>
                {!connected && (
                  <Pressable style={styles.connectBtn} onPress={connect}>
                    <Text style={styles.connectBtnText}>Connect Wallet</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.inputLabel}>USDC Amount</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={colors.textQuiet}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.inputCurrency}>USDC</Text>
                </View>
                <Text style={styles.txHint}>
                  Exit type: {vault.instantExit ? '⚡ Instant' : '⏳ Cooldown (pro-rata)'}
                </Text>
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnWithdraw, txPending && styles.actionBtnDisabled]}
                  onPress={() => handleTx('withdraw')}
                  disabled={txPending}
                >
                  <Text style={styles.actionBtnText}>
                    {txPending ? 'Confirming…' : 'Withdraw Senior Capital'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroNav: { alignItems: 'flex-end' },
  heroNavLabel: { fontSize: 9, color: colors.textQuiet, letterSpacing: 0.6, textTransform: 'uppercase' },
  heroNavValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  heroNavChange: { fontSize: 13, fontWeight: '600', fontFamily: 'Courier' },
  heroName: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  heroManager: { fontSize: 12, color: colors.textQuiet, fontFamily: 'Courier' },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  chartTitle: { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.6 },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 2,
  },
  chartBar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  chartBarFill: { width: '100%', borderRadius: 2, minHeight: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier' },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  paramList: { gap: 10 },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paramKey: { fontSize: 13, color: colors.textMuted },
  paramVal: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  txCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.signal, backgroundColor: colors.signalDim },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabBtnTextActive: { color: colors.signal },
  txBody: { padding: spacing.md, gap: 12 },
  txInfoText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  txGate: { gap: 12, alignItems: 'center', paddingVertical: 8 },
  txGateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  connectBtn: {
    backgroundColor: colors.signal,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  connectBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 18,
    color: colors.text,
    fontFamily: 'Courier',
    fontWeight: '600',
  },
  inputCurrency: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  txHint: { fontSize: 12, color: colors.textQuiet },
  actionBtn: {
    backgroundColor: colors.signal,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionBtnWithdraw: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
