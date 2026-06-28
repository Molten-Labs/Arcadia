import { vaults as SEED_VAULTS, investorPositions as SEED_POSITIONS, alerts as SEED_ALERTS } from "./mockData";
import type { Vault, InvestorPosition, Alert, VaultStatus } from "./mockData";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function nowIso() {
  return new Date().toISOString();
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

class MockStore {
  vaults: Vault[] = deepClone(SEED_VAULTS);
  positions: InvestorPosition[] = deepClone(SEED_POSITIONS);
  alerts: Alert[] = deepClone(SEED_ALERTS);
  _nextAlertId = 100;

  private emit() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kiln:mock-update"));
    }
  }

  private addAlert(alert: Omit<Alert, "id">) {
    this.alerts.unshift({ ...alert, id: `al${this._nextAlertId++}` });
  }

  depositSenior(vaultId: string, amountUsdc: number): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault) return;
    vault.seniorCapital += amountUsdc;
    vault.tvl += amountUsdc;
    vault.activity.unshift({
      id: `a${Date.now()}`,
      time: nowIso(),
      kind: "investor_deposit",
      message: `Investor deposited ${fmtAmount(amountUsdc)} USDC`,
    });
    const existing = this.positions.find(p => p.vaultId === vaultId);
    if (existing) {
      const gain = existing.currentValue > 0 ? (existing.currentValue / existing.deposited) : 1;
      existing.deposited += amountUsdc;
      existing.currentValue += amountUsdc * gain;
      existing.shares += amountUsdc;
    } else {
      this.positions.push({
        vaultId,
        deposited: amountUsdc,
        currentValue: amountUsdc,
        shares: amountUsdc,
        depositedAt: new Date().toISOString().slice(0, 10),
        alertThreshold: 30,
      });
    }
    this.emit();
  }

  withdrawSenior(vaultId: string, amountUsdc: number): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault) return;
    const actualWithdraw = Math.min(amountUsdc, vault.seniorCapital);
    vault.seniorCapital = Math.max(0, vault.seniorCapital - actualWithdraw);
    vault.tvl = Math.max(0, vault.tvl - actualWithdraw);
    vault.activity.unshift({
      id: `a${Date.now()}`,
      time: nowIso(),
      kind: "withdraw",
      message: `Investor withdrew ${fmtAmount(actualWithdraw)} USDC`,
    });
    const pos = this.positions.find(p => p.vaultId === vaultId);
    if (pos) {
      const withdrawRatio = pos.currentValue > 0 ? actualWithdraw / pos.currentValue : 1;
      pos.currentValue = Math.max(0, pos.currentValue - actualWithdraw);
      pos.deposited = Math.max(0, pos.deposited * (1 - withdrawRatio));
      pos.shares = Math.max(0, pos.shares * (1 - withdrawRatio));
      if (pos.currentValue < 1) {
        this.positions = this.positions.filter(p => p.vaultId !== vaultId);
      }
    }
    this.emit();
  }

  depositJunior(vaultId: string, amountUsdc: number): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault) return;
    vault.juniorCapital += amountUsdc;
    vault.tvl += amountUsdc;
    const origJunior = vault.juniorCapital / Math.max(vault.juniorHealth / 100, 0.001);
    vault.juniorHealth = Math.min(100, Math.round((vault.juniorCapital / origJunior) * 100));
    vault.activity.unshift({
      id: `a${Date.now()}`,
      time: nowIso(),
      kind: "deposit",
      message: `Trader added ${fmtAmount(amountUsdc)} USDC junior capital`,
    });
    this.emit();
  }

  withdrawJunior(vaultId: string, amountUsdc: number): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault) return;
    const actual = Math.min(amountUsdc, vault.juniorCapital);
    vault.juniorCapital = Math.max(0, vault.juniorCapital - actual);
    vault.tvl = Math.max(0, vault.tvl - actual);
    const origJunior = vault.juniorCapital / Math.max(vault.juniorHealth / 100, 0.001);
    vault.juniorHealth = vault.juniorCapital > 0
      ? Math.min(100, Math.round((vault.juniorCapital / origJunior) * 100))
      : 0;
    this.emit();
  }

  graduateVault(vaultId: string): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault || vault.status !== "paper") return;
    vault.status = "active" as VaultStatus;
    vault.graduatedAt = new Date().toISOString().slice(0, 10);
    vault.paperDaysElapsed = vault.paperDaysRequired;
    vault.activity.unshift({
      id: `a${Date.now()}`,
      time: nowIso(),
      kind: "graduate",
      message: "Vault graduated from paper mode — investor deposits now open",
    });
    this.addAlert({
      time: nowIso(),
      vaultId,
      kind: "graduate",
      title: `${vault.name} graduated`,
      description: "Vault passed paper mode. Investor deposits are now open.",
      read: false,
    });
    this.emit();
  }

  claimFees(vaultId: string): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault || vault.unclaimedFees <= 0) return;
    const fees = vault.unclaimedFees;
    vault.unclaimedFees = 0;
    vault.activity.unshift({
      id: `a${Date.now()}`,
      time: nowIso(),
      kind: "fee",
      message: `Performance fee claimed: ${fmtAmount(fees)} USDC`,
    });
    this.emit();
  }

  createVault(params: {
    name: string;
    feeBps: number;
    maxSlippageBps: number;
    juniorAmount: number;
  }): string {
    const id = `vlt-new-${Date.now()}`;
    const now = new Date();
    const newVault: Vault = {
      id,
      name: params.name || "New Vault",
      traderWallet: "7xKa...P9mZ",
      status: "paper" as VaultStatus,
      tvl: params.juniorAmount,
      juniorCapital: params.juniorAmount,
      seniorCapital: 0,
      juniorHealth: 100,
      return30d: 0,
      return7d: 0,
      returnAll: 0,
      maxDrawdown: 0,
      maxPositionPct: 25,
      createdAt: now.toISOString().slice(0, 10),
      paperDaysElapsed: 0,
      paperDaysRequired: 30,
      instantExit: false,
      strategyTags: ["Discretionary"],
      description: params.name,
      allowedAssets: ["USDC", "SOL"],
      feeModel: `${params.feeBps / 100}% performance above HWM`,
      hwm: params.juniorAmount,
      unclaimedFees: 0,
      navHistory: [
        { t: now.toISOString().slice(0, 10), nav: params.juniorAmount, junior: params.juniorAmount, senior: 0 },
      ],
      trades: [],
      activity: [
        {
          id: `a${Date.now()}`,
          time: nowIso(),
          kind: "deposit",
          message: `Vault created — ${fmtAmount(params.juniorAmount)} USDC junior capital posted`,
        },
      ],
    };
    this.vaults.push(newVault);
    this.emit();
    return id;
  }

  executeTrade(vaultId: string, pair: string, amountUsdc: number): void {
    const vault = this.vaults.find(v => v.id === vaultId);
    if (!vault) return;
    const pnl = (Math.random() - 0.42) * amountUsdc * 0.06;
    vault.juniorCapital = Math.max(0, vault.juniorCapital + pnl);
    vault.tvl = Math.max(0, vault.tvl + pnl);
    const origJunior = vault.juniorCapital / Math.max(vault.juniorHealth / 100, 0.001);
    vault.juniorHealth = Math.min(100, Math.round((vault.juniorCapital / origJunior) * 100));
    const lastNav = vault.navHistory[vault.navHistory.length - 1]?.nav ?? vault.tvl;
    vault.navHistory.push({
      t: new Date().toISOString().slice(0, 10),
      nav: Math.round(lastNav + pnl),
      junior: Math.round(vault.juniorCapital),
      senior: Math.round(vault.seniorCapital),
    });
    vault.trades.unshift({
      id: `t${Date.now()}`,
      time: nowIso(),
      pair,
      direction: pair.includes("USDC →") ? "buy" : "sell",
      amount: amountUsdc,
      price: 0,
      navAfter: Math.round(vault.tvl),
      juniorImpact: Math.round(pnl * 10) / 10,
    });
    if (vault.trades.length > 30) vault.trades = vault.trades.slice(0, 30);
    this.emit();
  }

  reset(): void {
    this.vaults = deepClone(SEED_VAULTS);
    this.positions = deepClone(SEED_POSITIONS);
    this.alerts = deepClone(SEED_ALERTS);
    this._nextAlertId = 100;
    this.emit();
  }
}

export const mockStore = new MockStore();
