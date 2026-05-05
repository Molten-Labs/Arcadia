import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useWallet, Role } from '../../src/lib/wallet';
import { useBalance } from '../../src/hooks/useBalance';
import { useArcadiaTransactions } from '../../src/hooks/useTransactions';
import { truncateAddress, formatUSD } from '../../src/lib/format';
import { TxModal, TxState } from '../../src/components/TxModal';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View>{children}</View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { connected, publicKey, connect, disconnect, role, setRole, isDemoWallet } = useWallet();
  const { data: balance } = useBalance();
  const { initManager } = useArcadiaTransactions();
  const [devnet, setDevnet] = useState(true);
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  async function copyAddress() {
    if (!publicKey) return;
    await Clipboard.setStringAsync(publicKey);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Address copied to clipboard');
  }

  async function handleInitManager() {
    try {
      setTxState({ type: 'building' });
      setTxState({ type: 'signing' });
      const result = await initManager();
      setTxState({ type: 'success', sig: result.sig, demo: result.demo });
    } catch (err: any) {
      setTxState({ type: 'error', message: err?.message ?? 'Failed' });
    }
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label="Init Manager" />

      <ScrollView style={styles.screen} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Settings</Text>

        {/* Wallet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WALLET</Text>
          <View style={styles.card}>
            <View style={styles.walletBlock}>
              <LinearGradient
                colors={connected ? [colors.signalDeep, colors.signal + '88'] : [colors.surfaceHigh, colors.surface]}
                style={styles.walletAvatar}
              >
                <Text style={styles.walletAvatarText}>
                  {connected ? (publicKey?.slice(0, 2) ?? '??') : '—'}
                </Text>
              </LinearGradient>
              <View style={styles.walletInfo}>
                <View style={styles.walletStatusRow}>
                  <View style={[styles.dot, { backgroundColor: connected ? colors.signal : colors.textQuiet }]} />
                  <Text style={styles.walletStatus}>{connected ? 'Connected' : 'Disconnected'}</Text>
                  {isDemoWallet && (
                    <View style={styles.demoPill}>
                      <Text style={styles.demoPillText}>DEMO</Text>
                    </View>
                  )}
                </View>
                {connected && publicKey && (
                  <Pressable onPress={copyAddress}>
                    <Text style={styles.walletAddr}>{truncateAddress(publicKey, 8)} ⧉</Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                style={[styles.walletBtn, connected && styles.walletBtnDanger]}
                onPress={connected ? disconnect : connect}
              >
                <Text style={[styles.walletBtnText, connected && styles.walletBtnTextDanger]}>
                  {connected ? 'Disconnect' : 'Connect'}
                </Text>
              </Pressable>
            </View>

            {connected && balance && (
              <>
                <Divider />
                <View style={styles.balanceRow}>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceLabel}>SOL</Text>
                    <Text style={styles.balanceValue}>{balance.sol.toFixed(4)}</Text>
                  </View>
                  <View style={styles.balanceDivider} />
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceLabel}>USDC</Text>
                    <Text style={styles.balanceValue}>{formatUSD(balance.usdc)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Role */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROLE</Text>
          <View style={styles.card}>
            <View style={styles.roleRow}>
              {(['investor', 'trader'] as Role[]).map(r => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => { setRole(r); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.roleBtnIcon, role === r && { color: colors.signal }]}>
                    {r === 'investor' ? '◈' : '◎'}
                  </Text>
                  <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                    {r === 'investor' ? 'Investor' : 'Trader'}
                  </Text>
                  {role === r && <View style={styles.roleCheck} />}
                </Pressable>
              ))}
            </View>
            <Text style={styles.roleHint}>
              {role === 'investor'
                ? 'Deposit senior capital into graduated vaults and earn yield with first-loss protection from the manager\'s junior stake.'
                : 'Create and manage vaults, run qualifying paper trades, graduate to accept senior capital, and earn performance fees.'}
            </Text>
          </View>
        </View>

        {/* Trader actions */}
        {role === 'trader' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MANAGER ACTIONS</Text>
            <View style={styles.card}>
              <Pressable
                style={styles.actionRow}
                onPress={handleInitManager}
              >
                <View>
                  <Text style={styles.actionLabel}>Initialize Manager Profile</Text>
                  <Text style={styles.actionSub}>One-time on-chain setup for new managers</Text>
                </View>
                <Text style={styles.actionChevron}>→</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Network */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NETWORK</Text>
          <View style={styles.card}>
            <Row label="Devnet">
              <Switch
                value={devnet}
                onValueChange={setDevnet}
                trackColor={{ false: colors.border, true: colors.signalDeep }}
                thumbColor={devnet ? colors.signal : colors.textQuiet}
              />
            </Row>
            <Divider />
            <Row label="RPC">
              <Text style={styles.monoText} numberOfLines={1}>
                {devnet ? 'api.devnet.solana.com' : 'api.mainnet.solana.com'}
              </Text>
            </Row>
            <Divider />
            <Row label="Cluster">
              <View style={[styles.clusterBadge, { borderColor: devnet ? colors.warning + '66' : colors.signal + '66' }]}>
                <Text style={[styles.clusterText, { color: devnet ? colors.warning : colors.signal }]}>
                  {devnet ? 'DEVNET' : 'MAINNET'}
                </Text>
              </View>
            </Row>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.card}>
            <Row label="Version"><Text style={styles.monoText}>1.0.0</Text></Row>
            <Divider />
            <Row label="Program">
              <Text style={styles.monoText} numberOfLines={1}>WMzh…w6RB</Text>
            </Row>
            <Divider />
            <Row label="Protocol">
              <Text style={styles.monoText}>Arcadia</Text>
            </Row>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLogo}>◈ ARCADIA</Text>
          <Text style={styles.footerSub}>Proof-gated capital · Non-custodial · On-chain</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.md, gap: 0, paddingBottom: 60 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 20 },
  section: { gap: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  monoText: { fontSize: 12, color: colors.textMuted, fontFamily: 'Courier' },
  clusterBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  clusterText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  walletBlock: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  walletAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  walletAvatarText: { fontSize: 16, fontWeight: '700', color: colors.bg, fontFamily: 'Courier' },
  walletInfo: { flex: 1, gap: 3 },
  walletStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  walletStatus: { fontSize: 13, fontWeight: '600', color: colors.text },
  demoPill: { backgroundColor: colors.warningDim, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.warning + '44' },
  demoPillText: { fontSize: 9, fontWeight: '700', color: colors.warning, letterSpacing: 0.5 },
  walletAddr: { fontSize: 11, color: colors.signal, fontFamily: 'Courier' },
  walletBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.signalDim, borderWidth: 1, borderColor: colors.signal + '55' },
  walletBtnDanger: { backgroundColor: colors.dangerDim, borderColor: colors.danger + '55' },
  walletBtnText: { fontSize: 13, fontWeight: '600', color: colors.signal },
  walletBtnTextDanger: { color: colors.danger },
  balanceRow: { flexDirection: 'row', paddingVertical: 14 },
  balanceItem: { flex: 1, alignItems: 'center', gap: 3 },
  balanceDivider: { width: 1, backgroundColor: colors.border },
  balanceLabel: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  balanceValue: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  roleRow: { flexDirection: 'row' },
  roleBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  roleBtnActive: { borderBottomColor: colors.signal, backgroundColor: colors.signalDim },
  roleBtnIcon: { fontSize: 18, color: colors.textQuiet },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  roleBtnTextActive: { color: colors.signal },
  roleCheck: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.signal },
  roleHint: { fontSize: 12, color: colors.textQuiet, padding: spacing.md, paddingTop: 8, lineHeight: 19 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  actionLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  actionSub: { fontSize: 12, color: colors.textQuiet, marginTop: 2 },
  actionChevron: { fontSize: 18, color: colors.signal },
  footer: { alignItems: 'center', gap: 5, paddingTop: 8 },
  footerLogo: { fontSize: 16, fontWeight: '800', color: colors.textMuted, letterSpacing: 3, fontFamily: 'Courier' },
  footerSub: { fontSize: 11, color: colors.textQuiet, textAlign: 'center' },
});
