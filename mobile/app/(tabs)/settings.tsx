import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useWallet, Role } from '../../src/lib/wallet';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { truncateAddress } from '../../src/lib/format';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { connected, publicKey, connect, disconnect, role, setRole } = useWallet();
  const [devnet, setDevnet] = useState(true);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Section title="Wallet">
          <View style={styles.walletBlock}>
            <View style={[styles.walletDot, { backgroundColor: connected ? colors.signal : colors.textQuiet }]} />
            <View style={styles.walletInfo}>
              <Text style={styles.walletStatus}>{connected ? 'Connected' : 'Not connected'}</Text>
              {connected && publicKey ? (
                <Text style={styles.walletAddr}>{truncateAddress(publicKey, 8)}</Text>
              ) : (
                <Text style={styles.walletHint}>Connect to sign transactions</Text>
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
        </Section>

        <Section title="Role">
          <View style={styles.roleRow}>
            {(['investor', 'trader'] as Role[]).map(r => (
              <Pressable
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r === 'investor' ? '◈ Investor' : '◎ Trader'}
                </Text>
                {role === r && <Text style={styles.roleCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
          <Text style={styles.roleHint}>
            {role === 'investor'
              ? 'View vaults, deposit senior capital, and track your portfolio.'
              : 'Create and manage vaults, run trades, and graduate to accept capital.'}
          </Text>
        </Section>

        <Section title="Network">
          <Row label="Devnet">
            <Switch
              value={devnet}
              onValueChange={setDevnet}
              trackColor={{ false: colors.border, true: colors.signalDeep }}
              thumbColor={devnet ? colors.signal : colors.textQuiet}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="RPC Endpoint">
            <Text style={styles.monoText}>
              {devnet ? 'api.devnet.solana.com' : 'api.mainnet-beta.solana.com'}
            </Text>
          </Row>
        </Section>

        <Section title="About">
          <Row label="Version"><Text style={styles.monoText}>1.0.0</Text></Row>
          <View style={styles.divider} />
          <Row label="Network"><Text style={styles.monoText}>{devnet ? 'Devnet' : 'Mainnet'}</Text></Row>
          <View style={styles.divider} />
          <Row label="Program">
            <Text style={styles.monoText}>WMzh…w6RB</Text>
          </Row>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Arcadia Protocol</Text>
          <Text style={styles.footerSub}>Proof-gated Solana capital · Non-custodial</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: 20, paddingBottom: 48 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  rowRight: { alignItems: 'flex-end' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  monoText: { fontSize: 12, color: colors.textMuted, fontFamily: 'Courier' },
  walletBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 12,
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  walletInfo: { flex: 1, gap: 2 },
  walletStatus: { fontSize: 14, fontWeight: '600', color: colors.text },
  walletAddr: { fontSize: 11, color: colors.signal, fontFamily: 'Courier' },
  walletHint: { fontSize: 11, color: colors.textQuiet },
  walletBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '55',
  },
  walletBtnDanger: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger + '55',
  },
  walletBtnText: { fontSize: 13, fontWeight: '600', color: colors.signal },
  walletBtnTextDanger: { color: colors.danger },
  roleRow: { flexDirection: 'row', gap: 0 },
  roleBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  roleBtnActive: {
    borderBottomColor: colors.signal,
    backgroundColor: colors.signalDim,
  },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  roleBtnTextActive: { color: colors.signal },
  roleCheck: { fontSize: 12, color: colors.signal },
  roleHint: {
    fontSize: 12,
    color: colors.textQuiet,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  footer: { alignItems: 'center', gap: 4, paddingTop: 12 },
  footerText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  footerSub: { fontSize: 11, color: colors.textQuiet },
});
