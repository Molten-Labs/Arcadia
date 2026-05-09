import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PublicKey } from '@solana/web3.js';
import { colors, radius, spacing } from '../src/lib/theme';
import { useWallet } from '../src/lib/wallet';
import { useVaults } from '../src/hooks/useVaults';
import { useArcadiaTransactions } from '../src/hooks/useTransactions';
import { parseUsdcToUnits } from '../src/lib/amounts';
import { TxModal, TxState } from '../src/components/TxModal';
import { formatUSD } from '../src/lib/format';
import { PrivateIntentPanel } from '../src/components/PrivateIntentPanel';
import { useSubmitPrivateIntent } from '../src/hooks/usePrivateIntents';

export default function TradeScreen() {
  const { connected, connect, role, setRole, isDemoWallet, cluster } = useWallet();
  const { data: vaults } = useVaults();
  const { executeGuardedSwap } = useArcadiaTransactions();
  const privateIntent = useSubmitPrivateIntent();
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const [direction, setDirection] = useState<'USDC_TO_WSOL' | 'WSOL_TO_USDC'>('USDC_TO_WSOL');
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  const managedVaults = (vaults ?? []).filter(v => v.status === 'active' || v.status === 'paper');
  const selected = managedVaults.find(v => v.configPubkey === vaultId) ?? managedVaults[0];
  const amountUnits = parseUsdcToUnits(amount);

  function safeConfigKey(): PublicKey {
    try { return new PublicKey(selected.configPubkey); }
    catch {
      if (isDemoWallet) return new PublicKey('11111111111111111111111111111111');
      throw new Error('Vault address is not a valid Solana public key');
    }
  }

  async function submit() {
    if (!selected) { Alert.alert('No vault selected'); return; }
    if (!connected) {
      try {
        await connect();
      } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
      return;
    }
    if (role !== 'trader') { setRole('trader'); Alert.alert('Trader mode enabled', 'Submit again to continue.'); return; }
    if (!amountUnits || amountUnits <= 0n) { Alert.alert('Invalid amount'); return; }
    if (cluster === 'mainnet-beta') {
      Alert.alert('Jupiter quote required', 'Mainnet swaps must be submitted with Jupiter quote accounts. This mobile terminal currently supports devnet guard-only validation.');
      return;
    }
    try {
      setTxState({ type: 'building' });
      setTxState({ type: 'signing' });
      const result = await executeGuardedSwap(safeConfigKey(), amountUnits, 0n);
      setTxState({ type: 'confirming' });
      setTimeout(() => setTxState({ type: 'success', sig: result.sig, demo: result.demo }), 350);
    } catch (err: any) {
      setTxState({ type: 'error', message: err?.message ?? 'Swap failed' });
    }
  }

  async function sealPrivateIntent() {
    if (!selected) { Alert.alert('No vault selected'); return; }
    if (!amountUnits || amountUnits <= 0n) { Alert.alert('Invalid amount'); return; }
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
      await privateIntent.mutateAsync({
        vaultConfigPubkey: selected.configPubkey,
        managerPubkey: selected.managerPubkey,
        amountUsdc: Number(amountUnits) / 1_000_000,
        side: direction,
        maxSlippageBps: selected.maxSlippageBps,
        clientRequestId: `mobile-terminal-${Date.now()}`,
        demoFallback: isDemoWallet,
      });
      Alert.alert('Private intent sealed', 'The route and exact amount are redacted while the vault guard proof updates.');
    } catch (err: any) {
      Alert.alert('Private intent unavailable', err?.message ?? 'Unable to seal private intent');
    }
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label="Guarded Swap" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>TRADER TERMINAL</Text>
        <Text style={styles.title}>USDC ↔ WSOL</Text>
        <Text style={styles.copy}>Devnet runs Arcadia guard validation. Mainnet requires Jupiter route accounts before execution.</Text>

        <View style={styles.card}>
          <Text style={styles.section}>Vault</Text>
          {managedVaults.map(v => (
            <Pressable key={v.id} style={[styles.vaultRow, selected?.id === v.id && styles.vaultRowActive]} onPress={() => setVaultId(v.configPubkey)}>
              <Text style={styles.vaultName}>{v.name}</Text>
              <Text style={styles.vaultMeta}>{formatUSD(v.tvl, true)} TVL</Text>
            </Pressable>
          ))}
        </View>

        <PrivateIntentPanel
          vaultConfigPubkey={selected?.configPubkey}
          mode="terminal"
          onSubmit={sealPrivateIntent}
          submitLabel="Seal Intent First"
          submitDisabled={!selected || !amountUnits || amountUnits <= 0n}
          submitting={privateIntent.isPending}
        />

        <View style={styles.card}>
          <Text style={styles.section}>Route</Text>
          <View style={styles.routeRow}>
            {(['USDC_TO_WSOL', 'WSOL_TO_USDC'] as const).map(route => (
              <Pressable key={route} style={[styles.routeBtn, direction === route && styles.routeActive]} onPress={() => setDirection(route)}>
                <Text style={[styles.routeText, direction === route && { color: colors.signal }]}>
                  {route === 'USDC_TO_WSOL' ? 'USDC → WSOL' : 'WSOL → USDC'}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textQuiet}
            keyboardType="decimal-pad"
          />
          <Pressable style={styles.submit} onPress={submit}>
            <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.submitGrad}>
              <Text style={styles.submitText}>{connected ? 'Run Guarded Swap' : 'Connect Wallet'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: 14, paddingBottom: 48 },
  eyebrow: { color: colors.signal, fontFamily: 'Courier', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 12 },
  section: { color: colors.textMuted, fontSize: 10, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 1 },
  vaultRow: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, backgroundColor: colors.surfaceElevated },
  vaultRowActive: { borderColor: colors.signal, backgroundColor: colors.signalDim },
  vaultName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  vaultMeta: { color: colors.textQuiet, fontFamily: 'Courier', fontSize: 10, marginTop: 3 },
  routeRow: { flexDirection: 'row', gap: 8 },
  routeBtn: { flex: 1, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: 'center' },
  routeActive: { borderColor: colors.signal, backgroundColor: colors.signalDim },
  routeText: { color: colors.textMuted, fontFamily: 'Courier', fontSize: 11, fontWeight: '700' },
  input: { height: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.md, color: colors.text, fontSize: 20, fontFamily: 'Courier', fontWeight: '700' },
  submit: { borderRadius: radius.full, overflow: 'hidden' },
  submitGrad: { paddingVertical: 16, alignItems: 'center' },
  submitText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
