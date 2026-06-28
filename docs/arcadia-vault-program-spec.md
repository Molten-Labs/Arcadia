<!-- Generated from spec-solana-program.html. Keep the HTML source file untouched. -->



Arcadia · Technical Specification · Part 2 of 3

# The `arcadia_vault` Solana Program

Onchain Anchor 1.0 program spec — build-ready for one engineer over 8 weeks (MVP + investor deposits).

**Framework:** Anchor 1.0.2 (Rust) **Cluster:** Devnet **Base token:** devnet USDC (6 decimals) **Share scale:** SHARE_SCALE = 1_000_000 **Accounts:** 4 custom PDAs **Instruction handlers:** 10 **Date:** 2026-06-16

> **Anchor 1.0 / Rust guidelines applied**

This revision was rewritten to comply with the official Anchor 1.0.2 conventions and the Solana onchain financial-math guidelines: `instructions/` + `state/` + `error.rs` layout, `#[derive(InitSpace)]` sizing (no magic numbers), `token_interface` + `transfer_checked` token CPIs, integer-only math with `u128` intermediates and `checked_*` arithmetic rounded in the protocol's favour, and the corrected single-asset USDC share formulas. Every number, percentage, and formula is written explicitly in §6a and used throughout.

## Table of Contents
1. [Overview & dev responsibilities](#overview)
2. [Project structure, program id, PDA seeds](#structure)
3. [Account structs & space sizing](#accounts)
4. [Instruction-by-instruction spec](#instructions)
5. [Simulated-trade model (record_trade)](#trade-model)
6. [NAV / shares integer math & early-investor edge](#nav-math)
7. [Settlement math (HWM, splits)](#settlement)
8. [Capacity enforcement](#capacity)
9. [Security model, hard rules, errors](#security)
10. [Integration contract (events & instructions)](#integration)
11. [Test plan & 8-week build plan](#testplan)

## 1. Overview & Program Developer Responsibilities

**Arcadia** is a Solana platform where skilled traders build a verified, permanent, risk-adjusted onchain reputation from real trades, and investors fund proven traders and share in their profits. This document specifies the **onchain Anchor program** — internally called _"the vault"_ — one of three technical parts (frontend solana-program indexer) built by a 3-person team in 8 weeks.

A **trader profile** is a per-trader onchain PDA that _is_ the vault: it custodies USDC, is the authority over its own vault USDC token account, mints/burns investor shares (held purely as data) against a net-asset-value (NAV), records the realized PnL of (simulated) trades, and settles profit splits with a high-water-mark. The `TraderProfile` PDA — never the trader's wallet — signs over the deposited funds. **One trader = one profile = one vault.** This is a **program-owned vault: the TraderProfile PDA signs, and there is no admin escape hatch** that can move depositor funds to an arbitrary destination.

> **v2 architecture — what changed**

The old separate `Vault` account has been **merged into `TraderProfile`**, which now holds all vault state and is the authority over its vault USDC token account. The account set is exactly **4 custom PDAs** (`PlatformConfig`, `TraderProfile`, `InvestorAccount`, `InvestorPosition`) and there are **10 instruction handlers**. Shares are **data in `InvestorPosition` (a `u64`), never a Token mint**. There is **no** ban, slashing, strikes, alignment stake, first-loss or earn-in: a trader simply funds their own vault via the ordinary `deposit` (own capital, exempt from the capacity cap, withdrawable normally, tracked as `trader_shares`) to trade until investors join.

### What this MVP includes / excludes

| In scope (MVP + investor deposits) | Deferred to v2 (stub only) |
| --- | --- |
| Investor deposits, shares (data) & NAV accounting; One investor funding multiple traders via multiple `InvestorPosition` PDAs under one `InvestorAccount`; Trader self-funds own vault via ordinary `deposit` (own capital, cap-exempt, tracked as `trader_shares`); Simulated trades via `record_trade` (real prices, offchain oracle); Daily/periodic settlement / profit-split with HWM + trader accrual (`trader_claimable`); Capacity cap enforcement on investor deposits; Size-scaled withdrawal notice (request/process); Per-trade notional & leverage guards | Full capacity _ratchet_ (gradual growth) — v2; Compliance / KYC gating onchain — v2; Live `execute_trade` → Flash perps CPI — mainnet; Tiered withdrawal queue with multiple notice tiers — v2 (size-scaled notice only in MVP) |

> **Core architectural decision**

**Trades are simulated on devnet.** The "trade source" is swappable. In MVP, a single `record_trade` instruction handler applies realized PnL computed from _real market prices_ supplied by an offchain `oracle_authority` signer. On **mainnet** this single handler is replaced by `execute_trade`, which performs a CPI to Flash perps. _Everything else in the program — NAV math, shares, settlement, events, accounts — stays identical._

### The program developer's responsibilities

| Priority | Responsibility |
| --- | --- |
| Main | Build, test, and ship the arcadia_vault Anchor program: the 4 PDAs, 10 instruction handlers, NAV/shares integer math, simulated trade recording, settlement, capacity enforcement, and security invariants. |
| Integration | Emit the exact Anchor events defined in §10 so the indexer can decode them without guesswork. |
| Integration | Expose a stable IDL + instruction/account shapes (§10) so the frontend can build transactions and decode accounts. |
| Cross-team | The indexer computes score/capacity/tier offchain and pushes them in via set_capacity (signed by oracle_authority ). The program does not compute scores, and the exponential capacity ceiling lives offchain. |

## 2. Anchor Project Structure, Program ID & PDA Seeds

### Repository layout (Anchor 1.0.2 convention)

Handlers live under `instructions/`, account structs under `state/`, the named error enum in `error.rs`, and admin-only handlers under `instructions/admin/`. Account-constraints structs are named distinctly from the handler function (a struct cannot do things), e.g. the `deposit` handler uses a `DepositAccountConstraints` struct.

```toml
// scaffold: anchor init arcadia_vault --package-manager npm --test-template litesvm

arcadia_vault/
├── Anchor.toml                 
# cluster=devnet, program id, wallet

├── Cargo.toml
├── programs/
│   └── arcadia_vault/
│       ├── Cargo.toml          
# features: idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

│       ├── src/
│       │   ├── lib.rs          
# #[program] entrypoints (10 handlers)

│       │   ├── error.rs        
# ArcadiaError named enum

│       │   ├── events.rs       
# emit! event structs

│       │   ├── constants.rs    
# seeds + SHARE_SCALE etc. (see 6a)

│       │   ├── state/
│       │   │   ├── mod.rs
│       │   │   ├── platform_config.rs
│       │   │   ├── trader_profile.rs
│       │   │   ├── investor_account.rs
│       │   │   └── investor_position.rs
│       │   └── instructions/
│       │       ├── mod.rs
│       │       ├── admin/
│       │       │   ├── mod.rs
│       │       │   ├── initialize_platform.rs   
# admin-only

│       │       │   └── set_capacity.rs          
# oracle_authority-only

│       │       ├── initialize_profile.rs
│       │       ├── initialize_investor.rs
│       │       ├── deposit.rs
│       │       ├── withdraw.rs                  
# request_withdraw + process_withdraw

│       │       ├── record_trade.rs              
# mainnet: execute_trade.rs

│       │       ├── settle.rs
│       │       └── trader_withdraw_profit.rs
│       └── tests/              
# LiteSVM Rust tests (include_bytes! the .so)

│           ├── common/mod.rs
│           ├── deposit.rs
│           ├── trade.rs
│           ├── withdraw.rs
│           └── settle.rs
└── migrations/deploy.ts
```

### Program ID & cluster

```toml
// Anchor.toml

[programs.devnet]
arcadia_vault = 
"Arcad1aVau1t11111111111111111111111111111111"
  
# placeholder; replace with `anchor keys list`


[provider]
cluster = 
"devnet"

wallet  = 
"~/.config/solana/id.json"



// lib.rs


declare_id!
(
"Arcad1aVau1t11111111111111111111111111111111"
);
```

### PDA seeds (4 custom PDAs)

Every account is bound with seeds and/or `has_one`. Per-user records include the signer key in their seeds. The `InvestorPosition` additionally stores the `TraderProfile` pubkey and validates it (instance discriminator) so an account from one vault cannot be passed to another. The USDC mint is bound with `has_one` everywhere balances are read.

| PDA | Seeds | Notes |
| --- | --- | --- |
| PlatformConfig | [b"platform"] | Singleton. Holds admin, oracle_authority, treasury token account, USDC mint, and fee bps. Created once by admin. |
| TraderProfile | [b"profile", trader.key().as_ref()] | One profile per trader — this PDA is the vault and is the authority over its vault_token account. Holds all vault state. has_one = base_mint . |
| InvestorAccount | [b"investor", wallet.key().as_ref()] | One per depositor wallet (investor OR a trader funding their own vault). Main account; tracks position_count + lifetime deposits. |
| InvestorPosition | [b"position", wallet.key().as_ref(), profile.key().as_ref()] | One per (investor × trader). Holds shares:u64 (data, never a Token mint) and profile:Pubkey bound by has_one = profile . One investor funds many traders via many of these under one InvestorAccount . |

Plus Token accounts that are **not** custom PDAs: a per-profile vault USDC token account whose authority is the `TraderProfile` PDA, and the platform treasury token account referenced by `PlatformConfig`. Both are `InterfaceAccount<'info, TokenAccount>` so the program works unchanged against the Classic Token Program and the Token Extensions Program.

> **Constants (full list in §6a)**

`SHARE_SCALE = 1_000_000` · USDC decimals = 6 · `BPS_DENOMINATOR = 10_000` · `SECONDS_PER_YEAR = 31_557_600` · `PLATFORM_PERF_FEE_BPS = 500` (5%) · `PLATFORM_MGMT_FEE_BPS = 100` (1%/yr) · `MAX_NOTIONAL_BPS = 2000` (20% of AUM per trade) · `INSTANT_WITHDRAW_BPS = 500` (<5% of AUM withdraws instant next tick).

## 3. Account Structs & Space Sizing

**Account count: 4 custom PDAs.** Every struct derives `#[derive(InitSpace)]`, carries a `pub bump: u8` (saved at init via `ctx.bumps.<name>`), and is allocated with `space = MyStruct::DISCRIMINATOR.len() + MyStruct::INIT_SPACE` — **no magic numbers and no hand-counted size constants.** There are no `String`/`Vec` fields here; if one were added it would carry `#[max_len(N)]`.

```rust
// state/platform_config.rs


use
 anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]

pub struct
 
PlatformConfig
 {        
// singleton, seed ["platform"]

    
pub
 admin:            
Pubkey
,    
// one-time initializer / governance

    
pub
 oracle_authority: 
Pubkey
,    
// offchain price/score signer

    
pub
 treasury_token:   
Pubkey
,    
// platform USDC token account (fees in / devnet top-up out)

    
pub
 base_mint:        
Pubkey
,    
// devnet USDC mint, bound by has_one everywhere

    
pub
 perf_fee_bps:     
u16
,       
// platform performance fee = 500 (5%)

    
pub
 mgmt_fee_bps:     
u16
,       
// management fee = 100 (1%/yr)

    
pub
 bump:             
u8
,        
// PDA bump, saved at init

}


// state/trader_profile.rs — seed ["profile", trader]; IS the vault & authority of vault_token

#[account]
#[derive(InitSpace)]

pub struct
 
TraderProfile
 {
    
pub
 trader:           
Pubkey
,    
// owner / operator (stored authority for withdraws)

    
pub
 base_mint:        
Pubkey
,    
// devnet USDC mint (has_one)

    
pub
 vault_token:      
Pubkey
,    
// vault USDC token account (authority = this PDA)

    
pub
 total_shares:     
u64
,       
// all shares outstanding (investor + trader)

    
pub
 trader_shares:    
u64
,       
// shares from the trader's own-capital deposits

    
pub
 hwm_per_share:    
u64
,       
// SHARE_SCALE-scaled high-water mark; init 1_000_000

    
pub
 capacity_cap_usd: 
u64
,       
// max investor AUM allowed (USDC minor units), pushed by oracle

    
pub
 trader_claimable: 
u64
,       
// accrued perf fee earmarked for trader (USDC minor units, EXCLUDED from NAV)

    
pub
 last_settle_ts:   
i64
,       
// unix ts of last settle()

    
pub
 created_at:       
i64
,       
// unix ts of initialize_profile

    
pub
 status:           
u8
,        
// 0 active, 1 closed

    
pub
 score_tier:       
u8
,        
// 0 Verified / 1 Established / 2 Advanced / 3 Elite / 255 not fundable

    
pub
 max_leverage:     
u8
,        
// leverage cap (whole x)

    
pub
 bump:             
u8
,        
// PDA bump, saved at init

}

// NOTE: nav_per_share is NOT stored. It is DERIVED on read from the vault


// token balance: nav_per_share = (total_assets - trader_claimable) * SHARE_SCALE / total_shares.


// total_assets = the vault_token account amount (USDC minor units). See 6a.



// state/investor_account.rs — seed ["investor", wallet]; main account

#[account]
#[derive(InitSpace)]

pub struct
 
InvestorAccount
 {
    
pub
 owner:               
Pubkey
, 
// the depositor wallet

    
pub
 position_count:      
u32
,    
// number of InvestorPosition PDAs opened

    
pub
 total_deposited_usd: 
u64
,    
// lifetime deposits across all traders (USDC minor units)

    
pub
 created_at:          
i64
,    
// unix ts

    
pub
 bump:                
u8
,     
// PDA bump, saved at init

}


// state/investor_position.rs — seed ["position", wallet, profile]; one per investor x trader

#[account]
#[derive(InitSpace)]

pub struct
 
InvestorPosition
 {
    
pub
 owner:                   
Pubkey
, 
// depositor wallet (in seeds)

    
pub
 profile:                 
Pubkey
, 
// the TraderProfile funded; validated via has_one = profile

    
pub
 shares:                  
u64
,    
// shares held (DATA, never a Token mint)

    
pub
 cost_basis_usd:          
u64
,    
// USDC minor units paid in (for early-investor edge / PnL)

    
pub
 pending_withdraw_shares: 
u64
,    
// shares queued for withdrawal

    
pub
 withdraw_ready_ts:       
i64
,    
// earliest process_withdraw ts

    
pub
 deposited_at:            
i64
,    
// ts of (last) deposit

    
pub
 bump:                    
u8
,     
// PDA bump, saved at init

}
```

The allocation constraint for each is, for example:

```rust
#[account(
    init,
    payer = trader,
    seeds = [
b"profile"
, trader.key().as_ref()],
    bump,
    space = TraderProfile::DISCRIMINATOR.len() + TraderProfile::INIT_SPACE,
)]

pub
 profile: 
Account
<
'info
, 
TraderProfile
>,
```

| Account | Allocation | Bump | Binding |
| --- | --- | --- | --- |
| PlatformConfig | DISCRIMINATOR.len() + INIT_SPACE | bump saved | seeds ["platform"] |
| TraderProfile | DISCRIMINATOR.len() + INIT_SPACE | bump saved | seeds + has_one = base_mint |
| InvestorAccount | DISCRIMINATOR.len() + INIT_SPACE | bump saved | seeds include wallet |
| InvestorPosition | DISCRIMINATOR.len() + INIT_SPACE | bump saved | seeds include wallet + profile ; has_one = profile |

Shares live only inside `InvestorPosition.shares` and the aggregate `TraderProfile.total_shares`; there is no share mint and no Token share token anywhere in the program. NAV per share is never stored: it is derived from the live vault token balance on every read (see §6a), which makes total-asset conservation trivially checkable.

## 4. Instruction-by-Instruction Specification

**Instruction-handler count: 10.** Each handler below lists its accounts, instruction inputs, checks, step-by-step logic, errors, and the event emitted, with Rust-flavoured pseudocode. Conventions: account-constraints structs are named distinctly from the handler (e.g. `DepositAccountConstraints`); all token CPIs use `transfer_checked` (carrying the USDC mint + 6 decimals) through `anchor_spl::token_interface`; all arithmetic is `checked_*` with `u128` intermediates, multiply-before-divide, floor rounding; state is updated **before** the transfer CPI (checks-effects-interactions). Helper reads: `total_assets` = the vault token account `amount` (USDC minor units); `nav_per_share()` and `aum()` are defined in §6a.

### 4.1 initialize_platform admin-only

initialize_platform(perf_fee_bps: u16, mgmt_fee_bps: u16, oracle_authority: Pubkey)

Admin creates the singleton `PlatformConfig`. Handler lives in `instructions/admin/`. Called **once**. Validates the fee configuration at initialize time.

| Accounts ( InitializePlatformAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| admin (Signer) | mut | Pays rent; becomes config.admin . |
| config | init | PDA [b"platform"] ; space = PlatformConfig::DISCRIMINATOR.len() + PlatformConfig::INIT_SPACE . |
| base_mint ( InterfaceAccount<Mint> ) | — | devnet USDC mint, recorded in config. |
| treasury_token ( InterfaceAccount<TokenAccount> ) | — | Platform USDC token account; token::mint = base_mint . |
| system_program | — | CPI dep. |

#### Checks (config validation)

- `perf_fee_bps <= BPS_DENOMINATOR` and `mgmt_fee_bps <= BPS_DENOMINATOR`.
- Fees do not combine unsafely: `perf_fee_bps + MAX_TIER_BPS (3500) <= BPS_DENOMINATOR (10_000)` so the trader cut plus the platform performance fee can never exceed 100% of crystallized profit → else `InvalidFeeConfig`.

#### Logic

```
require!
(perf_fee_bps <= BPS_DENOMINATOR, ArcadiaError::InvalidFeeConfig);

require!
(mgmt_fee_bps <= BPS_DENOMINATOR, ArcadiaError::InvalidFeeConfig);

require!
((perf_fee_bps as u32 + MAX_TIER_BPS as u32) <= BPS_DENOMINATOR as u32, ArcadiaError::InvalidFeeConfig);

config.admin            = admin.key();
config.oracle_authority = oracle_authority;
config.treasury_token   = treasury_token.key();
config.base_mint        = base_mint.key();
config.perf_fee_bps     = perf_fee_bps;   
// 500

config.mgmt_fee_bps     = mgmt_fee_bps;   
// 100

config.bump             = ctx.bumps.config;
```

**Errors:** `InvalidFeeConfig` (re-init blocked by Anchor `init`). **Event:** none (MVP).

### 4.2 initialize_profile

initialize_profile(max_leverage: u8)

Trader opens their profile/vault. The HWM starts at par (`SHARE_SCALE = 1_000_000`). The profile PDA becomes the authority of its `vault_token` account.

| Accounts ( InitializeProfileAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| trader (Signer) | mut | Pays rent; becomes profile.trader (the stored authority). |
| config | — | has_one = base_mint ; oracle_authority stored on platform, not per-profile. |
| profile | init | PDA [b"profile", trader] ; has_one = base_mint . |
| base_mint ( InterfaceAccount<Mint> ) | — | devnet USDC mint; must equal config.base_mint . |
| vault_token ( InterfaceAccount<TokenAccount> ) | init | token::mint = base_mint , token::authority = profile . |
| system_program / token_program (Interface<TokenInterface>) / rent | — | CPI deps. |

#### Checks

- `max_leverage > 0` and `max_leverage <= MAX_LEVERAGE_CEILING (50)` → else `InvalidLeverage`.
- PDA not already initialized (Anchor `init` enforces).

#### Logic

```
let
 now = Clock::get()?.unix_timestamp;
profile.trader           = trader.key();
profile.base_mint        = base_mint.key();
profile.vault_token      = vault_token.key();
profile.total_shares     = 
0
;
profile.trader_shares    = 
0
;
profile.hwm_per_share    = SHARE_SCALE;     
// 1_000_000 (par)

profile.capacity_cap_usd = 
0
;             
// 0 until set_capacity; investor deposits blocked

profile.trader_claimable = 
0
;
profile.status           = 
0
;             
// active

profile.score_tier       = 
255
;           
// not fundable until scored (<600)

profile.max_leverage     = max_leverage;
profile.last_settle_ts   = now;
profile.created_at       = now;
profile.bump             = ctx.bumps.profile;
emit!(ProfileInitialized { profile: profile.key(), trader: trader.key(), ts: now });
```

**Errors:** `InvalidLeverage`. **Event:** `ProfileInitialized`.

> **Offchain math**

### 4.3 set_capacity oracle_authority-only

set_capacity(cap_usd: u64, score_tier: u8)

The **indexer** computes the risk score, capacity ceiling, and tier offchain and pushes them in. The exponential capacity formula `e^(...)` is NOT computable onchain, so `capacity_cap_usd` is a plain `u64` (USDC minor units) PUSHED here. Handler lives in `instructions/admin/`. **Only `oracle_authority`** may call this.

| Accounts ( SetCapacityAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| oracle_authority (Signer) | — | Must equal config.oracle_authority ( has_one ). |
| config | — | has_one = oracle_authority . |
| profile | mut |  |

#### Checks

- `oracle_authority.key() == config.oracle_authority` (via `has_one`) → else `Unauthorized`.
- `score_tier <= 3 || score_tier == 255` → else `InvalidTier`.
- `profile.status == 0` (active).

#### Logic

```
profile.capacity_cap_usd = cap_usd;     
// USDC minor units, exponential ceiling computed offchain

profile.score_tier       = score_tier;

// score_tier: 0 Verified(600), 1 Established(700), 2 Advanced(800), 3 Elite(900), 255 not fundable (<600)
```

The capacity ceiling uses `capacity_cap_usd = base * e^(k * score)` which an onchain program cannot evaluate. The indexer computes the exponential and pushes the resulting plain `u64` here. The full capacity _ratchet_ (only allow gradual, time-gated increases) is deferred to v2; MVP trusts the oracle's computed value directly.

**Errors:** `Unauthorized`, `InvalidTier`. **Event:** none (MVP; indexer already knows what it pushed).

### 4.4 initialize_investor

initialize_investor()

Any depositor (an investor, OR a trader funding their own vault) creates their `InvestorAccount` once. This is the "main" account under which one or many `InvestorPosition` PDAs (one per trader) hang.

| Accounts ( InitializeInvestorAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| wallet (Signer) | mut | Pays rent; becomes account.owner ; in seeds. |
| investor_account | init | PDA [b"investor", wallet] . |
| system_program | — |  |

#### Logic

```
let
 now = Clock::get()?.unix_timestamp;
investor_account.owner               = wallet.key();
investor_account.position_count      = 
0
;
investor_account.total_deposited_usd = 
0
;
investor_account.created_at          = now;
investor_account.bump                = ctx.bumps.investor_account;
emit!(InvestorInitialized { investor: investor_account.key(), ts: now });
```

**Errors:** re-init blocked by Anchor `init`. **Event:** `InvestorInitialized`.

> **Donation-attack mitigation**

### 4.5 deposit

deposit(amount: u64)

A depositor deposits USDC into a trader's vault and is minted shares (as data) against the current NAV. The `InvestorPosition` for `(depositor, profile)` is lazily initialized on first deposit. If the depositor is **the trader funding their own vault**, the deposit is **exempt from the capacity cap** and also bumps `trader_shares`. Otherwise it is **rejected if it would exceed capacity.** This is a single-asset (USDC) vault, so it uses the linear share formula (NOT the two-asset AMM geometric mean).

| Accounts ( DepositAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| depositor (Signer) | mut | Pays position rent on first deposit; in position seeds. |
| investor_account | mut | PDA [b"investor", depositor] ; bumps position_count/total. |
| profile | mut | The vault; has_one = base_mint , has_one = vault_token . |
| position | init_if_needed | PDA [b"position", depositor, profile] ; has_one = profile . |
| base_mint ( InterfaceAccount<Mint> ) | — | Carries decimals for transfer_checked ; bound by has_one . |
| vault_token ( InterfaceAccount<TokenAccount> ) | mut | Destination; token::mint = base_mint . |
| depositor_token ( InterfaceAccount<TokenAccount> ) | mut | Source; token::mint = base_mint , token::authority = depositor . |
| token_program (Interface<TokenInterface>) / system_program | — |  |

#### Checks (range validation)

- `profile.status == 0` (active) → else `VaultNotActive`.
- `amount > 0` → else `ZeroAmount`.
- `amount <= depositor_token.amount` → else `InsufficientFunds`.
- Resulting `shares_minted > 0` → else `DustDeposit` (blocks the empty-vault inflation/donation attack).
- If `depositor != profile.trader`: capacity must be set and `(total_assets + amount) <= capacity_cap_usd`. Trader own-capital is exempt.

#### Logic (state before transfer; floor rounding)

```
let
 now = Clock::get()?.unix_timestamp;

let
 is_trader = depositor.key() == profile.trader;

let
 total_assets = vault_token.amount;          
// u64, USDC minor units (BEFORE this deposit)



// capacity: investor deposits only; trader own-capital is EXEMPT


if
 !is_trader {
    
require!
(profile.capacity_cap_usd > 
0
, ArcadiaError::CapacityNotSet);
    
let
 after = total_assets.checked_add(amount).ok_or(ArcadiaError::MathOverflow)?;
    
require!
(after <= profile.capacity_cap_usd, ArcadiaError::CapacityExceeded);
}


// SINGLE-ASSET share mint (NOT sqrt(a*b)). Multiply BEFORE divide; u128; floor.


let
 shares_minted: u64 = 
if
 profile.total_shares == 
0
 {
    amount                                       
// first deposit: shares == amount

} 
else
 {
    
let
 num = (amount as u128)
        .checked_mul(profile.total_shares as u128).ok_or(ArcadiaError::MathOverflow)?;
    
let
 s = num.checked_div(total_assets as u128).ok_or(ArcadiaError::MathOverflow)?; 
// floor

    s.try_into().map_err(|_| ArcadiaError::MathOverflow)?
};

require!
(shares_minted > 
0
, ArcadiaError::DustDeposit);   
// donation-attack guard



// EFFECTS (state) BEFORE INTERACTION (transfer)

profile.total_shares = profile.total_shares.checked_add(shares_minted).ok_or(ArcadiaError::MathOverflow)?;

if
 is_trader {
    profile.trader_shares = profile.trader_shares.checked_add(shares_minted).ok_or(ArcadiaError::MathOverflow)?;
}

let
 fresh = position.shares == 
0
;
position.owner          = depositor.key();
position.profile        = profile.key();
position.shares         = position.shares.checked_add(shares_minted).ok_or(ArcadiaError::MathOverflow)?;
position.cost_basis_usd = position.cost_basis_usd.checked_add(amount).ok_or(ArcadiaError::MathOverflow)?;
position.deposited_at   = now;
position.bump           = ctx.bumps.position;
investor_account.total_deposited_usd =
    investor_account.total_deposited_usd.checked_add(amount).ok_or(ArcadiaError::MathOverflow)?;

if
 fresh { investor_account.position_count += 
1
; }


// INTERACTION: transfer_checked carries mint + 6 decimals; depositor signs

transfer_checked(
    CpiContext::new(token_program, TransferChecked {
        from: depositor_token, mint: base_mint, to: vault_token, authority: depositor,
    }),
    amount, base_mint.decimals,   
// 6

)?;


// token conservation: vault_token.amount increased by exactly `amount`

emit!(Deposited {
    profile: profile.key(), depositor: depositor.key(), is_trader,
    amount_usd: amount, shares_minted, ts: now
});
```

**Errors:** `VaultNotActive`, `ZeroAmount`, `InsufficientFunds`, `CapacityNotSet`, `CapacityExceeded`, `DustDeposit`, `MathOverflow`. **Event:** `Deposited`.

The first deposit (where `total_shares == 0 → shares_minted = amount`) is made by the **trader funding their own vault**, so an attacker cannot grief an empty vault by donating tokens before the first investor. The `shares_minted > 0` reject closes the rounding/inflation vector for all later deposits. An optional virtual-shares offset (add a fixed constant to `total_shares` and `total_assets` in the ratio) can be enabled in v2 for belt-and-braces protection.

> **Withdrawal policy**

### 4.6 request_withdraw / process_withdraw

request_withdraw(shares: u64) | process_withdraw()

Two-step, **size-scaled notice**. Investors may withdraw _any portion at any time_ at the prevailing NAV. Small exits (value < 5% of AUM, i.e. `INSTANT_WITHDRAW_BPS = 500`) are instant on the next tick; larger exits wait for the next daily settlement window. No lockups, penalties, or forced redemption.

#### request_withdraw — accounts (`RequestWithdrawAccountConstraints`)

| Account | Mut? | Notes |
| --- | --- | --- |
| owner (Signer) | — | Must own the position (in seeds); stored authority check. |
| profile | — | has_one = vault_token, has_one = base_mint ; reads NAV / AUM. |
| vault_token ( InterfaceAccount<TokenAccount> ) | — | Read for total_assets . |
| position | mut | has_one = profile (validates the right vault). |

#### request_withdraw — checks & logic

```
require!
(shares > 
0
, ArcadiaError::ZeroAmount);

require!
(shares <= position.shares, ArcadiaError::InsufficientShares);


let
 now = Clock::get()?.unix_timestamp;

let
 total_assets = vault_token.amount;

let
 nav_excl     = total_assets.checked_sub(profile.trader_claimable).ok_or(ArcadiaError::MathOverflow)?;


// value of this withdrawal and current AUM both exclude trader_claimable


// withdraw_value = shares * nav_excl / total_shares  (u128, floor)


let
 withdraw_value = (shares as u128)
    .checked_mul(nav_excl as u128).ok_or(ArcadiaError::MathOverflow)?
    .checked_div(profile.total_shares as u128).ok_or(ArcadiaError::MathOverflow)?;

let
 aum = nav_excl as u128;   
// AUM == total NAV-bearing assets


position.pending_withdraw_shares =
    position.pending_withdraw_shares.checked_add(shares).ok_or(ArcadiaError::MathOverflow)?;


// <5% of AUM -> instant next tick; else next daily settlement window.


// compare withdraw_value * 10_000  <  aum * 500   (INSTANT_WITHDRAW_BPS)


let
 lhs = withdraw_value.checked_mul(BPS_DENOMINATOR as u128).ok_or(ArcadiaError::MathOverflow)?;

let
 rhs = aum.checked_mul(INSTANT_WITHDRAW_BPS as u128).ok_or(ArcadiaError::MathOverflow)?;
position.withdraw_ready_ts = 
if
 lhs < rhs { now } 
else
 { next_daily_settlement_window(now) };

emit!(WithdrawRequested {
    profile: profile.key(), owner: owner.key(),
    shares, withdraw_ready_ts: position.withdraw_ready_ts
});
```

#### process_withdraw — accounts (`ProcessWithdrawAccountConstraints`)

| Account | Mut? | Notes |
| --- | --- | --- |
| owner (Signer) | — | In seeds; the verified caller. |
| profile | mut | Signs token-out via PDA seeds; has_one = vault_token, base_mint . |
| position | mut | has_one = profile . Closed (rent to owner) when shares hit 0. |
| base_mint ( InterfaceAccount<Mint> ) | — | Decimals for transfer_checked . |
| vault_token ( InterfaceAccount<TokenAccount> ) | mut | Source. |
| owner_token ( InterfaceAccount<TokenAccount> ) | mut | Destination; token::authority = owner . |
| token_program (Interface<TokenInterface>) | — |  |

#### process_withdraw — checks & logic

```
require!
(position.pending_withdraw_shares > 
0
, ArcadiaError::NothingPending);

let
 now = Clock::get()?.unix_timestamp;

require!
(now >= position.withdraw_ready_ts, ArcadiaError::NoticeNotElapsed);


let
 burn = position.pending_withdraw_shares;

let
 total_assets = vault_token.amount;

let
 nav_excl     = total_assets.checked_sub(profile.trader_claimable).ok_or(ArcadiaError::MathOverflow)?;


// assets_out = burn * (total_assets - trader_claimable) / total_shares  (u128, floor)


let
 assets_out: u64 = (burn as u128)
    .checked_mul(nav_excl as u128).ok_or(ArcadiaError::MathOverflow)?
    .checked_div(profile.total_shares as u128).ok_or(ArcadiaError::MathOverflow)?
    .try_into().map_err(|_| ArcadiaError::MathOverflow)?;

require!
(assets_out <= total_assets, ArcadiaError::InsufficientVaultLiquidity);


// EFFECTS before INTERACTION

profile.total_shares = profile.total_shares.checked_sub(burn).ok_or(ArcadiaError::MathOverflow)?;

if
 owner.key() == profile.trader {
    profile.trader_shares = profile.trader_shares.saturating_sub(burn);
}
position.shares = position.shares.checked_sub(burn).ok_or(ArcadiaError::MathOverflow)?;
position.pending_withdraw_shares = 
0
;


// INTERACTION: signed by profile PDA seeds


let
 seeds: &[&[u8]] = &[
b"profile"
, profile.trader.as_ref(), &[profile.bump]];
transfer_checked(
    CpiContext::new_with_signer(token_program, TransferChecked {
        from: vault_token, mint: base_mint, to: owner_token, authority: profile.to_account_info(),
    }, &[seeds]),
    assets_out, base_mint.decimals,   
// 6

)?;

emit!(Withdrawn {
    profile: profile.key(), owner: owner.key(),
    shares_burned: burn, amount_usd: assets_out
});
```

Any portion, anytime; prevailing NAV; value < 5% of AUM (`INSTANT_WITHDRAW_BPS = 500`) is instant on the next tick, otherwise the next daily settlement window. No lockups, no penalties, no forced redemption. Withdrawers receive the floor of the share-value (rounding favours the vault). The trader's own-capital position withdraws by the same rules (and reduces `trader_shares`).

**Errors:** `ZeroAmount`, `InsufficientShares`, `NothingPending`, `NoticeNotElapsed`, `InsufficientVaultLiquidity`, `MathOverflow`. **Events:** `WithdrawRequested` (on request), `Withdrawn` (on process).

> **Mainnet swap**

### 4.7 record_trade simulated trade source

record_trade(market: String, direction: u8, size_usd: u64, leverage_x100: u16, entry_px: u64, exit_px: u64, fees_usd: u64, was_liquidated: bool, opened_at: i64, closed_at: i64)

Applies the realized PnL of a closed (simulated) position to the vault. **Dual-signed by `oracle_authority` (attests real prices) AND `trader` (authorizes the trade).** Because NAV is derived from the vault token balance, realized PnL is applied by an actual `transfer_checked` of USDC into or out of the vault (devnet: against the treasury). See §5 for the full model. (The `market` String is an event field only; if it were stored it would carry `#[max_len(N)]`.)

| Accounts ( RecordTradeAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| trader (Signer) | — | == profile.trader (stored authority). |
| oracle_authority (Signer) | — | == config.oracle_authority ( has_one ). |
| config | — | has_one = oracle_authority, has_one = treasury_token, has_one = base_mint . |
| profile | mut | The vault; has_one = trader, vault_token, base_mint . |
| base_mint ( InterfaceAccount<Mint> ) | — | Decimals for transfer_checked . |
| vault_token ( InterfaceAccount<TokenAccount> ) | mut | Gain destination / loss source. |
| treasury_token ( InterfaceAccount<TokenAccount> ) | mut | devnet only gain source / loss destination. |
| treasury_authority (Signer) | — | devnet only signs the gain top-up (= oracle_authority in practice). |
| token_program (Interface<TokenInterface>) | — |  |

#### Checks (range + guards)

- `trader.key() == profile.trader` && `oracle_authority.key() == config.oracle_authority` → else `Unauthorized`.
- `profile.status == 0` (active); `profile.total_shares > 0` (else NAV undefined → `NoShares`).
- `direction <= 1`; `entry_px > 0`; `exit_px > 0`; `size_usd > 0`; `closed_at >= opened_at` → else `InvalidTradeParams`.
- **Leverage guard:** `leverage_x100 / 100 <= max_leverage` → else `LeverageTooHigh`.
- **Per-trade notional guard:** `size_usd <= total_assets * MAX_NOTIONAL_BPS / BPS_DENOMINATOR` (= 20% of AUM) → else `NotionalTooLarge`.

#### Logic (realized PnL, i128, multiply before divide)

```
let
 total_assets = vault_token.amount;


// notional guard: size_usd <= total_assets * 2000 / 10_000


let
 cap = (total_assets as u128)
    .checked_mul(MAX_NOTIONAL_BPS as u128).ok_or(ArcadiaError::MathOverflow)?
    .checked_div(BPS_DENOMINATOR as u128).ok_or(ArcadiaError::MathOverflow)?;

require!
((size_usd as u128) <= cap, ArcadiaError::NotionalTooLarge);

require!
((leverage_x100 / 
100
) as u8 <= profile.max_leverage, ArcadiaError::LeverageTooHigh);


// dir_sign: long(0)=+1, short(1)=-1


let
 dir_sign: i128 = 
if
 direction == 
0
 { 
1
 } 
else
 { 
-1
 };


// realized_pnl = dir_sign * (size_usd * leverage_x100 * (exit_px - entry_px)) / (entry_px * 100) - fees_usd


// multiply BEFORE divide; entry_px > 0 guaranteed above


let
 px_diff: i128 = exit_px as i128 - entry_px as i128;

let
 gross: i128 = dir_sign
    .checked_mul(size_usd as i128).ok_or(ArcadiaError::MathOverflow)?
    .checked_mul(leverage_x100 as i128).ok_or(ArcadiaError::MathOverflow)?
    .checked_mul(px_diff).ok_or(ArcadiaError::MathOverflow)?
    .checked_div((entry_px as i128).checked_mul(
100
).ok_or(ArcadiaError::MathOverflow)?)
    .ok_or(ArcadiaError::MathOverflow)?;

let
 realized_pnl: i128 = gross.checked_sub(fees_usd as i128).ok_or(ArcadiaError::MathOverflow)?;


// Apply via transfer_checked on devnet (mainnet: derived from Flash CPI, see swap note)


if
 realized_pnl > 
0
 {
    
// gain: treasury -> vault (free devnet USDC keeps the vault token-backed)

    
let
 amt: u64 = (realized_pnl as u128).try_into().map_err(|_| ArcadiaError::MathOverflow)?;
    transfer_checked(
        CpiContext::new(token_program, TransferChecked {
            from: treasury_token, mint: base_mint, to: vault_token, authority: treasury_authority,
        }),
        amt, base_mint.decimals,   
// 6

    )?;
} 
else if
 realized_pnl < 
0
 {
    
// loss: vault -> treasury, bounded by available (NAV-bearing) assets

    
let
 loss: u64 = ((-realized_pnl) as u128).try_into().map_err(|_| ArcadiaError::MathOverflow)?;
    
let
 nav_excl = total_assets.checked_sub(profile.trader_claimable).ok_or(ArcadiaError::MathOverflow)?;
    
let
 applied = loss.min(nav_excl);   
// NAV floored at 0; cannot touch earmarked trader_claimable

    
let
 seeds: &[&[u8]] = &[
b"profile"
, profile.trader.as_ref(), &[profile.bump]];
    transfer_checked(
        CpiContext::new_with_signer(token_program, TransferChecked {
            from: vault_token, mint: base_mint, to: treasury_token, authority: profile.to_account_info(),
        }, &[seeds]),
        applied, base_mint.decimals,
    )?;
}

// total_shares unchanged: a trade reprices existing shares; derived nav_per_share moves.


emit!(TradeClosed {
    profile: profile.key(), trader: profile.trader, market,
    direction, size_usd, leverage_x100, entry_px, exit_px,
    realized_pnl: realized_pnl.try_into().map_err(|_| ArcadiaError::MathOverflow)?, 
// i64

    fees_usd, was_liquidated, opened_at, closed_at
});
```

On mainnet, `record_trade` is replaced by `execute_trade`, which opens/closes a real position via a **CPI to the whitelisted Flash perps program** and derives `entry_px/exit_px/realized_pnl` from the CPI result instead of trusting the oracle. The devnet treasury top-up is removed (real PnL settles in real USDC through the CPI). **Everything downstream — the NAV derivation, events, accounts, settlement — is byte-for-byte identical.**

**Errors:** `Unauthorized`, `VaultNotActive`, `NoShares`, `InvalidTradeParams`, `LeverageTooHigh`, `NotionalTooLarge`, `MathOverflow`. **Event:** `TradeClosed`.

### 4.8 settle

settle()

Periodic (daily/monthly) per profile. Crystallizes profit above the high-water mark into a trader cut (earmarked to `trader_claimable`, kept in the vault token account but EXCLUDED from NAV) and a platform cut (sent to treasury); resets HWM. Optional management-fee accrual is shown. See §7.

| Accounts ( SettleAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| caller (Signer) | — | trader or oracle_authority may trigger. |
| config | — | has_one = treasury_token, base_mint ; perf_fee_bps, mgmt_fee_bps. |
| profile | mut | Signs token-out via PDA seeds; has_one = vault_token, base_mint . |
| base_mint ( InterfaceAccount<Mint> ) | — | Decimals for transfer_checked . |
| vault_token ( InterfaceAccount<TokenAccount> ) | mut | Source for platform + mgmt cut. |
| treasury_token ( InterfaceAccount<TokenAccount> ) | mut | Destination for platform cut (and mgmt accrual). |
| token_program (Interface<TokenInterface>) | — |  |

#### Checks

- caller is `profile.trader` or `config.oracle_authority` → else `Unauthorized`.
- `profile.total_shares > 0` → else `NoShares`.

#### Logic (multiply before divide; floor)

```
let
 now = Clock::get()?.unix_timestamp;

let
 total_assets = vault_token.amount;

let
 nav_excl     = total_assets.checked_sub(profile.trader_claimable).ok_or(ArcadiaError::MathOverflow)?;


// current_nav = (total_assets - trader_claimable) * SHARE_SCALE / total_shares  (u128, floor)


let
 current_nav: u64 = (nav_excl as u128)
    .checked_mul(SHARE_SCALE as u128).ok_or(ArcadiaError::MathOverflow)?
    .checked_div(profile.total_shares as u128).ok_or(ArcadiaError::MathOverflow)?
    .try_into().map_err(|_| ArcadiaError::MathOverflow)?;


// Optional management accrual: mgmt = total_assets * 100 * elapsed / (10_000 * 31_557_600)


let
 elapsed = (now - profile.last_settle_ts).max(
0
) as u128;

let
 mgmt: u64 = (total_assets as u128)
    .checked_mul(config.mgmt_fee_bps as u128).ok_or(ArcadiaError::MathOverflow)?  
// * 100

    .checked_mul(elapsed).ok_or(ArcadiaError::MathOverflow)?
    .checked_div((BPS_DENOMINATOR as u128) * (SECONDS_PER_YEAR as u128)).ok_or(ArcadiaError::MathOverflow)? 
// /(10_000*31_557_600)

    .try_into().map_err(|_| ArcadiaError::MathOverflow)?;


// NO performance fees when current_nav <= hwm_per_share


if
 current_nav > profile.hwm_per_share {
    
let
 per_share_gain = (current_nav - profile.hwm_per_share) as u128;
    
// profit_assets = (current_nav - hwm_per_share) * total_shares / SHARE_SCALE  (floor)

    
let
 profit_assets: u64 = per_share_gain
        .checked_mul(profile.total_shares as u128).ok_or(ArcadiaError::MathOverflow)?
        .checked_div(SHARE_SCALE as u128).ok_or(ArcadiaError::MathOverflow)?
        .try_into().map_err(|_| ArcadiaError::MathOverflow)?;

    
let
 tier_bps = tier_bps(profile.score_tier);   
// 2000/2500/3000/3500

    
// trader_cut = profit_assets * tier_bps / 10_000   (floor)

    
let
 trader_cut: u64 = (profit_assets as u128)
        .checked_mul(tier_bps as u128).ok_or(ArcadiaError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128).ok_or(ArcadiaError::MathOverflow)?
        .try_into().map_err(|_| ArcadiaError::MathOverflow)?;
    
// platform_cut = profit_assets * 500 / 10_000   (floor)

    
let
 platform_cut: u64 = (profit_assets as u128)
        .checked_mul(config.perf_fee_bps as u128).ok_or(ArcadiaError::MathOverflow)?  
// * 500

        .checked_div(BPS_DENOMINATOR as u128).ok_or(ArcadiaError::MathOverflow)?
        .try_into().map_err(|_| ArcadiaError::MathOverflow)?;

    
// EFFECTS: trader cut earmarked (excluded from NAV); platform cut leaves the vault

    profile.trader_claimable = profile.trader_claimable.checked_add(trader_cut).ok_or(ArcadiaError::MathOverflow)?;

    
let
 seeds: &[&[u8]] = &[
b"profile"
, profile.trader.as_ref(), &[profile.bump]];
    transfer_checked(
        CpiContext::new_with_signer(token_program, TransferChecked {
            from: vault_token, mint: base_mint, to: treasury_token, authority: profile.to_account_info(),
        }, &[seeds]),
        platform_cut, base_mint.decimals,
    )?;

    
// hwm_per_share = current_nav (reset AFTER crystallization)

    profile.hwm_per_share = current_nav;
    profile.last_settle_ts = now;
    emit!(Settled { profile: profile.key(), profit_usd: profit_assets, trader_cut, platform_cut,
                    hwm_per_share: profile.hwm_per_share });
} 
else
 {
    
// no profit: no performance fee, no event

    profile.last_settle_ts = now;
}
```

The platform cut physically leaves the vault to the treasury immediately. The trader cut stays as USDC inside the vault token account but is now _earmarked_ as `trader_claimable` and **excluded from NAV**, so investors' NAV reflects only the profit they actually keep. The trader cut is pulled out separately by `trader_withdraw_profit`. HWM is reset to the post-crystallization `current_nav`. (The optional management accrual transfer `mgmt` vault → treasury can be applied on the same PDA-signed path; it is shown above and omitted from the worked example for clarity.)

**Errors:** `Unauthorized`, `NoShares`, `MathOverflow`. **Event:** `Settled` (only when `current_nav > hwm_per_share`).

### 4.9 trader_withdraw_profit

trader_withdraw_profit(amount: u64)

The trader pulls some or all of their earmarked performance fee (`trader_claimable`) out of the vault to their own wallet. This is separate from the trader's own-capital investor position (which withdraws via the normal withdraw path). Every withdraw verifies the caller against the stored owner (Signer + `profile.trader`).

| Accounts ( TraderWithdrawProfitAccountConstraints ) | Mut? | Notes |
| --- | --- | --- |
| trader (Signer) | — | == profile.trader (stored authority; has_one = trader ). |
| profile | mut | Signs token-out via PDA seeds; has_one = vault_token, base_mint . |
| base_mint ( InterfaceAccount<Mint> ) | — | Decimals for transfer_checked . |
| vault_token ( InterfaceAccount<TokenAccount> ) | mut | Source. |
| trader_token ( InterfaceAccount<TokenAccount> ) | mut | Destination; token::authority = trader . |
| token_program (Interface<TokenInterface>) | — |  |

#### Checks

- `trader.key() == profile.trader` (via `has_one`) → else `Unauthorized`.
- `amount > 0` → else `ZeroAmount`.
- `amount <= profile.trader_claimable` → else `InsufficientClaimable`.

#### Logic

```
require!
(amount > 
0
, ArcadiaError::ZeroAmount);

require!
(amount <= profile.trader_claimable, ArcadiaError::InsufficientClaimable);

require!
(amount <= vault_token.amount, ArcadiaError::InsufficientVaultLiquidity);


// EFFECTS before INTERACTION

profile.trader_claimable = profile.trader_claimable.checked_sub(amount).ok_or(ArcadiaError::MathOverflow)?;


let
 seeds: &[&[u8]] = &[
b"profile"
, profile.trader.as_ref(), &[profile.bump]];
transfer_checked(
    CpiContext::new_with_signer(token_program, TransferChecked {
        from: vault_token, mint: base_mint, to: trader_token, authority: profile.to_account_info(),
    }, &[seeds]),
    amount, base_mint.decimals,
)?;
emit!(ProfitWithdrawn { profile: profile.key(), trader: profile.trader, amount_usd: amount });
```

Because the trader cut was earmarked out of NAV at settle time (it is excluded via `trader_claimable`), paying it out here does not move NAV — it merely drains the USDC that was earmarked. `nav_per_share` is derived from `(total_assets - trader_claimable)`, and this handler decreases both by exactly `amount`.

**Errors:** `Unauthorized`, `ZeroAmount`, `InsufficientClaimable`, `InsufficientVaultLiquidity`, `MathOverflow`. **Event:** `ProfitWithdrawn`.

## 5. The Simulated-Trade Model In Depth (`record_trade`)

### 5.1 Why & how it is simulated

On devnet there is no real perps venue and no real capital at risk, but Arcadia's whole value proposition is a reputation built from _real_ trades. The bridge: an offchain `oracle_authority` watches real markets, computes the realized PnL of a position using **real entry/exit prices**, and submits it via `record_trade`. The program does not invent prices; it trusts a co-signing oracle that the platform controls.

### 5.2 The dual-signature requirement

`record_trade` requires **two signers**:

- **`trader`** — authorizes that this trade belongs to them and was their decision (this is what builds reputation; the trader can never spoof prices).
- **`oracle_authority`** — attests that `entry_px`, `exit_px`, and the other market facts are real. Without the oracle's signature the trader cannot fabricate a profit.

This separation is the core integrity mechanism: the trader controls _what_ was traded; the oracle controls _at what price_. Neither alone can move the vault dishonestly.

### 5.3 The realized-PnL formula (integers, i128, multiply before divide)

```
dir_sign     = (direction == 0) ? +1 : -1            
// long / short

realized_pnl = dir_sign * (size_usd * leverage_x100 * (exit_px - entry_px))
                          / (entry_px * 100)
             - fees_usd
```

All intermediate arithmetic uses `i128` with `checked_*` to prevent overflow, multiplies before dividing, then narrows the result to `i64` for the event via `try_into().map_err(|_| ArcadiaError::MathOverflow)?`. `leverage_x100` carries leverage × 100 (so 3.50× is `350`); dividing by 100 inside the formula keeps the leverage integral. `entry_px > 0` is checked before the divide. `was_liquidated` is informational for the indexer/scoring; the PnL it produces is already encoded in `exit_px`.

### 5.4 The two per-trade guards

- **Leverage guard:** `leverage_x100 / 100 <= max_leverage` — the trade cannot exceed the leverage cap set at profile init.
- **Notional guard:** `size_usd <= total_assets * MAX_NOTIONAL_BPS / BPS_DENOMINATOR` = `total_assets * 2000 / 10_000` (20% of AUM) — a single trade can never risk more than one-fifth of the vault's assets.

### 5.5 How PnL reaches NAV

NAV is **not stored**; it is derived from the live vault token balance: `nav_per_share = (total_assets - trader_claimable) * SHARE_SCALE / total_shares`. Realized PnL is therefore applied by moving USDC: a gain transfers into the vault (raising `total_assets` and hence NAV), a loss transfers out (lowering it). Shares are unchanged — a trade reprices existing shares; it never mints or burns. Losses are bounded so NAV floors at 0 and never touch the earmarked `trader_claimable`.

### 5.6 Devnet treasury top-up (devnet-only mechanism)

> **Devnet only — document clearly**

When `realized_pnl > 0`, the simulated profit is **not** backed by real trading gains, so the vault's token balance would otherwise fall short of the new (higher) NAV when investors withdraw. To keep the vault **token-backed for withdrawals**, the handler does a `transfer_checked` of `realized_pnl` worth of _free test USDC_ from a platform-funded `treasury_token` account into `vault_token`. This is a devnet faucet mechanism and **does not exist on mainnet**, where gains come from real settled USDC via the Flash CPI. On a loss, USDC moves the other way (vault → treasury), so the token balance always matches the derived NAV; the loss is shared pro-rata across all shares (including the trader's own-capital `trader_shares`).

### 5.7 The mainnet swap (everything else unchanged)

| Aspect | Devnet ( record_trade ) | Mainnet ( execute_trade ) |
| --- | --- | --- |
| Price source | oracle_authority co-signs real prices | Flash perps CPI returns fills |
| Funds | treasury top-up on gains / drain on losses (faucet) | real USDC settles through CPI |
| External program | none | CPI to whitelisted Flash program ONLY |
| NAV derivation / shares / settlement / events / accounts | IDENTICAL |  |

## 6. NAV / Shares Integer Math & Early-Investor Edge

This is a **single-asset (USDC) vault**. It does NOT use the two-asset AMM `sqrt(a*b)` geometric-mean formula. All math is integer-only: no floats, no `rust_decimal`, no fixed-point libraries in the program. Intermediate products use `u128` and narrow with `try_into().map_err(|_| ArcadiaError::MathOverflow)?`; every operation is `checked_*` with multiply-before-divide; division floors, which rounds in the protocol's favour (depositors and withdrawers get the floor). USDC and shares both carry 6 decimals, which keeps the par mapping clean.

### 6a. Numbers, Constants & Formulas (reference)

This is the single source of truth for every constant, percentage, and formula used in the program. Everything else in this document references it.

#### Constants (`constants.rs`)

```
pub const
 SHARE_SCALE: 
u64
           = 
1_000_000
;       
// 1e6, scale for nav_per_share


pub const
 USDC_DECIMALS: 
u8
          = 
6
;               
// USDC has 6 decimals (transfer_checked)


pub const
 BPS_DENOMINATOR: 
u16
       = 
10_000
;          
// basis-point denominator


pub const
 SECONDS_PER_YEAR: 
u64
      = 
31_557_600
;      
// 365.25 days



// platform fees


pub const
 PLATFORM_PERF_FEE_BPS: 
u16
 = 
500
;             
// 5% performance fee


pub const
 PLATFORM_MGMT_FEE_BPS: 
u16
 = 
100
;             
// 1%/yr management fee



// per-trade / withdrawal thresholds


pub const
 MAX_NOTIONAL_BPS: 
u16
     = 
2000
;            
// 20% of AUM per trade


pub const
 INSTANT_WITHDRAW_BPS: 
u16
 = 
500
;             
// <5% of AUM -> instant next tick



// leverage / tiers


pub const
 MAX_LEVERAGE_CEILING: 
u8
 = 
50
;              
// max_leverage hard ceiling


pub const
 MAX_TIER_BPS: 
u16
        = 
3500
;            
// highest trader cut (Elite, used in fee-config check)
```

#### Tier score thresholds & tier byte

| Tier name | Score threshold | score_tier (u8) | Trader profit-share | tier_bps |
| --- | --- | --- | --- | --- |
| Verified | 600 | 0 | 20% | 2000 |
| Established | 700 | 1 | 25% | 2500 |
| Advanced | 800 | 2 | 30% | 3000 |
| Elite | 900 | 3 | 35% | 3500 |
| Not fundable | <600 | 255 | — | — (cannot take investor deposits) |

```
pub fn
 tier_bps(score_tier: 
u8
) -> 
u16
 {
    
match
 score_tier {
        
0
 => 
2000
,   
// Verified    20%

        
1
 => 
2500
,   
// Established  25%

        
2
 => 
3000
,   
// Advanced     30%

        
3
 => 
3500
,   
// Elite        35%

        _ => 
0
,      
// 255 not fundable: never reaches settlement with investors

    }
}
```

#### Core formulas (all integer, floor)

| Quantity | Formula |
| --- | --- |
| total_assets | vault token account amount (USDC minor units) |
| nav_per_share | (total_assets - trader_claimable) * SHARE_SCALE / total_shares [u128, floor] — trader_claimable is earmarked and EXCLUDED from NAV |
| aum | total_assets - trader_claimable (the NAV-bearing assets) |
| shares_minted (first deposit, total_shares == 0 ) | amount |
| shares_minted (subsequent) | amount * total_shares / total_assets [u128 try_into u64, floor]; require > 0 |
| assets_out (withdraw) | shares * total_assets / total_shares [u128 try_into u64, floor] |
| investor capacity gate | (total_assets + amount) <= capacity_cap_usd (trader self-funding is EXEMPT) |
| per-trade notional cap | size_usd <= total_assets * 2000 / 10_000 |
| withdrawal instant threshold | value < aum * 500 / 10_000 → instant next tick; else next daily window |
| realized_pnl | dir_sign * (size_usd * leverage_x100 * (exit_px - entry_px)) / (entry_px * 100) - fees_usd [i128] |
| current_nav (settle) | (total_assets - trader_claimable) * SHARE_SCALE / total_shares |
| profit_assets (settle, if current_nav > hwm_per_share ) | (current_nav - hwm_per_share) * total_shares / SHARE_SCALE |
| trader_cut | profit_assets * tier_bps / 10_000 |
| platform_cut | profit_assets * 500 / 10_000 |
| mgmt (optional) | total_assets * 100 * elapsed_seconds / (10_000 * 31_557_600) |

### 6.1 NAV / early-investor edge

> **How the edge works**

Shares are always minted at the **current** NAV. A profitable trade raises `total_assets` and so the derived `nav_per_share`, which marks up _every_ existing share. **Earlier investors (lower cost basis) gain** because their shares were bought cheaper and are now worth more. **New deposits buy at the current NAV**, so a late depositor pays full price for each share and **does not dilute** the earlier holders — they simply receive proportionally fewer shares per dollar. No one's claim is diluted by a new deposit; NAV is the great equalizer.

### 6.2 Worked NAV example (integers, USDC minor units)

A single trader profile, starting empty, in **USDC minor units** throughout (1 USDC major unit = 1_000_000 minor units). The trader funds their own vault first, records a +500 USDC simulated trade, then an investor deposits at the new NAV.

| # | Action | Explicit integer math | nav_per_share | total_shares | total_assets |
| --- | --- | --- | --- | --- | --- |
| 0 | initialize_profile | hwm_per_share = SHARE_SCALE = 1_000_000 | — | 0 | 0 |
| 1 | Trader self-funds 5,000 USDC (= 5_000_000_000 minor units; own capital, cap-exempt) | first deposit: total_shares == 0 → shares_minted = amount = 5_000_000_000 ; trader_shares += 5_000_000_000 | 1_000_000 | 5_000_000_000 | 5_000_000_000 |
| 2 | record_trade: +500 USDC realized PnL (treasury → vault 500_000_000) | total_assets = 5_000_000_000 + 500_000_000 = 5_500_000_000; nav = 5_500_000_000 · 1_000_000 / 5_000_000_000 = 1_100_000 | 1_100_000 | 5_000_000_000 | 5_500_000_000 |
| 3 | Investor Iris deposits 1,100 USDC (= 1_100_000_000 minor units) at the new NAV | shares = 1_100_000_000 · 5_000_000_000 / 5_500_000_000 = 1_000_000_000 (floor) | 1_100_000 | 6_000_000_000 | 6_600_000_000 |
| 4 | Trader withdraws all 5_000_000_000 shares (own capital) | assets_out = 5_000_000_000 · 6_600_000_000 / 6_000_000_000 = 5_500_000_000 (5,500 USDC); trader_shares → 0 | 1_100_000 | 1_000_000_000 | 1_100_000_000 |
| 5 | Iris withdraws all 1_000_000_000 shares | assets_out = 1_000_000_000 · 1_100_000_000 / 1_000_000_000 = 1_100_000_000 (1,100 USDC) | — | 0 | 0 |

Key invariants: the trader earned the full 500 USDC gain on their own capital (deposited 5,000 USDC, withdrew 5,500 USDC), and Iris — who arrived _after_ the gain — paid 1.1× per share and is neutral; she neither captured the trader's prior 500 USDC nor diluted it. This is the early-investor edge in action: being early (lower cost basis) is what captures appreciation. Token conservation holds at every step: total assets paid out (5,500 + 1,100 = 6,600 USDC) equals total assets in the vault before withdrawals (6,600 USDC).

> **Rounding & safety**

Always compute with `u128` and divide last; floor division means a tiny amount of dust may remain in the vault, which only ever benefits remaining holders. Reject any deposit where `shares_minted == 0` (`DustDeposit`) — this, together with the trader making the first deposit, blocks the empty-vault inflation/donation attack. Token conservation is asserted on every fund-moving handler.

## 7. Settlement Math (HWM & Splits)

### 7.1 Rules

- **Periodic, per profile.** `settle()` crystallizes performance fees on a daily/monthly cadence.
- **High-water mark per share.** Fees are charged only on NAV growth above the prior peak: performance fees apply only when `current_nav > hwm_per_share`.
- **No fees on down/flat periods.** If `current_nav <= hwm_per_share`, `settle()` is a no-op for performance fees (no event, no perf transfers; only `last_settle_ts` updates).
- **Splits of `profit_assets`:** trader gets `tier_bps` (2000/2500/3000/3500, earmarked to `trader_claimable`), platform gets `500` bps (5%, sent to treasury), investors keep the remainder (it stays in NAV).
- **Earmark, not NAV stored:** the trader cut stays as USDC in the vault token account but is excluded from NAV via `trader_claimable`; the platform cut leaves immediately. NAV is derived, so removing/earmarking these assets automatically lowers it.
- **HWM reset:** after crystallization, `hwm_per_share = current_nav`.
- **Optional management fee:** `mgmt = total_assets * 100 * elapsed_seconds / (10_000 * 31_557_600)` → treasury (1%/yr, time-prorated).
- **No skin-in-the-game machinery:** there is no alignment stake, first-loss, retention, strikes or slashing. The trader's alignment comes purely from their own-capital position riding the same NAV.

### 7.2 Tier percentages

See §6a for the canonical table. Platform performance fee = 5% (500 bps) at every fundable tier; management fee = 1%/yr (100 bps). Trader cut by tier: Verified 2000 bps (20%), Established 2500 bps (25%), Advanced 3000 bps (30%), Elite 3500 bps (35%).

### 7.3 Worked settlement example (bps arithmetic shown by hand, USDC minor units)

A profile with `total_shares = 6_000_000_000`, derived `current_nav = 1_100_000`, `hwm_per_share = 1_000_000`, tier = Established (`tier_bps = 2500`, 25%), `trader_claimable = 0`, `total_assets = 6_600_000_000` (6,600 USDC).

| Step | Explicit computation | Result (minor units) |
| --- | --- | --- |
| per-share gain | 1_100_000 − 1_000_000 | 100_000 |
| profit_assets | (1_100_000 − 1_000_000) · 6_000_000_000 / 1_000_000 = 100_000 · 6_000_000_000 / 1_000_000 | 600_000_000 (600 USDC) |
| trader_cut (2500 bps) | 600_000_000 · 2500 / 10_000 | 150_000_000 (150 USDC) → trader_claimable |
| platform_cut (500 bps) | 600_000_000 · 500 / 10_000 | 30_000_000 (30 USDC) → treasury |
| investors keep | 600_000_000 − 150_000_000 − 30_000_000 | 420_000_000 (420 USDC, stays in NAV) |
| total_assets after platform transfer out | 6_600_000_000 − 30_000_000 | 6_570_000_000 |
| trader_claimable after earmark | 0 + 150_000_000 | 150_000_000 (excluded from NAV) |
| NAV-bearing assets (total_assets − trader_claimable) | 6_570_000_000 − 150_000_000 | 6_420_000_000 (6,420 USDC) |
| new derived nav_per_share | 6_420_000_000 · 1_000_000 / 6_000_000_000 | 1_070_000 |
| new hwm_per_share | reset to current derived NAV | 1_070_000 |

Investors' 420 USDC share of profit is reflected because the new derived NAV (1_070_000) stays well above the prior HWM par (1_000_000): the 30 USDC platform cut physically left the vault and the 150 USDC trader cut is earmarked out of NAV. The 150 USDC sits in the vault token account as `trader_claimable` until the trader calls `trader_withdraw_profit` (which moves USDC but not NAV, because both `total_assets` and `trader_claimable` drop by the same amount). The next settlement only charges performance fees on growth above 1_070_000.

## 8. Capacity Enforcement

Capacity caps how much **investor** AUM a vault may hold, scaled to the trader's proven track record. The **indexer computes it offchain** and pushes it onchain via `set_capacity` (signed by `oracle_authority` only). The program enforces it on every investor `deposit`.

> **Exponential ceiling is offchain**

The capacity ceiling uses `capacity_cap_usd = base * e^(k * score)`, an exponential that is NOT computable onchain. So `capacity_cap_usd` is a plain `u64` (USDC minor units) PUSHED by the offchain oracle authority via `set_capacity`; the exponential formula lives in the indexer (offchain).

```
// in deposit(), only when depositor != trader:


let
 total_assets = vault_token.amount;

require!
(profile.capacity_cap_usd > 
0
, ArcadiaError::CapacityNotSet);

let
 after = total_assets.checked_add(amount).ok_or(ArcadiaError::MathOverflow)?;

require!
(after <= profile.capacity_cap_usd, ArcadiaError::CapacityExceeded);
```

- Until `set_capacity` is called, `capacity_cap_usd = 0` and all _investor_ deposits are rejected (`CapacityNotSet`) — an unproven vault cannot take outside money.
- **The trader's own-capital deposit is EXEMPT from the cap** — the trader funds their own vault and trades until investors join. These deposits bump `trader_shares` and are withdrawable by the normal withdraw path.
- Withdrawals are never capacity-gated (anyone can always exit).

> **v2**

The capacity _ratchet_ — only allowing the cap to grow gradually over time and with sustained performance — is a v2 stub. MVP applies the oracle's value directly.

## 9. Security Model, Hard Rules & Errors

### 9.1 Hard rules (invariants that must hold at all times)

| # | Rule | Enforced by |
| --- | --- | --- |
| 1 | The TraderProfile PDA is the sole authority over vault_token . Only program logic (signing with profile seeds) moves funds. This is a program-owned vault: the TraderProfile PDA signs, and there is no admin escape hatch. | Token-account authority = profile PDA; all token-out CPIs use transfer_checked + signer_seeds . |
| 2 | The trader can NEVER transfer vault funds to an arbitrary external wallet. Trader has execute/record authority only. Every withdraw verifies the caller against the stored owner (Signer + stored authority). | No handler lets the trader name an arbitrary recipient. Outflows go only to: a depositor's own pro-rata payout (their own owner_token ), the fixed treasury_token in settle /loss, and the trader's own trader_token bounded by trader_claimable in trader_withdraw_profit . |
| 3 | On mainnet, execute_trade may CPI ONLY to the whitelisted Flash program . | Hard-coded program id check before CPI; reject any other target. |
| 4 | Leverage ≤ max_leverage. | record_trade : leverage_x100 / 100 <= max_leverage . |
| 5 | Per-trade notional ≤ 20% of AUM. | record_trade : size_usd <= total_assets * 2000 / 10_000 . |
| 6 | Price honesty: NAV-moving trades require the oracle_authority co-signature. | Dual signer check in record_trade . |
| 7 | trader_claimable is the only path by which the trader's performance fee leaves the vault, and it is bounded by the earmarked amount. | trader_withdraw_profit : amount <= trader_claimable . |
| 8 | Account binding: every account is bound by seeds / has_one ; per-user records include the signer key in seeds; InvestorPosition.profile is validated ( has_one = profile ) so an account from one vault cannot be passed to another; the USDC mint is bound by has_one everywhere balances are read. | Anchor seeds + has_one constraints in every account-constraints struct. |
| 9 | Checks-effects-interactions & token conservation. State is updated before the transfer_checked CPI; zero amounts, amount > balance , and zero-share deposits are rejected; token conservation is asserted on every fund-moving handler. | Handler ordering + range guards; checked_* with MathOverflow . |
| 10 | Two independent audits are required before any mainnet deployment. | Process gate (not code). |

### 9.2 Access-control table

| Instruction handler | trader | oracle_authority | investor | admin |
| --- | --- | --- | --- | --- |
| initialize_platform | — | — | — | ✓ (once) |
| initialize_profile | ✓ | — | — | — |
| set_capacity | — | ✓ (only) | — | — |
| initialize_investor | ✓ (own vault funding) | — | ✓ | — |
| deposit | ✓ (own capital, cap-exempt) | — | ✓ | — |
| request_withdraw / process_withdraw | ✓ (own position) | — | ✓ (own position) | — |
| record_trade | ✓ (co-sign) | ✓ (co-sign) | — | — |
| settle | ✓ | ✓ | — | — |
| trader_withdraw_profit | ✓ (only) | — | — | — |

### 9.3 Named error enum (`error.rs`)

```rust
// error.rs — named enum; no ProgramError::Custom anywhere

#[error_code]

pub enum
 
ArcadiaError
 {
    #[msg(
"Caller is not authorized for this action"
)]                Unauthorized,
    #[msg(
"Profile/vault is not active"
)]                            VaultNotActive,
    #[msg(
"Amount must be greater than zero"
)]                      ZeroAmount,
    #[msg(
"Insufficient funds in source token account"
)]            InsufficientFunds,
    #[msg(
"Leverage must be valid and within limits"
)]             InvalidLeverage,
    #[msg(
"Leverage exceeds profile max_leverage"
)]               LeverageTooHigh,
    #[msg(
"Trade notional exceeds 20% of AUM"
)]                   NotionalTooLarge,
    #[msg(
"Invalid trade parameters"
)]                            InvalidTradeParams,
    #[msg(
"Vault has no shares; NAV undefined"
)]                  NoShares,
    #[msg(
"Capacity has not been set by oracle"
)]                CapacityNotSet,
    #[msg(
"Deposit would exceed capacity cap"
)]                  CapacityExceeded,
    #[msg(
"Deposit too small; mints zero shares"
)]               DustDeposit,
    #[msg(
"Invalid score tier"
)]                                  InvalidTier,
    #[msg(
"Invalid or unsafe fee configuration"
)]                InvalidFeeConfig,
    #[msg(
"Insufficient shares for withdrawal"
)]                 InsufficientShares,
    #[msg(
"No pending withdrawal"
)]                               NothingPending,
    #[msg(
"Withdrawal window not yet reached"
)]                  NoticeNotElapsed,
    #[msg(
"Vault token balance insufficient for payout"
)]        InsufficientVaultLiquidity,
    #[msg(
"Amount exceeds trader claimable"
)]                     InsufficientClaimable,
    #[msg(
"Arithmetic overflow"
)]                                 MathOverflow,
}
```

All arithmetic uses `checked_*` with `u128` intermediates; on failure return `MathOverflow` via `.ok_or(ArcadiaError::MathOverflow)?` or `.map_err(|_| ArcadiaError::MathOverflow)?`. There is no `ProgramError::Custom` anywhere. Note: there is no `VaultBanned` error in v2 — banning, strikes and slashing have been removed entirely.

## 10. Integration Contract (Events & Instructions)

> **Canonical**

These shapes are **locked** for v2. The indexer decodes these events; the frontend calls these 10 instruction handlers and decodes these 4 accounts. Do not change names, types, ordering, or scaling without a coordinated change across all three parts.

### 10.1 Events for the indexer (Anchor `emit!`)

```rust
#[event] 
pub struct
 
ProfileInitialized
 { 
pub
 profile: 
Pubkey
, 
pub
 trader: 
Pubkey
, 
pub
 ts: 
i64
 }

#[event] 
pub struct
 
InvestorInitialized
 { 
pub
 investor: 
Pubkey
, 
pub
 ts: 
i64
 }

#[event] 
pub struct
 
Deposited
 {
    
pub
 profile: 
Pubkey
, 
pub
 depositor: 
Pubkey
, 
pub
 is_trader: 
bool
,
    
pub
 amount_usd: 
u64
, 
pub
 shares_minted: 
u64
, 
pub
 ts: 
i64

}

#[event] 
pub struct
 
WithdrawRequested
 {
    
pub
 profile: 
Pubkey
, 
pub
 owner: 
Pubkey
,
    
pub
 shares: 
u64
, 
pub
 withdraw_ready_ts: 
i64

}

#[event] 
pub struct
 
Withdrawn
 {
    
pub
 profile: 
Pubkey
, 
pub
 owner: 
Pubkey
,
    
pub
 shares_burned: 
u64
, 
pub
 amount_usd: 
u64

}

#[event] 
pub struct
 
TradeClosed
 {
    
pub
 profile: 
Pubkey
, 
pub
 trader: 
Pubkey
, 
pub
 market: 
String
,
    
pub
 direction: 
u8
, 
pub
 size_usd: 
u64
, 
pub
 leverage_x100: 
u16
,
    
pub
 entry_px: 
u64
, 
pub
 exit_px: 
u64
, 
pub
 realized_pnl: 
i64
,
    
pub
 fees_usd: 
u64
, 
pub
 was_liquidated: 
bool
,
    
pub
 opened_at: 
i64
, 
pub
 closed_at: 
i64

}

#[event] 
pub struct
 
Settled
 {
    
pub
 profile: 
Pubkey
, 
pub
 profit_usd: 
u64
,
    
pub
 trader_cut: 
u64
, 
pub
 platform_cut: 
u64
,
    
pub
 hwm_per_share: 
u64

}

#[event] 
pub struct
 
ProfitWithdrawn
 {
    
pub
 profile: 
Pubkey
, 
pub
 trader: 
Pubkey
, 
pub
 amount_usd: 
u64

}
```

### 10.2 Instruction handlers for the frontend (10)

| Handler | Instruction inputs |
| --- | --- |
| initialize_platform | (perf_fee_bps: u16, mgmt_fee_bps: u16, oracle_authority: Pubkey) — admin once; validates fee config |
| initialize_profile | (max_leverage: u8) — hwm_per_share init = 1_000_000 |
| set_capacity | (cap_usd: u64, score_tier: u8) — oracle_authority only; tier 0/1/2/3 or 255; cap is a plain u64 pushed from offchain |
| initialize_investor | () — any depositor once (investor or self-funding trader) |
| deposit | (amount: u64) — lazily inits position; first deposit shares = amount; subsequent shares = amount · total_shares / total_assets (floor, > 0); non-trader rejected if total_assets+amount > capacity_cap_usd; trader own-capital cap-exempt & bumps trader_shares |
| request_withdraw | (shares: u64) — value < 5% AUM (500 bps) instant next tick, else next daily window |
| process_withdraw | () — assets_out = shares · total_assets / total_shares (floor) |
| record_trade | (market: String, direction: u8, size_usd: u64, leverage_x100: u16, entry_px: u64, exit_px: u64, fees_usd: u64, was_liquidated: bool, opened_at: i64, closed_at: i64) |
| settle | () — periodic; HWM splits; trader cut (tier_bps) → trader_claimable; platform 500 bps → treasury |
| trader_withdraw_profit | (amount: u64) — trader pulls from trader_claimable |

### 10.3 Accounts the frontend decodes (4)

| Account | Fields |
| --- | --- |
| PlatformConfig | admin:Pubkey, oracle_authority:Pubkey, treasury_token:Pubkey, base_mint:Pubkey, perf_fee_bps:u16 (500), mgmt_fee_bps:u16 (100), bump:u8 |
| TraderProfile | trader:Pubkey, base_mint:Pubkey, vault_token:Pubkey, total_shares:u64, trader_shares:u64, hwm_per_share:u64 (1e6), capacity_cap_usd:u64, trader_claimable:u64, last_settle_ts:i64, created_at:i64, status:u8 (0 active,1 closed), score_tier:u8 (0/1/2/3,255), max_leverage:u8, bump:u8. NOTE: nav_per_share is derived = (vault_token.amount − trader_claimable) · 1e6 / total_shares. |
| InvestorAccount | owner:Pubkey, position_count:u32, total_deposited_usd:u64, created_at:i64, bump:u8 |
| InvestorPosition | owner:Pubkey, profile:Pubkey, shares:u64, cost_basis_usd:u64, pending_withdraw_shares:u64, withdraw_ready_ts:i64, deposited_at:i64, bump:u8 |

> **idl-build feature**

To generate the IDL with `token_interface` types, the program's `Cargo.toml` declares `idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]` and is built with `anchor build` (which runs the `idl-build` feature). The same program binary works unchanged against the Classic Token Program and the Token Extensions Program because every token account is an `InterfaceAccount` and every CPI is `transfer_checked`.

## 11. Test Plan & 8-Week Build Plan

> **Test harness**

Scaffold with `anchor init arcadia_vault --package-manager npm --test-template litesvm`. Tests are **Rust + LiteSVM** under `programs/arcadia_vault/tests/`; the compiled program is embedded with `include_bytes!`, so run `cargo build-sbf` (or `anchor build`) **before** the tests. Every piece of state is created through the program's own instruction handlers — **no pre-fabricated accounts** except a mock price feed (a plain treasury-funded mint/token account used as the devnet faucet). No placeholder tests.

### 11.1 LiteSVM Rust tests (under `programs/arcadia_vault/tests/`)

| Suite | Cases |
| --- | --- |
| Platform & profile init | initialize_platform sets fees/oracle/treasury/base_mint and rejects unsafe fee config (InvalidFeeConfig); second platform init fails; initialize_profile sets hwm=1_000_000, score_tier=255, saved bump, correct PDAs; second init for same trader fails; profile PDA is authority of vault_token. |
| Investor account | initialize_investor sets owner/counters; second init for same wallet fails; one wallet opens positions across multiple profiles (position_count increments); InvestorPosition from vault A rejected when passed for vault B (has_one = profile). |
| Capacity | investor deposit before set_capacity → CapacityNotSet; non-oracle set_capacity → Unauthorized; invalid tier → InvalidTier; tier 255 accepted; cap pushed as plain u64 enforced exactly at the boundary. |
| Deposit / shares (both branches) | First-deposit branch: trader self-funds → total_shares == 0 → shares_minted = amount (5_000_000_000). Subsequent branch: investor deposits 1_100_000_000 at NAV 1_100_000 → shares = 1_100_000_000 · 5_000_000_000 / 5_500_000_000 = 1_000_000_000 (asymmetric, nonzero). Investor deposit exceeding cap → CapacityExceeded; trader own-capital deposit cap-exempt & bumps trader_shares; amount > balance → InsufficientFunds; dust deposit → DustDeposit; cost_basis_usd accumulates; Deposited event (incl. is_trader) exact. |
| record_trade (both directions) | Long (+1): exit_px > entry_px raises total_assets & derived NAV (treasury → vault transfer_checked). Short (-1): exit_px < entry_px on a short raises NAV; a long loss / short gain lowers it (vault → treasury), NAV floored at 0; single-signer (missing oracle OR trader) fails Unauthorized; leverage > max → LeverageTooHigh; size > total_assets · 2000 / 10_000 → NotionalTooLarge; realized_pnl sign & magnitude exact per the i128 formula; TradeClosed fields exact. |
| Withdraw (threshold boundary, asymmetric values) | assets_out = shares · total_assets / total_shares (floor); partial & full; over-withdraw → InsufficientShares; boundary: with total_assets such that a 4.99% withdrawal → instant (withdraw_ready_ts = now) and a 5.01% withdrawal → next daily window, using nonzero asymmetric share counts (e.g. AUM 6_420_000_000; request valued 320_000_000 instant vs 330_000_000 deferred); process before window → NoticeNotElapsed; vault solvent after gain; position closed at 0 shares; trader own-capital withdraw reduces trader_shares; WithdrawRequested + Withdrawn events exact. |
| Settle | no profit (current_nav ≤ hwm) → no-op/no event (last_settle_ts updates); profit splits per tier (profit_assets 600_000_000 → trader_cut 150_000_000 @ 2500 bps, platform_cut 30_000_000 @ 500 bps); platform 5% always sent via transfer_checked; trader cut earmarked to trader_claimable (excluded from NAV); derived NAV drops to 1_070_000; HWM resets; no double-fee on flat re-settle; optional mgmt accrual; Settled event exact. |
| trader_withdraw_profit | trader pulls ≤ trader_claimable; over-pull → InsufficientClaimable; zero → ZeroAmount; non-trader → Unauthorized; derived NAV unchanged by the pull (total_assets and trader_claimable both drop by amount); ProfitWithdrawn event exact. |
| Math/security | overflow paths → MathOverflow; trader cannot send funds to arbitrary wallet (no such path exists); profile PDA is sole vault_token authority; token conservation asserted on every fund-moving handler; end-to-end total-asset conservation across the §6.2 sequence. |

### 11.2 Devnet tests

- `anchor build` / `cargo build-sbf`, deploy to devnet; mint devnet USDC to trader, investors, and the treasury_token account; run initialize_platform once.
- Run the full happy path: trader self-funds → trades → investor deposits at new NAV → settle → trader_withdraw_profit → both withdraw, with a real (separate) oracle_authority keypair co-signing record_trade.
- Confirm the indexer decodes every event correctly (coordinate with indexer dev) and the frontend can build all 10 instructions from the IDL and decode all 4 accounts.
- Verify token-backed solvency against both the Classic Token Program and the Token Extensions Program: after a series of gains/losses and a settlement, every depositor can withdraw their full payout and the trader can pull trader_claimable.

### 11.3 Eight-week build plan (program dev)

| Week | Focus | Deliverable |
| --- | --- | --- |
| 1 | Scaffold | anchor init with litesvm template; program id; state/ (4 PDAs, InitSpace), error.rs , events.rs , constants.rs (§6a); initialize_platform + initialize_profile + LiteSVM tests green. |
| 2 | Funds in | initialize_investor, set_capacity, deposit (both share branches, lazy position init, trader cap-exempt own-capital + trader_shares, transfer_checked); Deposited + InvestorInitialized events; tests. |
| 3 | Withdrawals | request_withdraw / process_withdraw, size-scaled notice (<5% / 500 bps instant else daily window), assets_out math, position close; WithdrawRequested + Withdrawn events; threshold-boundary tests. |
| 4 | Simulated trades | record_trade: i128 PnL math, dual-sign, transfer_checked gain/loss, devnet treasury faucet; TradeClosed event; leverage + 20%-AUM (2000 bps) notional guards; long & short tests. |
| 5 | Settlement | settle: periodic HWM, tier splits, platform 500 bps, trader cut → trader_claimable (NAV-excluded), optional mgmt accrual; trader_withdraw_profit; Settled + ProfitWithdrawn events; no-fee-on-down; tests. |
| 6 | Safety | Security invariant tests (sole PDA authority, no arbitrary-recipient path, claimable bound, has_one cross-vault rejection, token conservation), edge cases; freeze the integration contract (IDL). |
| 7 | Devnet integration | Deploy to devnet; end-to-end with indexer + frontend; bug-fix; finalize IDL; document the devnet treasury faucet mechanism. |
| 8 | Harden | Fuzz/overflow review, edge-case tests, compute-budget tuning, demo data, handoff docs. Stub execute_trade signature for mainnet. Note: 2 audits required pre-mainnet (out of 8-week scope). |

### 11.4 Day-1 steps

1. `anchor init arcadia_vault --package-manager npm --test-template litesvm`; set `cluster = devnet` in Anchor.toml; `anchor keys list` → paste real program id into `declare_id!` and Anchor.toml.
2. Create `state/` with the 4 PDAs (`PlatformConfig`, `TraderProfile`, `InvestorAccount`, `InvestorPosition`) exactly per §3, each with `#[derive(InitSpace)]` and a saved `bump`.
3. Create `constants.rs` (`SHARE_SCALE`, `BPS_DENOMINATOR`, `SECONDS_PER_YEAR`, fee bps, `MAX_NOTIONAL_BPS`, `INSTANT_WITHDRAW_BPS`, seeds) verbatim from §6a.
4. Create `events.rs` with the eight locked events from §10 verbatim, and `error.rs` with the named `ArcadiaError` enum from §9.3.
5. Add the `idl-build` feature to the program `Cargo.toml`; use `anchor_spl::token_interface` throughout.
6. Implement `initialize_platform` + `initialize_profile` (PDA + token-account init, hwm=1e6, fee-config validation) and write their LiteSVM tests; run `cargo build-sbf` then `anchor test` green.
7. Commit and share the generated IDL with the frontend & indexer devs so all three parts agree on the contract from day one.

---

Arcadia — `arcadia_vault` Solana program specification · MVP + investor deposits · Anchor 1.0.2 / Devnet / devnet USDC (6 decimals) · SHARE_SCALE = 1_000_000 · 4 custom PDAs · 10 instruction handlers.  Single-asset USDC vault (linear shares, not sqrt(a·b)); integer-only checked math; token_interface + transfer_checked; program-owned vault, the TraderProfile PDA signs, no admin escape hatch. Trades are simulated on devnet via `record_trade` (real prices, oracle-co-signed); mainnet replaces this with `execute_trade` → Flash CPI, everything else unchanged. No ban / slash / strikes / first-loss / alignment-stake. Two audits required before mainnet.
