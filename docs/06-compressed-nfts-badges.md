# Compressed NFT Badges — Bubblegum V2 + Helius (April 2026)

## Critical Change: Helius mintCompressedNft is DEPRECATED

The build plan's approach of calling `mintCompressedNft` via a simple `fetch()` to Helius **is deprecated**. The actual deprecation notice says: "Deprecated endpoint for minting compressed NFTs on Solana. Use the ZK Compression API instead for new implementations."

The API still functions but is not recommended for new projects. For NFT badges specifically, **Bubblegum V2 + Umi SDK** is the right approach (ZK Compression is for general state compression, not structured NFTs).

**New approach:** Bubblegum V2 + Umi SDK for minting, Helius DAS API for reading.

---

## Bubblegum V2 — What's New

### Soulbound NFTs (Non-Transferable)
cNFTs can be made **permanently non-transferable**. This is perfect for proof-of-meetup badges — once minted, they cannot be transferred, sold, or traded.

### MPL-Core Collections
V2 cNFTs use MPL-Core collections (modern Metaplex standard).

### Freeze/Thaw
Collection-level freeze authority without requiring leaf owner signature.

---

## Setup

### Install Packages
```bash
npm install @metaplex-foundation/umi-bundle-defaults@1.5.1 \
            @metaplex-foundation/mpl-bubblegum@5.0.2 \
            @metaplex-foundation/umi
```

### Initialize Umi
```typescript
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';

const umi = createUmi('https://devnet.helius-rpc.com/?api-key=YOUR_KEY')
  .use(mplBubblegum());
```

---

## Step 1: Create Merkle Tree (One-Time Setup)

You need a Merkle tree before minting any badges. This is a one-time cost.

```typescript
import { generateSigner } from '@metaplex-foundation/umi';
import { createTreeV2 } from '@metaplex-foundation/mpl-bubblegum';

const treeKeypair = generateSigner(umi);

// IMPORTANT: Use createTreeV2, not createTree. V2 trees are NOT backward-compatible with V1.
await createTreeV2(umi, {
  merkleTree: treeKeypair,
  maxDepth: 14,        // 2^14 = 16,384 badge slots
  maxBufferSize: 64,
  canopyDepth: 10,     // reduces proof size for reads
}).sendAndConfirm(umi);

// Save treeKeypair.publicKey — you'll need it for every mint
```

### Tree Sizing & Cost

| Depth | Max Badges | Approx Cost (SOL) | Notes |
|-------|-----------|-------------------|-------|
| 10 | 1,024 | ~0.1 SOL | Good for hackathon demo |
| 14 | 16,384 | ~0.678 SOL | Good for launch |
| 20 | 1,048,576 | ~7.7 SOL | Scale |

**On devnet:** Free (airdrop SOL). On mainnet, start small (depth 10).

---

## Step 2: Mint a Badge (Per NFC Tap)

```typescript
import { mintV2 } from '@metaplex-foundation/mpl-bubblegum';
import { publicKey } from '@metaplex-foundation/umi';

async function mintBadge(
  recipientWallet: string,
  badgeName: string,
  metadataUri: string,
  collectionAddress: string,
) {
  await mintV2(umi, {
    merkleTree: publicKey('YOUR_TREE_ADDRESS'),
    leafOwner: publicKey(recipientWallet),
    metadata: {
      name: badgeName,                    // e.g. "TapTribe Badge #42"
      uri: metadataUri,                   // off-chain JSON URL
      sellerFeeBasisPoints: 0,
      collection: {
        key: publicKey(collectionAddress),
        verified: false,
      },
      creators: [{
        address: umi.identity.publicKey,
        verified: false,
        share: 100,
      }],
    },
  }).sendAndConfirm(umi);
}
```

### Cost Per Mint
~0.000005 SOL (~$0.0007) — just the transaction fee. The tree creation is the main cost.

---

## Step 3: Make Badge Soulbound (Optional but Recommended)

```typescript
import { getAssetWithProof, setNonTransferableV2 } from '@metaplex-foundation/mpl-bubblegum';

async function makeSoulbound(assetId: string) {
  const assetWithProof = await getAssetWithProof(umi, publicKey(assetId));
  await setNonTransferableV2(umi, {
    ...assetWithProof,
    leafOwner: umi.identity.publicKey,
    authority: collectionAuthority,
  }).sendAndConfirm(umi);
}
```

**For judges:** "Badges are soulbound — they prove you actually met someone. Can't be faked, can't be transferred."

---

## Step 4: Read Badges via Helius DAS API

The DAS API is unchanged and still the way to read compressed NFTs.

### Get All Badges for a Wallet
```typescript
async function getBadges(walletAddress: string, heliusKey: string) {
  const response = await fetch(`https://devnet.helius-rpc.com/?api-key=${heliusKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: walletAddress,
        page: 1,
        limit: 50,
        sortBy: { sortBy: 'created', sortDirection: 'desc' },
        options: { showCollectionMetadata: true },
      },
    }),
  });
  const data = await response.json();
  return data.result?.items || [];
}
```

### Get Single Badge Detail
```typescript
async function getBadgeDetail(assetId: string, heliusKey: string) {
  const response = await fetch(`https://devnet.helius-rpc.com/?api-key=${heliusKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getAsset',
      params: { id: assetId },
    }),
  });
  return (await response.json()).result;
}
```

### DAS API Methods

| Method | Purpose | Credits |
|--------|---------|---------|
| `getAsset` | Single asset by ID | 10 |
| `getAssetsByOwner` | All assets for a wallet | 10 |
| `getAssetsByCreator` | Assets by creator | 10 |
| `getAssetsByGroup` | Assets in a collection | 10 |
| `searchAssets` | Search with filters | 10 |
| `getAssetProof` | Merkle proof for cNFT | 10 |

---

## Badge Metadata JSON (Off-Chain)

Host this JSON at an HTTPS URL (Arweave, IPFS, or any CDN):

```json
{
  "name": "TapTribe Badge - Frontier 2026",
  "symbol": "TAPTRIBE",
  "description": "Proof of meeting at Colosseum Frontier Hackathon 2026",
  "image": "https://arweave.net/BADGE_IMAGE_HASH",
  "attributes": [
    { "trait_type": "Event", "value": "Frontier Hackathon 2026" },
    { "trait_type": "Tapped With", "value": "Deepesh" },
    { "trait_type": "Date", "value": "2026-04-15" },
    { "trait_type": "Location", "value": "San Francisco" },
    { "trait_type": "Type", "value": "Proof of Meetup" }
  ],
  "properties": {
    "files": [
      { "uri": "https://arweave.net/BADGE_IMAGE_HASH", "type": "image/png" }
    ],
    "category": "image"
  }
}
```

### Metadata Hosting Options

| Service | Model | Cost | Best For |
|---------|-------|------|----------|
| **Arweave (via Irys)** | Permanent, pay once | ~$0.08/MB | Production (Umi has built-in Irys support) |
| **IPFS + Pinata** | Pinning, recurring | ~$0.02/GB/mo | Dev/testing |
| **NFT.Storage** | Endowed ~5 years | ~$0.10/MB one-time | Hackathon simplicity |
| **Any HTTPS URL** | Temporary | Free | Dev/demo only |

**For hackathon:** Use any HTTPS URL during development (even a GitHub raw link). Move to Arweave before submission.

---

## Helius Pricing

| Plan | Monthly | Credits | RPC req/s | DAS req/s |
|------|---------|---------|-----------|-----------|
| **Free** | $0 | 1M | 10 | 2 |
| Developer | $24.50 (50% off for Frontier) | 10M | 50 | 10 |

Free tier = 100,000 DAS queries/month. More than enough for a hackathon.

Sign up: https://helius.dev (no credit card for free tier).

---

## Bubblegum V2 vs Metaplex Core vs Token Extensions

| | Bubblegum V2 cNFTs | Metaplex Core | Token Extensions |
|---|---|---|---|
| **Cost per mint** | ~$0.0007 | ~$0.40 | ~$0.01 |
| **Soulbound** | Yes | Yes | Yes (Non-Transferable ext) |
| **Best for** | Mass-mint (100s+) | Individual or moderate | Fungible-like tokens |
| **Complexity** | Medium (Merkle tree setup) | Simple | Simple |
| **Reading** | Requires DAS API | Standard RPC | Standard RPC |
| **Rich metadata** | Yes (off-chain JSON) | Yes | Limited (on-chain only) |

**TapTribe should use Bubblegum V2** — cost-efficient at scale, soulbound support, rich metadata for badge art.

---

## Sources
- [mintCompressedNft (deprecated)](https://www.helius.dev/docs/api-reference/mint/mintcompressednft)
- [Helius DAS API](https://www.helius.dev/docs/api-reference/das)
- [Helius Pricing](https://www.helius.dev/docs/billing/plans)
- [Bubblegum V2 Overview](https://developers.metaplex.com/smart-contracts/bubblegum-v2)
- [Minting cNFTs V2](https://developers.metaplex.com/smart-contracts/bubblegum-v2/mint-cnfts)
- [Creating Trees](https://developers.metaplex.com/smart-contracts/bubblegum-v2/create-trees)
- [Bubblegum V2 FAQ](https://developers.metaplex.com/smart-contracts/bubblegum-v2/faq)
- [Metaplex Core](https://developers.metaplex.com/smart-contracts/core)
- [Solana Non-Transferable Tokens](https://solana.com/docs/tokens/extensions/non-transferrable-tokens)
