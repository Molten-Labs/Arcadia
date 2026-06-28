import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '../../src/lib/theme';
import { useWallet } from '../../src/lib/wallet';
import { useVaults } from '../../src/hooks/useVaults';
import { useArcadiaTransactions } from '../../src/hooks/useTransactions';
import { TxModal, TxState } from '../../src/components/TxModal';
import { StatusBadge } from '../../src/components/StatusBadge';
import { formatUSD, truncateAddress } from '../../src/lib/format';

export default function ManagerScreen() {
  const router = useRouter();
  const { connected, connect, publicKey, role, setRole, isDemoWallet } = useWallet();
  const { data: vaults, isLoading } = useVaults();
  const { initManager } = useArcadiaTransactions();
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  const managerVaults = (vaults ?? []).filter(v =>
    publicKey ? v.managerPubkey === publicKey || isDemoWallet : isDemoWallet,
  );
  const totalJunior = managerVaults.reduce((sum, v) => sum + v.juniorCapital, 0);
  const activeCount = managerVaults.filter(v => v.status === 'active').length;

  async function runInitManager() {
    if (!connected) {
      try {
        await connect();
      } catch (err: any) {
        Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
      }
      return;
    }
    setRole('trader');
    try {
      setTxState({ type: 'building' });
      setTxState({ type: 'signing' });
      const result = await initManager();
      setTxState({ type: 'confirming' });
      setTimeout(() => setTxState({ type: 'success', sig: result.sig, demo: result.demo }), 350);
    } catch (err: any) {
      setTxState({ type: 'error', message: err?.message ?? 'Failed to initialize manager' });
    }
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label="Init Manager" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRADER CONSOLE</Text>
          <Text style={styles.title}>Manager</Text>
          <Text style={styles.subtitle}>Create vaults, post junior capital, graduate paper records, and run guarded USDC ↔ WSOL operations.</Text>
        </View>

        {!connected ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => connect().catch((err: any) => Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet'))}
          >
            <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
              <Text style={styles.primaryText}>Connect Wallet</Text>
            </LinearGradient>
          </Pressable>
        ) : role !== 'trader' ? (
          <Pressable style={styles.primaryBtn} onPress={() => setRole('trader')}>
            <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
              <Text style={styles.primaryText}>Switch to Trader Mode</Text>
            </LinearGradient>
          </Pressable>
        ) : null}

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>VAULTS</Text>
            <Text style={styles.statValue}>{managerVaults.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>ACTIVE</Text>
            <Text style={styles.statValue}>{activeCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>JUNIOR</Text>
            <Text style={styles.statValue}>{formatUSD(totalJunior, true)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={runInitManager}>
            <Text style={styles.actionTitle}>Initialize manager profile</Text>
            <Text style={styles.actionSub}>One-time account setup</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => router.push('/manager/create')}>
            <Text style={styles.actionTitle}>Launch vault</Text>
            <Text style={styles.actionSub}>Create paper-mode vault</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => router.push('/trade')}>
            <Text style={styles.actionTitle}>Trade terminal</Text>
            <Text style={styles.actionSub}>USDC ↔ WSOL guarded swap</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>MANAGED VAULTS</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.signal} />
        ) : managerVaults.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No manager vaults yet</Text>
            <Text style={styles.emptySub}>Launch a vault to begin building verified performance.</Text>
          </View>
        ) : managerVaults.map(vault => (
          <Pressable key={vault.id} style={styles.vaultCard} onPress={() => router.push(`/manager/vault/${vault.configPubkey}`)}>
            <View style={styles.vaultTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vaultName}>{vault.name}</Text>
                <Text style={styles.vaultMeta}>Manager · {truncateAddress(vault.managerPubkey, 5)}</Text>
              </View>
              <StatusBadge status={vault.status} size="sm" />
            </View>
            <View style={styles.vaultStats}>
              <Text style={styles.vaultStat}>NAV {vault.currentNav.toFixed(4)}</Text>
              <Text style={styles.vaultStat}>Junior {formatUSD(vault.juniorCapital, true)}</Text>
              <Text style={styles.vaultStat}>Health {(vault.juniorHealth * 100).toFixed(0)}%</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: 16, paddingBottom: 48 },
  header: { gap: 6 },
  eyebrow: { fontSize: 10, color: colors.signal, fontWeight: '700', letterSpacing: 1, fontFamily: 'Courier' },
  title: { fontSize: 30, color: colors.text, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  primaryBtn: { borderRadius: radius.full, overflow: 'hidden' },
  primaryGrad: { paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 14 },
  statLabel: { color: colors.textQuiet, fontFamily: 'Courier', fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  statValue: { color: colors.text, fontFamily: 'Courier', fontSize: 18, fontWeight: '700', marginTop: 4 },
  actions: { gap: 10 },
  action: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actionSub: { color: colors.textQuiet, fontSize: 11, fontFamily: 'Courier', marginTop: 3 },
  sectionLabel: { color: colors.textMuted, fontSize: 10, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 1 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: colors.textQuiet, fontSize: 12, textAlign: 'center', marginTop: 6 },
  vaultCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 12 },
  vaultTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  vaultName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  vaultMeta: { color: colors.textQuiet, fontSize: 11, fontFamily: 'Courier', marginTop: 3 },
  vaultStats: { flexDirection: 'row', justifyContent: 'space-between' },
  vaultStat: { color: colors.textMuted, fontSize: 10, fontFamily: 'Courier' },
});
