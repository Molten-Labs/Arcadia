import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform } from 'react-native';
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
import {
  JUPITER_API_URL,
  PROGRAM_ID,
  PYTH_SOL_USD_ACCOUNT,
  PYTH_USDC_USD_ACCOUNT,
  RPC_URL,
} from '../../src/lib/constants';
import { API_BASE } from '../../src/lib/api';

function SettingRow({ label, right, onPress }: {
  label: string;
  right: React.ReactNode;
  onPress?: () => void;
}) {
  const inner = (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View>{right}</View>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    connected,
    publicKey,
    connect,
    disconnect,
    role,
    setRole,
    isDemoWallet,
    cluster,
    walletLabel,
    pendingRequest,
    isMwaAvailable,
    authToken,
  } = useWallet();
  const { data: balance } = useBalance();
  const { initManager } = useArcadiaTransactions();
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  async function handleConnect() {
    try {
      await connect();
    } catch (err: any) {
      Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
    }
  }

  async function copyAddress() {
    if (!publicKey) return;
    await Clipboard.setStringAsync(publicKey);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Wallet card */}
        <View style={styles.walletCard}>
          <LinearGradient
            colors={connected
              ? ['rgba(163,230,53,0.08)', 'transparent']
              : ['rgba(39,39,42,0.4)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Avatar row */}
          <View style={styles.walletAvatarRow}>
            <LinearGradient
              colors={connected
                ? [colors.signal, colors.signalDeep]
                : [colors.surfaceHigh, colors.surfaceElevated]}
              style={styles.walletAvatar}
            >
              <Text style={[styles.walletAvatarText, { color: connected ? colors.bg : colors.textQuiet }]}>
                {connected && publicKey ? publicKey.slice(0, 2).toUpperCase() : '—'}
              </Text>
            </LinearGradient>

            <View style={styles.walletMeta}>
              <View style={styles.walletStatusRow}>
                <View style={[styles.statusDot, {
                  backgroundColor: connected
                    ? (isDemoWallet ? colors.warning : colors.signal)
                    : colors.textQuiet
                }]} />
                <Text style={styles.walletStatus}>
                  {connected ? (isDemoWallet ? 'Demo Wallet' : 'Connected') : 'Disconnected'}
                </Text>
                {walletLabel && <Text style={styles.walletLabel}>{walletLabel}</Text>}
                {pendingRequest && <Text style={styles.walletLabel}>{pendingRequest}</Text>}
              </View>
              {connected && publicKey && (
                <Pressable onPress={copyAddress}>
                  <Text style={styles.walletAddr}>{truncateAddress(publicKey, 10)} ⧉</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={[styles.walletAction, connected && styles.walletActionDanger]}
              onPress={connected ? disconnect : handleConnect}
            >
              <Text style={[styles.walletActionText, connected && { color: colors.danger }]}>
                {connected ? 'Disconnect' : 'Connect'}
              </Text>
            </Pressable>
          </View>

          {/* Token balances */}
          {connected && balance && (
            <View style={styles.tokenGrid}>
              <View style={styles.tokenCell}>
                <Text style={styles.tokenAmt}>{balance.sol.toFixed(4)}</Text>
                <Text style={styles.tokenTicker}>SOL</Text>
              </View>
              <View style={styles.tokenCellDivider} />
              <View style={styles.tokenCell}>
                <Text style={styles.tokenAmt}>{formatUSD(balance.usdc)}</Text>
                <Text style={styles.tokenTicker}>USDC</Text>
              </View>
            </View>
          )}
        </View>

        {/* Role selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ROLE</Text>
          <View style={styles.roleCard}>
            {(['investor', 'trader'] as Role[]).map(r => {
              const active = role === r;
              return (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, active && styles.roleBtnActive]}
                  onPress={() => { setRole(r); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                >
                  {active && (
                    <LinearGradient
                      colors={[colors.signalDim, 'transparent']}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <Text style={[styles.roleIcon, active && { color: colors.signal }]}>
                    {r === 'investor' ? '◈' : '◎'}
                  </Text>
                  <Text style={[styles.roleLabel, active && { color: colors.signal }]}>
                    {r === 'investor' ? 'Investor' : 'Trader'}
                  </Text>
                  <Text style={styles.roleDesc}>
                    {r === 'investor' ? 'Deposit senior capital' : 'Manage vaults'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Trader actions */}
        {role === 'trader' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MANAGER</Text>
            <View style={styles.card}>
              <Pressable style={styles.actionRow} onPress={handleInitManager}>
                <View style={styles.actionIcon}>
                  <Text style={{ fontSize: 18, color: colors.signal }}>◎</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionLabel}>Initialize Manager Profile</Text>
                  <Text style={styles.actionSub}>One-time on-chain account creation</Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.textQuiet }}>→</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Network */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NETWORK</Text>
          <View style={styles.card}>
            <SettingRow
              label="MWA available"
              right={<Text style={styles.monoText}>{isMwaAvailable ? 'Android yes' : 'Read-only platform'}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="RPC Endpoint"
              right={
                <Text style={styles.monoText}>
                  {shortUrl(RPC_URL)}
                </Text>
              }
            />
            <View style={styles.divider} />
            <SettingRow
              label="Cluster"
              right={
                <View style={[styles.clusterChip, {
                  borderColor: cluster === 'devnet' ? colors.warning + '50' : colors.signal + '50',
                  backgroundColor: cluster === 'devnet' ? colors.warningDim : colors.signalDim,
                }]}>
                  <Text style={[styles.clusterText, { color: cluster === 'devnet' ? colors.warning : colors.signal }]}>
                    {cluster === 'devnet' ? 'DEVNET' : 'MAINNET'}
                  </Text>
                </View>
              }
            />
            <View style={styles.divider} />
            <SettingRow
              label="Auth token"
              right={<Text style={styles.monoText}>{authToken ? 'Stored' : 'None'}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="API"
              right={<Text style={styles.monoText}>{API_BASE ? shortUrl(API_BASE) : 'Mock fallback'}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Pyth feeds"
              right={<Text style={styles.monoText}>{PYTH_SOL_USD_ACCOUNT && PYTH_USDC_USD_ACCOUNT ? 'Configured' : 'Missing'}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Jupiter"
              right={<Text style={styles.monoText}>{shortUrl(JUPITER_API_URL)}</Text>}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <SettingRow label="Version" right={<Text style={styles.monoText}>1.0.0</Text>} />
            <View style={styles.divider} />
            <SettingRow label="Program" right={<Text style={styles.monoText}>{truncateAddress(PROGRAM_ID.toBase58(), 5)}</Text>} />
            <View style={styles.divider} />
            <SettingRow label="Protocol" right={<Text style={styles.monoText}>Arcadia</Text>} />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>◈ ARCADIA</Text>
          <Text style={styles.footerSub}>Non-custodial · Proof-gated · On-chain</Text>
        </View>
      </ScrollView>
    </>
  );
}

function shortUrl(value: string): string {
  return value
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .slice(0, 28);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.md, gap: 20, paddingBottom: 60 },
  pageTitle: { fontSize: 28, fontWeight: '600', color: colors.text, letterSpacing: -0.6, marginBottom: 4 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Courier',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  section: { gap: 0 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  walletCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.md,
    gap: 16,
  },
  walletAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletAvatarText: { fontSize: 18, fontWeight: '700', fontFamily: 'Courier' },
  walletMeta: { flex: 1, gap: 3 },
  walletStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  walletStatus: { fontSize: 14, fontWeight: '600', color: colors.text },
  walletLabel: { fontSize: 10, color: colors.textQuiet, fontFamily: 'Courier' },
  walletAddr: { fontSize: 11, color: colors.signal, fontFamily: 'Courier' },
  walletAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '40',
  },
  walletActionDanger: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger + '40',
  },
  walletActionText: { fontSize: 12, fontWeight: '700', color: colors.signal },
  tokenGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tokenCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  tokenCellDivider: { width: 1, backgroundColor: colors.border },
  tokenAmt: { fontSize: 18, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
  tokenTicker: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Courier' },

  roleCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  roleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 5,
    overflow: 'hidden',
  },
  roleBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.signal },
  roleIcon: { fontSize: 20, color: colors.textQuiet },
  roleLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  roleDesc: { fontSize: 10, color: colors.textQuiet, textAlign: 'center', fontFamily: 'Courier' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  actionSub: { fontSize: 11, color: colors.textQuiet, marginTop: 1, fontFamily: 'Courier' },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  monoText: { fontSize: 11, color: colors.textMuted, fontFamily: 'Courier' },
  clusterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  clusterText: { fontSize: 9, fontWeight: '700', letterSpacing: 1, fontFamily: 'Courier' },

  footer: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8 },
  footerLogo: { fontSize: 14, fontWeight: '700', color: colors.textQuiet, letterSpacing: 3, fontFamily: 'Courier' },
  footerSub: { fontSize: 10, color: colors.textQuiet, textAlign: 'center', fontFamily: 'Courier' },
});
