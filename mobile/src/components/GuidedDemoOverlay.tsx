import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { colors, radius, spacing } from '../lib/theme';
import { useWallet } from '../lib/wallet';
import { MOCK_VAULTS } from '../lib/mockData';
import {
  addDemoInvestorDeposit,
  applyDemoLoss,
  graduateDemoVault,
  requestMobileDemoStart,
  resetMobileDemo,
  setMobileDemoVault,
  startMobileDemo,
  subscribeMobileDemoStart,
} from '../lib/demoState';

interface DemoStep {
  title: string;
  detail: string;
  route: string;
  duration: number;
  run?: () => void | Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function startGuidedMobileDemo() {
  requestMobileDemoStart();
}

export function GuidedDemoOverlay() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connectDemoWallet, setRole, publicKey } = useWallet();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const demoVault = MOCK_VAULTS[3];
  const activeVault = MOCK_VAULTS[0];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['vaults'] });
    queryClient.invalidateQueries({ queryKey: ['positions'] });
    queryClient.invalidateQueries({ queryKey: ['managers'] });
  }, [queryClient]);

  const steps = useMemo<DemoStep[]>(() => [
    {
      title: 'Connect as trader',
      detail: 'Demo wallet opens the trader console with manager controls visible.',
      route: '/manager',
      duration: 2400,
      run: async () => {
        await connectDemoWallet();
        setRole('trader');
      },
    },
    {
      title: 'Post first-loss capital',
      detail: 'The paper vault starts with 10,000 USDC junior capital.',
      route: `/manager/vault/${demoVault.configPubkey}`,
      duration: 2800,
      run: () => {
        setMobileDemoVault(demoVault.id, {
          juniorCapital: 10_000,
          seniorCapital: 0,
          tvl: 10_000,
          paperTradeCount: 0,
          juniorHealth: 1,
          status: 'paper',
          tradingEnabled: true,
        });
        invalidate();
      },
    },
    {
      title: 'Paper trades complete',
      detail: 'Guarded trades build the track record before investor deposits open.',
      route: `/manager/vault/${demoVault.configPubkey}`,
      duration: 2800,
      run: () => {
        setMobileDemoVault(demoVault.id, {
          paperTradeCount: demoVault.minQualifyingTrades,
          currentNav: 1.052,
          highWaterMark: 1.052,
        });
        invalidate();
      },
    },
    {
      title: 'Graduate the vault',
      detail: 'The vault becomes investable after the paper-mode proof is complete.',
      route: `/manager/vault/${demoVault.configPubkey}`,
      duration: 2600,
      run: () => {
        graduateDemoVault(demoVault);
        invalidate();
      },
    },
    {
      title: 'Switch to investor',
      detail: 'The same app shows senior-capital decisions from the investor side.',
      route: `/vault/${demoVault.configPubkey}`,
      duration: 2600,
      run: () => {
        setRole('investor');
      },
    },
    {
      title: 'Deposit senior capital',
      detail: 'The investor enters behind the trader buffer.',
      route: '/portfolio',
      duration: 3000,
      run: () => {
        addDemoInvestorDeposit(demoVault, publicKey ?? 'DEMO_INVESTOR', 50_000);
        invalidate();
      },
    },
    {
      title: 'Junior gets hit first',
      detail: 'A losing trade drops junior health while senior capital stays protected.',
      route: `/vault/${activeVault.configPubkey}`,
      duration: 3600,
      run: () => {
        applyDemoLoss(activeVault, 20_000);
        invalidate();
      },
    },
  ], [activeVault, connectDemoWallet, demoVault, invalidate, publicKey, setRole]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setActive(false);
    setPaused(false);
    setStepIndex(0);
  }, []);

  const runStep = useCallback(async (idx: number) => {
    const step = steps[idx];
    if (!step) {
      stop();
      return;
    }
    router.push(step.route as never);
    await sleep(250);
    await step.run?.();
    Haptics.selectionAsync().catch(() => {});
    if (!paused) {
      timerRef.current = setTimeout(() => {
        setStepIndex((current) => current + 1);
      }, step.duration);
    }
  }, [paused, router, steps, stop]);

  useEffect(() => subscribeMobileDemoStart(() => {
    resetMobileDemo();
    startMobileDemo();
    setActive(true);
    setPaused(false);
    setStepIndex(0);
  }), []);

  useEffect(() => {
    if (!active || paused) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    runStep(stepIndex);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, runStep, stepIndex]);

  if (!active) return null;

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = Math.min(100, ((stepIndex + 1) / steps.length) * 100);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.sheet}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>Guided mobile demo</Text>
          <Text style={styles.counter}>{Math.min(stepIndex + 1, steps.length)}/{steps.length}</Text>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.detail}>{step.detail}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.controls}>
          <Pressable style={styles.controlButton} onPress={() => setStepIndex((idx) => Math.max(0, idx - 1))}>
            <Text style={styles.controlText}>Back</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => setPaused((value) => !value)}>
            <Text style={styles.primaryText}>{paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <Pressable style={styles.controlButton} onPress={() => setStepIndex((idx) => Math.min(steps.length, idx + 1))}>
            <Text style={styles.controlText}>Next</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={stop}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 88,
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.inkBorder,
    padding: spacing.md,
    gap: 10,
    shadowColor: colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: '#68E6DA', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  counter: { color: colors.textQuiet, fontSize: 11, fontFamily: 'Courier', fontWeight: '700' },
  title: { color: colors.white, fontSize: 17, fontWeight: '800' },
  detail: { color: '#B9D1D5', fontSize: 12, lineHeight: 18 },
  progressTrack: { height: 5, borderRadius: radius.full, backgroundColor: colors.inkSurfaceElevated, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: radius.full, backgroundColor: colors.signal },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  controlButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.inkBorder, alignItems: 'center', justifyContent: 'center' },
  controlText: { color: '#D7E7E5', fontSize: 12, fontWeight: '700' },
  primaryButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  closeButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.lg, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textQuiet, fontSize: 12, fontWeight: '700' },
});
