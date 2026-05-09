import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '../../src/lib/theme';
import { useWallet } from '../../src/lib/wallet';
import { useVaults } from '../../src/hooks/useVaults';
import { useArcadiaTransactions } from '../../src/hooks/useTransactions';
import { TxModal, TxState, txFailureState } from '../../src/components/TxModal';

export default function CreateVaultScreen() {
  const router = useRouter();
  const { connected, connect, role, setRole, publicKey } = useWallet();
  const { data: vaults } = useVaults();
  const { createVault } = useArcadiaTransactions();
  const [name, setName] = useState('Arcadia Mobile Vault');
  const [fee, setFee] = useState('20');
  const [slippage, setSlippage] = useState('1');
  const [minTrades, setMinTrades] = useState('10');
  const [paperDays, setPaperDays] = useState('14');
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  const vaultIndex = (vaults ?? []).filter(v => v.managerPubkey === publicKey).length;

  async function submit() {
    if (!connected) {
      try {
        await connect();
      } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
      return;
    }
    if (role !== 'trader') { setRole('trader'); Alert.alert('Trader mode enabled', 'Review the vault details and submit again.'); return; }
    const feePct = Number(fee);
    const slippagePct = Number(slippage);
    const trades = Number(minTrades);
    const days = Number(paperDays);
    if (!name.trim() || feePct < 0 || feePct > 50 || slippagePct <= 0 || trades <= 0 || days <= 0) {
      Alert.alert('Invalid vault settings', 'Check name, fee, slippage, paper window, and trade count.');
      return;
    }

    try {
      setTxState({ type: 'building' });
      setTxState({ type: 'signing' });
      const result = await createVault({
        name: name.trim(),
        feeBps: Math.round(feePct * 100),
        maxSlippageBps: Math.round(slippagePct * 100),
        minQualifyingTrades: trades,
        paperWindowSecs: days * 24 * 60 * 60,
        vaultIndex,
      });
      setTxState({ type: 'confirming' });
      setTimeout(() => {
        setTxState({ type: 'success', sig: result.sig, demo: result.demo });
        router.replace('/(tabs)/manager');
      }, 450);
    } catch (err: any) {
      setTxState(txFailureState(err, 'Create vault failed'));
    }
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label="Create Vault" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>PAPER MODE SETUP</Text>
        <Text style={styles.title}>Launch Vault</Text>
        <Text style={styles.copy}>Create a trader-controlled vault. Investor deposits open only after graduation checks pass.</Text>

        <Field label="Vault name" value={name} onChangeText={setName} />
        <View style={styles.row}>
          <Field label="Fee %" value={fee} onChangeText={setFee} keyboardType="decimal-pad" half />
          <Field label="Max slippage %" value={slippage} onChangeText={setSlippage} keyboardType="decimal-pad" half />
        </View>
        <View style={styles.row}>
          <Field label="Min trades" value={minTrades} onChangeText={setMinTrades} keyboardType="number-pad" half />
          <Field label="Paper days" value={paperDays} onChangeText={setPaperDays} keyboardType="number-pad" half />
        </View>

        <View style={styles.checkCard}>
          <Text style={styles.checkTitle}>Creation rules</Text>
          <Text style={styles.checkLine}>• Vault starts in paper mode</Text>
          <Text style={styles.checkLine}>• Junior capital is deposited after creation</Text>
          <Text style={styles.checkLine}>• Graduation requires positive paper performance</Text>
        </View>

        <Pressable style={styles.submit} onPress={submit}>
          <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.submitGrad}>
            <Text style={styles.submitText}>{connected ? 'Create Vault' : 'Connect Wallet'}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  half?: boolean;
}) {
  return (
    <View style={[styles.field, props.half && { flex: 1 }]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        placeholderTextColor={colors.textQuiet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: 14, paddingBottom: 48 },
  eyebrow: { color: colors.signal, fontFamily: 'Courier', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12 },
  field: { gap: 7 },
  label: { color: colors.textMuted, fontFamily: 'Courier', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  input: {
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  checkCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 7 },
  checkTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  checkLine: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  submit: { borderRadius: radius.full, overflow: 'hidden', marginTop: 4 },
  submitGrad: { paddingVertical: 16, alignItems: 'center' },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
