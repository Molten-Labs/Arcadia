import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../src/lib/theme';
import { useWallet } from '../../src/lib/wallet';
import { useVaults } from '../../src/hooks/useVaults';
import { useArcadiaTransactions } from '../../src/hooks/useTransactions';
import { TxModal, TxState, txFailureState } from '../../src/components/TxModal';
import { StatusBadge } from '../../src/components/StatusBadge';
import { HealthMeter } from '../../src/components/HealthMeter';
import { startGuidedMobileDemo } from '../../src/components/GuidedDemoOverlay';
import { formatUSD, truncateAddress } from '../../src/lib/format';
import { VaultView } from '../../src/lib/mockData';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connected, connect, publicKey, role, setRole, isDemoWallet, walletLabel, pendingRequest } = useWallet();
  const { data: vaults, isLoading } = useVaults();
  const { initManager } = useArcadiaTransactions();
  const [txState, setTxState] = useState<TxState>({ type: 'idle' });

  const managerVaults = (vaults ?? []).filter(v =>
    publicKey ? v.managerPubkey === publicKey || isDemoWallet : isDemoWallet,
  );
  const activeVaults = managerVaults.filter(v => v.status === 'active');
  const paperVault = managerVaults.find(v => v.status === 'paper');
  const leadVault = activeVaults[0] ?? paperVault ?? managerVaults[0];
  const totalJunior = managerVaults.reduce((sum, v) => sum + v.juniorCapital, 0);
  const seniorTvl = managerVaults.reduce((sum, v) => sum + v.seniorCapital, 0);
  const avgHealth = managerVaults.length
    ? managerVaults.reduce((sum, v) => sum + v.juniorHealth, 0) / managerVaults.length
    : 1;
  const paperProgress = paperVault
    ? Math.min(1, paperVault.paperTradeCount / Math.max(1, paperVault.minQualifyingTrades))
    : activeVaults.length > 0 ? 1 : 0;

  async function runInitManager() {
    if (!connected) {
      try { await connect(); } catch (err: any) {
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
      setTxState(txFailureState(err, 'Failed to initialize manager'));
    }
  }

  async function handleConnect() {
    try {
      await connect();
      setRole('trader');
    } catch (err: any) {
      Alert.alert('Wallet unavailable', err?.message ?? 'Unable to connect wallet');
    }
  }

  function handleStartDemo() {
    setRole('trader');
    startGuidedMobileDemo();
  }

  return (
    <>
      <TxModal state={txState} onClose={() => setTxState({ type: 'idle' })} label="Init Manager" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero panel */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(0,217,140,0.10)', 'rgba(0,217,140,0.02)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <View style={{ width: 16, height: 16, gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 16 }}>
                  <View style={{ width: 4, height: 7, borderRadius: 1, backgroundColor: colors.signal }} />
                  <View style={{ width: 4, height: 14, borderRadius: 1, backgroundColor: colors.signal }} />
                  <View style={{ width: 4, height: 10, borderRadius: 1, backgroundColor: colors.signal }} />
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Trader Cockpit</Text>
              <Text style={styles.walletLine}>
                {connected ? walletLabel || truncateAddress(publicKey ?? '', 5) : 'Connect wallet to sign transactions'}
              </Text>
            </View>
            <View style={[styles.networkBadge, connected && styles.networkBadgeLive]}>
              <View style={[styles.networkDot, connected && styles.networkDotLive]} />
              <Text style={[styles.networkText, connected && styles.networkTextLive]}>
                {connected ? 'Devnet' : 'Offline'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Run the first-loss vault lifecycle from your phone.
          </Text>
          <Text style={styles.heroSub}>
            Create, fund, graduate, guard, and prove the junior-first loss waterfall without leaving the mobile flow.
          </Text>

          {pendingRequest && (
            <View style={styles.pendingBanner}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.signal }} />
              <Text style={styles.pendingText}>{pendingRequest}</Text>
            </View>
          )}

          <View style={styles.heroActions}>
            {!connected ? (
              <MotionPressable style={styles.primaryBtn} onPress={handleConnect}>
                <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
                  <Text style={styles.primaryText}>Connect Wallet</Text>
                </LinearGradient>
              </MotionPressable>
            ) : role !== 'trader' ? (
              <MotionPressable style={styles.primaryBtn} onPress={() => setRole('trader')}>
                <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
                  <Text style={{ fontSize: 16 }}>⇄</Text>
                  <Text style={styles.primaryText}>Enter Trader Mode</Text>
                </LinearGradient>
              </MotionPressable>
            ) : (
              <MotionPressable style={styles.primaryBtn} onPress={() => router.push('/manager/create')}>
                <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
                  <Text style={{ fontSize: 16 }}>＋</Text>
                  <Text style={styles.primaryText}>Launch Vault</Text>
                </LinearGradient>
              </MotionPressable>
            )}
            <MotionPressable style={styles.secondaryBtn} onPress={handleStartDemo}>
              <Text style={{ fontSize: 15 }}>▶</Text>
              <Text style={styles.secondaryText}>Demo</Text>
            </MotionPressable>
          </View>
        </View>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Junior at risk"
            value={formatUSD(totalJunior, true)}
            accent
          />
          <KpiCard
            label="Senior protected"
            value={formatUSD(seniorTvl, true)}
          />
          <KpiCard
            label="Live vaults"
            value={`${activeVaults.length}/${managerVaults.length}`}
            accent={activeVaults.length > 0}
          />
          <KpiCard
            label="Paper progress"
            value={`${Math.round(paperProgress * 100)}%`}
          />
        </View>

        {/* Proof pipeline */}
        <SectionHeader label="Proof Pipeline" hint="On-chain lifecycle" />
        <View style={styles.pipelineCard}>
          <PipelineStep
            index={1}
            title="Trader posts junior capital"
            copy="Your own funds sit in the first-loss tranche."
            done={totalJunior > 0}
          />
          <PipelineStep
            index={2}
            title="Paper mode graduates"
            copy={paperVault
              ? `${paperVault.paperTradeCount}/${paperVault.minQualifyingTrades} qualifying trades`
              : 'Vault already graduated'}
            done={paperProgress >= 1}
          />
          <PipelineStep
            index={3}
            title="Investors deposit senior capital"
            copy="Senior capital enters only after your reputation is proven."
            done={seniorTvl > 0}
          />
          <PipelineStep
            index={4}
            title="Vault Guard enforces risk limits"
            copy="Risky trades are rejected before funds move."
            done={Boolean(leadVault?.tradingEnabled)}
            last
          />
        </View>

        {/* Vault Guard */}
        <View style={styles.guardCard}>
          <View style={styles.guardHeader}>
            <View style={{ width: 18, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.signal, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: colors.signal }} />
            </View>
            <Text style={styles.guardTitle}>Vault Guard</Text>
          </View>
          <Text style={styles.guardSub}>
            Position limits tighten as junior health falls. Investors see the proof — not the strategy.
          </Text>
          <View style={styles.healthPanel}>
            <HealthMeter health={avgHealth} height={8} />
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Max trade size</Text>
              <Text style={[styles.limitValue, { color: avgHealth < 0.45 ? colors.danger : colors.signal }]}>
                {avgHealth < 0.45 ? 'Locked' : avgHealth < 0.7 ? '5% TVL' : '15% TVL'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickGrid}>
          <QuickAction
            title="Initialize"
            copy="Create manager account"
            onPress={runInitManager}
          />
          <QuickAction
            title="Trade"
            copy="Open terminal"
            onPress={() => router.push('/trade')}
          />
          <QuickAction
            title="New Vault"
            copy="Paper mode first"
            onPress={() => router.push('/manager/create')}
          />
        </View>

        {/* Managed vaults */}
        <SectionHeader label="Managed Vaults" hint={`${managerVaults.length} total`} />

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.signal} />
            <Text style={styles.loadingText}>Syncing vault state...</Text>
          </View>
        ) : managerVaults.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border }} />
            </View>
            <Text style={styles.emptyTitle}>No managed vaults</Text>
            <Text style={styles.emptySub}>
              Start the guided demo or launch a paper vault to build your track record.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={handleStartDemo}>
              <Text style={styles.emptyBtnText}>Run guided lifecycle</Text>
            </Pressable>
          </View>
        ) : managerVaults.map(vault => (
          <ManagerVaultCard
            key={vault.id}
            vault={vault}
            onPress={() => router.push(`/manager/vault/${vault.configPubkey}`)}
          />
        ))}
      </ScrollView>
    </>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

function MotionPressable({
  children, disabled, onPress, style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 350 });
        if (Platform.OS !== 'web') Haptics.selectionAsync();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 280 });
      }}
      style={[style, animatedStyle, disabled && styles.disabled]}
    >
      {children}
    </AnimatedPressable>
  );
}

function KpiCard({ label, value, accent }: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, accent && styles.kpiCardAccent]}>
      <View style={[styles.kpiIconWrap, accent && styles.kpiIconWrapAccent]}>
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: accent ? colors.signal : colors.textQuiet }} />
      </View>
      <Text style={[styles.kpiValue, accent && { color: colors.signal }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function PipelineStep({ index, title, copy, done, last }: {
  index: number;
  title: string;
  copy: string;
  done: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.pipelineStep}>
      <View style={styles.pipelineRail}>
        <View style={[styles.pipelineDot, done && styles.pipelineDotDone]}>
          {done ? (
            <Text style={{ fontSize: 13, color: colors.white, fontWeight: '700' }}>✓</Text>
          ) : (
            <Text style={styles.pipelineNum}>{index}</Text>
          )}
        </View>
        {!last && <View style={[styles.pipelineLine, done && styles.pipelineLineDone]} />}
      </View>
      <View style={styles.pipelineContent}>
        <Text style={styles.pipelineTitle}>{title}</Text>
        <Text style={styles.pipelineCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function QuickAction({ title, copy, onPress }: {
  title: string;
  copy: string;
  onPress: () => void;
}) {
  return (
    <MotionPressable style={styles.quickCard} onPress={onPress}>
      <View style={styles.quickIcon}>
        <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 2, borderColor: colors.signal }} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickCopy}>{copy}</Text>
    </MotionPressable>
  );
}

function ManagerVaultCard({ vault, onPress }: { vault: VaultView; onPress: () => void }) {
  const navChange = vault.currentNav - 1;
  const navPositive = navChange >= 0;

  return (
    <MotionPressable style={styles.vaultCard} onPress={onPress}>
      <View style={styles.vaultTop}>
        <View style={styles.vaultAvatar}>
          <Text style={styles.vaultAvatarText}>{vault.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vaultName}>{vault.name}</Text>
          <Text style={styles.vaultMeta}>{truncateAddress(vault.managerPubkey, 5)}</Text>
        </View>
        <StatusBadge status={vault.status} size="sm" />
      </View>
      <View style={styles.vaultNumbers}>
        <View>
          <Text style={styles.vaultNumLabel}>NAV</Text>
          <Text style={styles.vaultNumVal}>{vault.currentNav.toFixed(4)}</Text>
        </View>
        <View>
          <Text style={styles.vaultNumLabel}>Junior Capital</Text>
          <Text style={styles.vaultNumVal}>{formatUSD(vault.juniorCapital, true)}</Text>
        </View>
        <View>
          <Text style={styles.vaultNumLabel}>Change</Text>
          <Text style={[styles.vaultNumVal, { color: navPositive ? colors.signal : colors.danger }]}>
            {navPositive ? '+' : ''}{(navChange * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
      <HealthMeter health={vault.juniorHealth} height={5} />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: 14, paddingBottom: 80 },

  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    overflow: 'hidden',
    padding: 20,
    gap: 14,
    backgroundColor: colors.surface,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 11, color: colors.signal, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  walletLine: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontFamily: 'Courier' },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  networkBadgeLive: { backgroundColor: colors.signalDim, borderColor: colors.signalBorder },
  networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textQuiet },
  networkDotLive: { backgroundColor: colors.signal },
  networkText: { fontSize: 10, color: colors.textQuiet, fontWeight: '700' },
  networkTextLive: { color: colors.signal },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroSub: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.signalDim,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pendingText: { color: colors.signal, fontSize: 11, fontFamily: 'Courier', fontWeight: '600' },
  heroActions: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, borderRadius: radius.pill, overflow: 'hidden' },
  primaryGrad: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryText: { color: colors.textSub, fontSize: 13, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  kpiCardAccent: {
    borderColor: colors.signalBorder,
    backgroundColor: colors.signalDim,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiIconWrapAccent: { backgroundColor: 'rgba(0,217,140,0.16)' },
  kpiLabel: { color: colors.textQuiet, fontSize: 10, fontWeight: '500', lineHeight: 14 },
  kpiValue: { color: colors.text, fontSize: 20, fontWeight: '700', fontFamily: 'Courier' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHint: { fontSize: 11, color: colors.textQuiet },

  pipelineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 0,
    overflow: 'hidden',
  },
  pipelineStep: { flexDirection: 'row', gap: 12 },
  pipelineRail: { alignItems: 'center', width: 34 },
  pipelineDot: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineDotDone: { backgroundColor: colors.signal, borderColor: colors.signal },
  pipelineNum: { color: colors.textMuted, fontSize: 12, fontWeight: '700', fontFamily: 'Courier' },
  pipelineLine: { width: 1, flex: 1, minHeight: 28, backgroundColor: colors.border, marginVertical: 4 },
  pipelineLineDone: { backgroundColor: colors.signal },
  pipelineContent: { flex: 1, paddingBottom: 18, paddingTop: 6 },
  pipelineTitle: { color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  pipelineCopy: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },

  guardCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  guardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  guardSub: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  healthPanel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
  },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  limitLabel: { color: colors.textQuiet, fontSize: 11, fontWeight: '500' },
  limitValue: { fontSize: 14, fontFamily: 'Courier', fontWeight: '700' },

  quickGrid: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.signalDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  quickCopy: { color: colors.textQuiet, fontSize: 10, lineHeight: 14 },

  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingText: { color: colors.textMuted, fontSize: 13 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: 10,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: colors.textQuiet, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    backgroundColor: colors.signalDim,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    marginTop: 4,
  },
  emptyBtnText: { color: colors.signal, fontSize: 13, fontWeight: '700' },

  vaultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  vaultTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vaultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signalBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultAvatarText: { color: colors.signal, fontSize: 17, fontWeight: '700' },
  vaultName: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  vaultMeta: { color: colors.textQuiet, fontSize: 10, fontFamily: 'Courier', marginTop: 2 },
  vaultNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 12,
  },
  vaultNumLabel: { color: colors.textQuiet, fontSize: 9, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  vaultNumVal: { color: colors.text, fontSize: 13, fontFamily: 'Courier', fontWeight: '700', marginTop: 3 },

  disabled: { opacity: 0.45 },

  textSub: { color: colors.textSub },
});
