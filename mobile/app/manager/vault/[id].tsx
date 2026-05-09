import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { PublicKey } from '@solana/web3.js';
import { colors, radius, spacing } from '../../../src/lib/theme';
import { useVault } from '../../../src/hooks/useVaults';
import { useWallet } from '../../../src/lib/wallet';
import { useArcadiaTransactions } from '../../../src/hooks/useTransactions';
import { parseUsdcToUnits } from '../../../src/lib/amounts';
import { TxModal, TxState, txFailureState } from '../../../src/components/TxModal';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { HealthMeter } from '../../../src/components/HealthMeter';
import { formatBps, formatUSD } from '../../../src/lib/format';

export default function ManagerVaultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vault } = useVault(id);
  const { connected, connect, role, setRole, isDemoWallet } = useWallet();
  const { depositJunior, withdrawJunior, updateNav, graduateVault, claimFees, executeGuardedSwap } = useArcadiaTransactions();
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  if (!vault) {
    return <View style={styles.center}><Text style={styles.copy}>Vault not found.</Text></View>;
  }

  const amountUnits = parseUsdcToUnits(amount);
  const canUseAmount = amountUnits !== null && amountUnits > 0n;
  const canGraduate = vault.status === 'paper' &&
    vault.paperTradeCount >= vault.minQualifyingTrades &&
    vault.currentNav >= vault.highWaterMark;
  const paperProgress = Math.min(1, vault.paperTradeCount / Math.max(1, vault.minQualifyingTrades));
  const maxTradeLabel = vault.juniorHealth < 0.45 ? 'Locked'
    : vault.juniorHealth < 0.7 ? '5% TVL'
    : '15% TVL';

  const getConfigKey = () => {
    try { return new PublicKey(vault.configPubkey); }
    catch {
      if (isDemoWallet) return new PublicKey('11111111111111111111111111111111');
      throw new Error('Vault address is not a valid Solana public key');
    }
  };

  async function run(label: string, action: () => Promise<{ sig: string; demo: boolean }>) {
    if (!connected) {
      try {
        await connect();
      } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
      return;
    }
    if (role !== 'trader') { setRole('trader'); Alert.alert('Trader mode enabled', 'Submit again to continue.'); return; }
    try {
      setTxState({ type: 'building' });
      setTxState({ type: 'signing' });
      const result = await action();
      setTxState({ type: 'confirming' });
      setTimeout(() => setTxState({ type: 'success', sig: result.sig, demo: result.demo }), 350);
    } catch (err: any) {
      setTxState(txFailureState(err, `${label} failed`));
    }
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label="Manager Vault" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <StatusBadge status={vault.status} />
          <Text style={styles.title}>{vault.name}</Text>
          <Text style={styles.copy}>Trader-only operations. Investors cannot access these controls.</Text>
          <View style={styles.heroStrip}>
            <Text style={styles.heroStripLabel}>MWA flow</Text>
            <Text style={styles.heroStripValue}>Build to wallet approval to devnet confirm</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Metric label="NAV" value={vault.currentNav.toFixed(4)} />
          <Metric label="Junior" value={formatUSD(vault.juniorCapital, true)} />
          <Metric label="Fee" value={formatBps(vault.feeBps)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Junior buffer</Text>
          <HealthMeter health={vault.juniorHealth} />
          <View style={styles.limitRow}>
            <Text style={styles.hint}>Guard limit tightens as junior health drops.</Text>
            <Text style={styles.limitValue}>{maxTradeLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Proof checklist</Text>
          <CheckRow label="Junior capital posted" done={vault.juniorCapital > 0} />
          <CheckRow label={`Paper trades ${vault.paperTradeCount}/${vault.minQualifyingTrades}`} done={paperProgress >= 1} />
          <CheckRow label="Graduation unlocked" done={canGraduate || vault.status !== 'paper'} />
          <CheckRow label="Guarded trading enabled" done={vault.tradingEnabled} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>USDC amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textQuiet}
            keyboardType="decimal-pad"
          />
          <View style={styles.actionGrid}>
            <Action label="Deposit junior" disabled={!canUseAmount} onPress={() => run('Deposit junior', () => depositJunior(getConfigKey(), amountUnits!))} />
            <Action label="Withdraw junior" disabled={!canUseAmount} onPress={() => run('Withdraw junior', () => withdrawJunior(getConfigKey(), amountUnits!))} />
            <Action label="Guarded swap" disabled={!canUseAmount || !vault.tradingEnabled} onPress={() => run('Guarded swap', () => executeGuardedSwap(getConfigKey(), amountUnits!, 0n))} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Vault actions</Text>
          <View style={styles.actionGrid}>
            <Action label="Update NAV" onPress={() => run('Update NAV', () => updateNav(getConfigKey()))} />
            <Action label="Graduate" disabled={!canGraduate} onPress={() => run('Graduate vault', () => graduateVault(getConfigKey(), safeManagerKey(vault.managerPubkey, isDemoWallet)))} />
            <Action label="Claim fees" onPress={() => run('Claim fees', () => claimFees(getConfigKey()))} />
          </View>
          <Text style={styles.hint}>Mainnet Jupiter execution must use quote-provided route accounts. Devnet uses guard-only validation.</Text>
        </View>
      </ScrollView>
    </>
  );
}

function safeManagerKey(value: string, demo: boolean): PublicKey {
  try { return new PublicKey(value); }
  catch {
    if (demo) return new PublicKey('11111111111111111111111111111111');
    throw new Error('Manager address is not a valid Solana public key');
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function CheckRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkDot, done && styles.checkDotDone]}>
        <Text style={[styles.checkDotText, done && styles.checkDotTextDone]}>{done ? 'OK' : '--'}</Text>
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.actionBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <LinearGradient colors={[colors.surfaceHigh, colors.surfaceElevated]} style={styles.actionGrad}>
        <Text style={styles.actionText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, gap: 14, paddingBottom: 48 },
  hero: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  heroStrip: { backgroundColor: colors.signalDim, borderRadius: radius.lg, padding: 12, gap: 4, marginTop: 2 },
  heroStripLabel: { color: colors.signalDeep, fontSize: 9, fontWeight: '800', fontFamily: 'Courier', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroStripValue: { color: colors.text, fontSize: 12, fontFamily: 'Courier', fontWeight: '700' },
  grid: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  metricLabel: { color: colors.textQuiet, fontSize: 9, fontWeight: '700', fontFamily: 'Courier', letterSpacing: 0.7 },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: 'Courier', marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 12 },
  section: { color: colors.textMuted, fontSize: 10, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 1 },
  input: { height: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.md, color: colors.text, fontSize: 20, fontFamily: 'Courier', fontWeight: '700' },
  limitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  limitValue: { color: colors.signalDeep, fontSize: 14, fontFamily: 'Courier', fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  checkDotDone: { backgroundColor: colors.signal, borderColor: colors.signal },
  checkDotText: { color: colors.textQuiet, fontSize: 8, fontWeight: '800', fontFamily: 'Courier' },
  checkDotTextDone: { color: colors.white },
  checkLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actionGrid: { gap: 8 },
  actionBtn: { borderRadius: radius.full, overflow: 'hidden' },
  actionGrad: { paddingVertical: 13, alignItems: 'center' },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.textQuiet, fontSize: 11, lineHeight: 17 },
});
