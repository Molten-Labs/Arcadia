import type { PositionView, VaultView } from './mockData';

const USDC_DECIMALS = 1_000_000;

interface DemoState {
  version: number;
  active: boolean;
  vaultOverrides: Record<string, Partial<VaultView>>;
  positions: PositionView[];
}

let state: DemoState = {
  version: 0,
  active: false,
  vaultOverrides: {},
  positions: [],
};

const listeners = new Set<() => void>();
const startListeners = new Set<() => void>();

function emit() {
  state = { ...state, version: state.version + 1 };
  listeners.forEach((listener) => listener());
}

export function subscribeMobileDemo(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeMobileDemoStart(listener: () => void) {
  startListeners.add(listener);
  return () => {
    startListeners.delete(listener);
  };
}

export function requestMobileDemoStart() {
  startListeners.forEach((listener) => listener());
}

export function getMobileDemoVersion() {
  return state.version;
}

export function resetMobileDemo() {
  state = {
    version: state.version,
    active: false,
    vaultOverrides: {},
    positions: [],
  };
  emit();
}

export function startMobileDemo() {
  state = {
    version: state.version,
    active: true,
    vaultOverrides: {},
    positions: [],
  };
  emit();
}

export function isMobileDemoActive() {
  return state.active;
}

export function applyMobileDemoVaults(vaults: VaultView[]): VaultView[] {
  if (!state.active) return vaults;
  return vaults.map((vault) => {
    const override = state.vaultOverrides[vault.id] ?? state.vaultOverrides[vault.configPubkey];
    return override ? normalizeVault({ ...vault, ...override }) : vault;
  });
}

export function applyMobileDemoPositions(existing: PositionView[], walletPubkey: string): PositionView[] {
  if (!state.active) return existing;
  const demoPositions = state.positions.map((position) => ({
    ...position,
    investorPubkey: walletPubkey,
  }));
  return demoPositions.length ? demoPositions : existing;
}

export function setMobileDemoVault(vaultId: string, override: Partial<VaultView>) {
  state = {
    ...state,
    vaultOverrides: {
      ...state.vaultOverrides,
      [vaultId]: {
        ...(state.vaultOverrides[vaultId] ?? {}),
        ...override,
      },
    },
  };
  emit();
}

export function graduateDemoVault(vault: VaultView) {
  setMobileDemoVault(vault.id, {
    status: 'active',
    paperTradeCount: Math.max(vault.paperTradeCount, vault.minQualifyingTrades),
    graduatedAt: Math.floor(Date.now() / 1000),
    currentNav: Math.max(vault.currentNav, vault.highWaterMark, 1.04),
    highWaterMark: Math.max(vault.highWaterMark, 1.04),
    tradingEnabled: true,
  });
}

export function addDemoInvestorDeposit(vault: VaultView, walletPubkey: string, amount: number) {
  const currentVault = vaultWithOverrides(vault);
  const seniorCapital = currentVault.seniorCapital + amount;
  const tvl = currentVault.juniorCapital + seniorCapital;
  const currentValue = amount * Math.max(currentVault.currentNav, 1);
  const position: PositionView = {
    pubkey: `DEMO_POS_${currentVault.id}`,
    vaultConfigPubkey: currentVault.configPubkey,
    vault: normalizeVault({ ...currentVault, seniorCapital, tvl, status: 'active' }),
    investorPubkey: walletPubkey,
    depositedAt: Math.floor(Date.now() / 1000),
    seniorShares: amount * USDC_DECIMALS,
    totalDeposited: amount,
    alertThresholdBps: 2000,
    currentValue,
  };

  state = {
    ...state,
    positions: [position],
    vaultOverrides: {
      ...state.vaultOverrides,
      [currentVault.id]: {
        ...(state.vaultOverrides[currentVault.id] ?? {}),
        status: 'active',
        seniorCapital,
        tvl,
      },
    },
  };
  emit();
}

export function applyDemoLoss(vault: VaultView, lossAmount: number) {
  const currentVault = vaultWithOverrides(vault);
  const juniorCapital = Math.max(0, currentVault.juniorCapital - lossAmount);
  const remainingLoss = Math.max(0, lossAmount - currentVault.juniorCapital);
  const seniorCapital = Math.max(0, currentVault.seniorCapital - remainingLoss);
  const tvl = juniorCapital + seniorCapital;
  const originalJunior = Math.max(currentVault.juniorCapital, 1);
  const juniorHealth = Math.max(0, Math.min(1, juniorCapital / originalJunior));

  setMobileDemoVault(currentVault.id, {
    juniorCapital,
    seniorCapital,
    tvl,
    juniorHealth,
    tradingEnabled: juniorCapital > 0,
    status: juniorCapital > 0 ? currentVault.status : 'frozen',
    currentNav: Math.max(0.01, currentVault.currentNav - 0.08),
  });
}

function vaultWithOverrides(vault: VaultView): VaultView {
  return normalizeVault({
    ...vault,
    ...(state.vaultOverrides[vault.id] ?? {}),
    ...(state.vaultOverrides[vault.configPubkey] ?? {}),
  });
}

function normalizeVault(vault: VaultView): VaultView {
  const tvl = vault.juniorCapital + vault.seniorCapital;
  return {
    ...vault,
    tvl,
    juniorHealth: Math.max(0, Math.min(1, vault.juniorHealth)),
  };
}
