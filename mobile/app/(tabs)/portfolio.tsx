import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../../src/lib/theme';
import { useWallet } from '../../src/lib/wallet';
import { usePositions } from '../../src/hooks/usePositions';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { HealthMeter } from '../../src/components/HealthMeter';
import { StatusBadge } from '../../src/components/StatusBadge';
import { formatUSD, formatPnL, pnlColor, formatAge } from '../../src/lib/format';

export default function PortfolioScreen() {
  const router = useRouter();
  const { connected, publicKey, connect } = useWallet();
  const { data: positions, isLoading, refetch, isRefetching } = usePositions(publicKey);

  const totalDeposited = (positions ?? []).reduce((s, p) => s + p.totalDeposited, 0);
  const totalCurrent = (positions ?? []).reduce((s, p) => s + p.currentValue, 0);
  const totalPnL = totalCurrent - totalDeposited;
  const pnlC = pnlColor(totalDeposited, totalCurrent, colors);

  if (!connected) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Portfolio" />
        <EmptyState
          icon="◈"
          title="Connect your wallet"
          subtitle="Connect to see your investor positions and P&L"
        />
        <View style={styles.connectWrap}>
          <Pressable style={styles.connectBtn} onPress={connect}>
            <Text style={styles.connectBtnText}>Connect Wallet</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Portfolio" showWallet />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.signal} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.signal} />
          }
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Position</Text>
            <Text style={styles.summaryBig}>{formatUSD(totalCurrent, true)}</Text>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>DEPOSITED</Text>
                <Text style={styles.summaryMono}>{formatUSD(totalDeposited, true)}</Text>
              </View>
              <View style={styles.summaryMid}>
                <Text style={styles.summaryLabel}>P&L</Text>
                <Text style={[styles.summaryMono, { color: pnlC }]}>
                  {formatPnL(totalDeposited, totalCurrent)}
                </Text>
              </View>
              <View>
                <Text style={styles.summaryLabel}>POSITIONS</Text>
                <Text style={styles.summaryMono}>{(positions ?? []).length}</Text>
              </View>
            </View>
            {totalDeposited > 0 && (
              <View style={styles.pnlBar}>
                <View
                  style={[
                    styles.pnlFill,
                    {
                      width: `${Math.min(100, (totalPnL / totalDeposited + 1) * 50)}%`,
                      backgroundColor: totalPnL >= 0 ? colors.signal : colors.danger,
                    },
                  ]}
                />
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Positions</Text>

          {(positions ?? []).length === 0 ? (
            <EmptyState
              icon="◈"
              title="No positions yet"
              subtitle="Deposit into a graduated vault to start earning"
            />
          ) : (
            (positions ?? []).map(pos => (
              <Pressable
                key={pos.pubkey}
                style={({ pressed }) => [styles.posCard, pressed && styles.posCardPressed]}
                onPress={() => router.push(`/vault/${pos.vaultConfigPubkey}`)}
              >
                <View style={styles.posHeader}>
                  <View style={styles.posLeft}>
                    <Text style={styles.posName}>{pos.vault?.name ?? 'Vault'}</Text>
                    {pos.vault && <StatusBadge status={pos.vault.status} size="sm" />}
                  </View>
                  <View style={styles.posRight}>
                    <Text style={styles.posValue}>{formatUSD(pos.currentValue, true)}</Text>
                    <Text style={[styles.posPnL, { color: pnlColor(pos.totalDeposited, pos.currentValue, colors) }]}>
                      {formatPnL(pos.totalDeposited, pos.currentValue)}
                    </Text>
                  </View>
                </View>

                <View style={styles.posStats}>
                  <View style={styles.posStatItem}>
                    <Text style={styles.posStatLabel}>DEPOSITED</Text>
                    <Text style={styles.posStatValue}>{formatUSD(pos.totalDeposited, true)}</Text>
                  </View>
                  <View style={styles.posStatItem}>
                    <Text style={styles.posStatLabel}>SHARES</Text>
                    <Text style={styles.posStatValue}>{pos.seniorShares.toLocaleString()}</Text>
                  </View>
                  <View style={styles.posStatItem}>
                    <Text style={styles.posStatLabel}>AGE</Text>
                    <Text style={styles.posStatValue}>{formatAge(pos.depositedAt)}</Text>
                  </View>
                </View>

                {pos.vault && (
                  <HealthMeter health={pos.vault.juniorHealth} height={4} />
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  connectWrap: {
    position: 'absolute',
    bottom: 40,
    left: spacing.md,
    right: spacing.md,
  },
  connectBtn: {
    backgroundColor: colors.signal,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  scroll: { padding: spacing.md, gap: 12, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryBig: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
    letterSpacing: -1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryMid: { alignItems: 'center' },
  summaryLabel: {
    fontSize: 9,
    color: colors.textQuiet,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryMono: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Courier',
  },
  pnlBar: {
    height: 4,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  pnlFill: { height: 4, borderRadius: radius.full },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  posCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  posCardPressed: { opacity: 0.75, borderColor: colors.signal + '44' },
  posHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  posLeft: { gap: 5, flex: 1 },
  posName: { fontSize: 15, fontWeight: '700', color: colors.text },
  posRight: { alignItems: 'flex-end' },
  posValue: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Courier' },
  posPnL: { fontSize: 12, fontWeight: '600', fontFamily: 'Courier' },
  posStats: { flexDirection: 'row', justifyContent: 'space-between' },
  posStatItem: { gap: 2 },
  posStatLabel: { fontSize: 9, color: colors.textQuiet, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  posStatValue: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: 'Courier' },
});
