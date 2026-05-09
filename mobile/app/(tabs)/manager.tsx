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
        <View style={styles.heroShell}>
          <LinearGradient
            colors={['rgba(0,181,164,0.18)', 'rgba(255,255,255,0.86)', 'rgba(0,43,61,0.06)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTop}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>TRADER COCKPIT</Text>
              <Text style={styles.walletLine}>
                {connected ? walletLabel || truncateAddress(publicKey ?? '', 5) : 'Wallet required for signing'}
              </Text>
            </View>
            <View style={[styles.livePill, connected && styles.livePillOn]}>
              <View style={[styles.liveDot, connected && styles.liveDotOn]} />
              <Text style={[styles.liveText, connected && styles.liveTextOn]}>
                {connected ? 'DEVNET' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>Run the full first-loss vault lifecycle from your phone.</Text>
          <Text style={styles.subtitle}>
            Create, fund, graduate, guard, and prove the junior-first loss waterfall without leaving the mobile flow.
          </Text>

          {pendingRequest && <Text style={styles.pendingLine}>{pendingRequest}</Text>}

          <View style={styles.heroActions}>
            {!connected ? (
              <MotionPressable style={styles.primaryBtn} onPress={handleConnect}>
                <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
                  <Text style={styles.primaryText}>Connect wallet</Text>
                </LinearGradient>
              </MotionPressable>
            ) : role !== 'trader' ? (
              <MotionPressable style={styles.primaryBtn} onPress={() => setRole('trader')}>
                <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
                  <Text style={styles.primaryText}>Enter trader mode</Text>
                </LinearGradient>
              </MotionPressable>
            ) : (
              <MotionPressable style={styles.primaryBtn} onPress={() => router.push('/manager/create')}>
                <LinearGradient colors={[colors.signal, colors.signalDeep]} style={styles.primaryGrad}>
                  <Text style={styles.primaryText}>Launch vault</Text>
                </LinearGradient>
              </MotionPressable>
            )}
            <MotionPressable style={styles.secondaryBtn} onPress={handleStartDemo}>
              <Text style={styles.secondaryText}>Play demo</Text>
            </MotionPressable>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <Kpi label="Junior at risk" value={formatUSD(totalJunior, true)} tone="signal" />
          <Kpi label="Senior protected" value={formatUSD(seniorTvl, true)} tone="ink" />
          <Kpi label="Live vaults" value={`${activeVaults.length}/${managerVaults.length}`} tone="signal" />
          <Kpi label="Paper proof" value={`${Math.round(paperProgress * 100)}%`} tone="warning" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>PROOF PIPELINE</Text>
          <Text style={styles.sectionHint}>Hackathon evidence</Text>
        </View>
        <View style={styles.pipelineCard}>
          <PipelineStep
            index="01"
            title="Trader posts junior"
            copy="Own capital sits in the first-loss tranche."
            done={totalJunior > 0}
          />
          <PipelineStep
            index="02"
            title="Paper mode graduates"
            copy={paperVault ? `${paperVault.paperTradeCount}/${paperVault.minQualifyingTrades} qualifying trades` : 'Active vault already graduated'}
            done={paperProgress >= 1}
          />
          <PipelineStep
            index="03"
            title="Investor deposits senior"
            copy="Senior capital enters only after reputation is proven."
            done={seniorTvl > 0}
          />
          <PipelineStep
            index="04"
            title="Vault Guard enforces"
            copy="Risky trades are rejected before funds move."
            done={Boolean(leadVault?.tradingEnabled)}
            last
          />
        </View>

        <View style={styles.guardCard}>
          <View style={styles.guardCopy}>
            <Text style={styles.sectionLabel}>VAULT GUARD</Text>
            <Text style={styles.guardTitle}>Risk stays visible. Strategy stays private.</Text>
            <Text style={styles.guardSub}>
              Position limits tighten as junior health falls. Investors only need the proof, not the trader's alpha.
            </Text>
          </View>
          <View style={styles.healthPanel}>
            <HealthMeter health={avgHealth} height={9} />
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Max trade</Text>
              <Text style={styles.limitValue}>{avgHealth < 0.45 ? 'locked' : avgHealth < 0.7 ? '5% TVL' : '15% TVL'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction title="Initialize" copy="Create manager PDA" onPress={runInitManager} />
          <QuickAction title="Guard swap" copy="Open terminal" onPress={() => router.push('/trade')} />
          <QuickAction title="Create vault" copy="Paper mode first" onPress={() => router.push('/manager/create')} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>MANAGED VAULTS</Text>
          <Text style={styles.sectionHint}>{managerVaults.length} total</Text>
        </View>
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.signal} />
            <Text style={styles.loadingText}>Syncing vault state...</Text>
          </View>
        ) : managerVaults.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No manager vaults yet</Text>
            <Text style={styles.emptySub}>Start the guided demo or launch a paper vault to build a public track record.</Text>
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

function MotionPressable({
  children,
  disabled,
  onPress,
  style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 16, stiffness: 320 });
        if (Platform.OS !== 'web') Haptics.selectionAsync();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      style={[style, animatedStyle, disabled && styles.disabled]}
    >
      {children}
    </AnimatedPressable>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'signal' | 'warning' | 'ink' }) {
  const color = tone === 'warning' ? colors.warning : tone === 'ink' ? colors.text : colors.signal;
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function PipelineStep({
  index,
  title,
  copy,
  done,
  last,
}: {
  index: string;
  title: string;
  copy: string;
  done: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.pipelineStep}>
      <View style={styles.pipelineRail}>
        <View style={[styles.pipelineDot, done && styles.pipelineDotDone]}>
          <Text style={[styles.pipelineDotText, done && styles.pipelineDotTextDone]}>{done ? 'OK' : index}</Text>
        </View>
        {!last && <View style={[styles.pipelineLine, done && styles.pipelineLineDone]} />}
      </View>
      <View style={styles.pipelineText}>
        <Text style={styles.pipelineTitle}>{title}</Text>
        <Text style={styles.pipelineCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function QuickAction({ title, copy, onPress }: { title: string; copy: string; onPress: () => void }) {
  return (
    <MotionPressable style={styles.quickCard} onPress={onPress}>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickCopy}>{copy}</Text>
    </MotionPressable>
  );
}

function ManagerVaultCard({ vault, onPress }: { vault: VaultView; onPress: () => void }) {
  const navChange = vault.currentNav - 1;
  const navColor = navChange >= 0 ? colors.signal : colors.danger;
  return (
    <MotionPressable style={styles.vaultCard} onPress={onPress}>
      <View style={styles.vaultTop}>
        <View style={styles.vaultIcon}>
          <Text style={styles.vaultIconText}>{vault.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vaultName}>{vault.name}</Text>
          <Text style={styles.vaultMeta}>Manager {truncateAddress(vault.managerPubkey, 5)}</Text>
        </View>
        <StatusBadge status={vault.status} size="sm" />
      </View>
      <View style={styles.vaultNumbers}>
        <View>
          <Text style={styles.vaultNumberLabel}>NAV</Text>
          <Text style={styles.vaultNumberValue}>{vault.currentNav.toFixed(4)}</Text>
        </View>
        <View>
          <Text style={styles.vaultNumberLabel}>JUNIOR</Text>
          <Text style={styles.vaultNumberValue}>{formatUSD(vault.juniorCapital, true)}</Text>
        </View>
        <View>
          <Text style={styles.vaultNumberLabel}>MOVE</Text>
          <Text style={[styles.vaultNumberValue, { color: navColor }]}>
            {(navChange >= 0 ? '+' : '')}{(navChange * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
      <HealthMeter health={vault.juniorHealth} height={7} />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: 16, paddingBottom: 112 },
  heroShell: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 20,
    gap: 16,
    shadowColor: colors.signal,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: colors.white, fontFamily: 'Courier', fontSize: 18, fontWeight: '800' },
  eyebrow: { fontSize: 10, color: colors.signal, fontWeight: '800', letterSpacing: 1.2, fontFamily: 'Courier' },
  walletLine: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontFamily: 'Courier' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  livePillOn: { backgroundColor: colors.signalDim, borderColor: colors.signal + '30' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textQuiet },
  liveDotOn: { backgroundColor: colors.signal },
  liveText: { fontSize: 9, color: colors.textQuiet, fontWeight: '800', fontFamily: 'Courier' },
  liveTextOn: { color: colors.signalDeep },
  title: { color: colors.text, fontSize: 32, lineHeight: 35, fontWeight: '800', letterSpacing: -1.1 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  pendingLine: {
    color: colors.signalDeep,
    fontSize: 11,
    fontFamily: 'Courier',
    backgroundColor: colors.signalDim,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  heroActions: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, borderRadius: radius.full, overflow: 'hidden' },
  primaryGrad: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  kpiLabel: { color: colors.textQuiet, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, fontFamily: 'Courier' },
  kpiValue: { color: colors.text, fontSize: 20, fontWeight: '900', fontFamily: 'Courier' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionLabel: { color: colors.textMuted, fontSize: 10, fontFamily: 'Courier', fontWeight: '900', letterSpacing: 1.1 },
  sectionHint: { color: colors.textQuiet, fontSize: 11, fontFamily: 'Courier' },
  pipelineCard: {
    backgroundColor: colors.ink,
    borderRadius: 26,
    padding: 18,
    gap: 0,
    overflow: 'hidden',
  },
  pipelineStep: { flexDirection: 'row', gap: 12 },
  pipelineRail: { alignItems: 'center', width: 34 },
  pipelineDot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.inkSurface,
    borderWidth: 1,
    borderColor: colors.inkBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineDotDone: { backgroundColor: colors.signal, borderColor: colors.signal },
  pipelineDotText: { color: colors.textQuiet, fontFamily: 'Courier', fontSize: 9, fontWeight: '900' },
  pipelineDotTextDone: { color: colors.white },
  pipelineLine: { width: 1, flex: 1, minHeight: 34, backgroundColor: colors.inkBorder },
  pipelineLineDone: { backgroundColor: colors.signal },
  pipelineText: { flex: 1, paddingBottom: 18 },
  pipelineTitle: { color: colors.white, fontSize: 15, fontWeight: '800' },
  pipelineCopy: { color: '#AFC5CA', fontSize: 12, lineHeight: 18, marginTop: 3 },
  guardCard: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 16,
  },
  guardCopy: { gap: 8 },
  guardTitle: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4 },
  guardSub: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  healthPanel: { backgroundColor: colors.surfaceElevated, borderRadius: 20, padding: 16, gap: 14 },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  limitLabel: { color: colors.textQuiet, fontSize: 10, fontFamily: 'Courier', fontWeight: '900', letterSpacing: 0.8 },
  limitValue: { color: colors.signalDeep, fontSize: 16, fontFamily: 'Courier', fontWeight: '900' },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1,
    minHeight: 88,
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    justifyContent: 'space-between',
  },
  quickTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  quickCopy: { color: colors.textQuiet, fontSize: 10, lineHeight: 14, fontFamily: 'Courier' },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { color: colors.textMuted, fontSize: 12, fontFamily: 'Courier' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 12,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptySub: { color: colors.textQuiet, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { backgroundColor: colors.signalDim, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnText: { color: colors.signalDeep, fontSize: 13, fontWeight: '900' },
  vaultCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  vaultTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vaultIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signal + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultIconText: { color: colors.signalDeep, fontFamily: 'Courier', fontSize: 17, fontWeight: '900' },
  vaultName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  vaultMeta: { color: colors.textQuiet, fontSize: 10, fontFamily: 'Courier', marginTop: 3 },
  vaultNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 12,
  },
  vaultNumberLabel: { color: colors.textQuiet, fontSize: 8, fontFamily: 'Courier', fontWeight: '900', letterSpacing: 0.8 },
  vaultNumberValue: { color: colors.text, fontSize: 13, fontFamily: 'Courier', fontWeight: '900', marginTop: 3 },
  disabled: { opacity: 0.45 },
});
