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
import { TxModal, TxState, txFailureState } from '../../src/components/TxModal';
import { startGuidedMobileDemo } from '../../src/components/GuidedDemoOverlay';
import {
  JUPITER_API_URL,
  PROGRAM_ID,
  PYTH_SOL_USD_ACCOUNT,
  PYTH_USDC_USD_ACCOUNT,
  RPC_URL,
} from '../../src/lib/constants';
import { API_BASE } from '../../src/lib/api';

function SettingRow({ label, right, onPress, icon }: {
  label: string;
  right: React.ReactNode;
  onPress?: () => void;
  icon?: string;
}) {
  const inner = (
    <View style={styles.row}>
      {icon && (
        <View style={styles.rowIcon}>
          <Text style={{ fontSize: 15 }}>{icon}</Text>
        </View>
      )}
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );
  if (onPress) return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {inner}
    </Pressable>
  );
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
    try { await connect(); } catch (err: any) {
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
      setTxState(txFailureState(err, 'Failed'));
    }
  }

  function handleDemo() {
    setRole('trader');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startGuidedMobileDemo();
  }

  const isConnected = connected;

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
            colors={isConnected
              ? ['rgba(0,217,140,0.08)', 'transparent']
              : ['rgba(9,21,36,0.4)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.walletHeader}>
            <View style={[styles.walletAvatar, isConnected && styles.walletAvatarConnected]}>
              {isConnected ? (
                <Text style={styles.walletAvatarText}>
                  {publicKey?.slice(0, 2).toUpperCase() ?? '—'}
                </Text>
              ) : (
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border }} />
              )}
            </View>

            <View style={styles.walletInfo}>
              <View style={styles.walletStatusRow}>
                <View style={[styles.statusDot, {
                  backgroundColor: isConnected
                    ? (isDemoWallet ? colors.warning : colors.signal)
                    : colors.textQuiet,
                }]} />
                <Text style={styles.walletStatus}>
                  {isConnected ? (isDemoWallet ? 'Demo Wallet' : 'Connected') : 'Not connected'}
                </Text>
                {walletLabel && (
                  <Text style={styles.walletLabelText}>· {walletLabel}</Text>
                )}
              </View>
              {isConnected && publicKey && (
                <Pressable onPress={copyAddress} style={styles.addrRow}>
                  <Text style={styles.walletAddr}>{truncateAddress(publicKey, 10)}</Text>
                  <Text style={{ fontSize: 11, color: colors.signal }}>⧉</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={[styles.walletAction, isConnected && styles.walletActionDisconnect]}
              onPress={isConnected ? disconnect : handleConnect}
            >
              <Text style={[styles.walletActionText, isConnected && { color: colors.danger }]}>
                {isConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </Pressable>
          </View>

          {isConnected && balance && (
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

        {/* Demo card */}
        <View style={styles.demoCard}>
          <LinearGradient
            colors={['rgba(0,217,140,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.demoHeader}>
            <View style={styles.demoIconWrap}>
              <Text style={{ fontSize: 22 }}>▶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoTitle}>Guided Demo</Text>
              <Text style={styles.demoCopy}>Experience the full first-loss vault lifecycle</Text>
            </View>
          </View>
          <Pressable style={styles.demoButton} onPress={handleDemo}>
            <Text style={styles.demoButtonText}>Start lifecycle demo</Text>
            <Text style={{ fontSize: 14, color: colors.white }}>→</Text>
          </Pressable>
        </View>

        {/* Role */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Role</Text>
          <View style={styles.roleCard}>
            {(['investor', 'trader'] as Role[]).map(r => {
              const active = role === r;
              return (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, active && styles.roleBtnActive]}
                  onPress={() => {
                    setRole(r);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  {active && (
                    <LinearGradient
                      colors={[colors.signalDim, 'transparent']}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
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

        {/* Manager actions */}
        {role === 'trader' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Manager</Text>
            <View style={styles.card}>
              <SettingRow
                label="Initialize Manager Profile"
                right={<Text style={{ fontSize: 14, color: colors.textQuiet }}>›</Text>}
                onPress={handleInitManager}
              />
            </View>
          </View>
        )}

        {/* Network */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Network</Text>
          <View style={styles.card}>
            <SettingRow
              label="MWA"
              right={<Text style={styles.monoText}>{isMwaAvailable ? 'Available' : 'Web only'}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="RPC"
              right={<Text style={styles.monoText}>{shortUrl(RPC_URL)}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Cluster"
              right={
                <View style={[styles.clusterChip, {
                  borderColor: cluster === 'devnet' ? colors.warningBorder : colors.signalBorder,
                  backgroundColor: cluster === 'devnet' ? colors.warningDim : colors.signalDim,
                }]}>
                  <Text style={[styles.clusterText, {
                    color: cluster === 'devnet' ? colors.warning : colors.signal,
                  }]}>
                    {cluster === 'devnet' ? 'Devnet' : 'Mainnet'}
                  </Text>
                </View>
              }
            />
            <View style={styles.divider} />
            <SettingRow
              label="API"
              right={<Text style={styles.monoText}>{API_BASE ? shortUrl(API_BASE) : 'Mock mode'}</Text>}
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
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <SettingRow
              label="Version"
              right={<Text style={styles.monoText}>1.0.0</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Program"
              right={<Text style={styles.monoText}>{truncateAddress(PROGRAM_ID.toBase58(), 5)}</Text>}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Protocol"
              right={<Text style={styles.monoText}>Arcadia</Text>}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>Arcadia Protocol</Text>
          <Text style={styles.footerSub}>Non-custodial · Proof-gated · On-chain</Text>
        </View>
      </ScrollView>
    </>
  );
}

function shortUrl(value: string): string {
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 26);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.md, gap: 16, paddingBottom: 60 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
    marginBottom: 4,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
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
  walletHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletAvatarConnected: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signalBorder,
  },
  walletAvatarText: { fontSize: 16, fontWeight: '700', color: colors.signal, fontFamily: 'Courier' },
  walletInfo: { flex: 1, gap: 4 },
  walletStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  walletStatus: { fontSize: 14, fontWeight: '600', color: colors.text },
  walletLabelText: { fontSize: 11, color: colors.textQuiet },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  walletAddr: { fontSize: 11, color: colors.signal, fontFamily: 'Courier' },
  walletAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signalBorder,
  },
  walletActionDisconnect: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.dangerBorder,
  },
  walletActionText: { fontSize: 12, fontWeight: '700', color: colors.signal },

  tokenGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tokenCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  tokenCellDivider: { width: 1, backgroundColor: colors.border },
  tokenAmt: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  tokenTicker: { fontSize: 9, color: colors.textQuiet, textTransform: 'uppercase', letterSpacing: 0.6 },

  demoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    padding: spacing.md,
    gap: 14,
    overflow: 'hidden',
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  demoCopy: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.signal,
  },
  demoButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },

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
  roleLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  roleDesc: { fontSize: 10, color: colors.textQuiet, textAlign: 'center', lineHeight: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 10,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  rowRight: {},
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  monoText: { fontSize: 11, color: colors.textMuted, fontFamily: 'Courier' },
  clusterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  clusterText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  footer: { alignItems: 'center', gap: 5, paddingTop: 8, paddingBottom: 12 },
  footerLogo: { fontSize: 13, fontWeight: '700', color: colors.textQuiet, letterSpacing: 0.5 },
  footerSub: { fontSize: 10, color: colors.textDim, textAlign: 'center' },
});
