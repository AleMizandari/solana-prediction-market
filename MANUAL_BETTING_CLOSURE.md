# Manual Betting Closure Feature

This document explains how to use the new manual betting closure system that replaces the automatic 24-hour timeout.

## Overview

**Before**: Betting automatically closed after 24 hours
**Now**: Admin manually closes betting whenever they want using the `close_betting` instruction

## Changes Made

### 1. State Structure
- **Removed**: `betting_end_time: i64` (timestamp field)
- **Added**: `betting_open: bool` (admin-controlled flag)

### 2. New Instruction: `close_betting`
Allows the event authority to manually close betting:

```typescript
await program.methods
  .closeBetting()
  .accounts({
    authority: adminKeypair.publicKey,
    event: eventPDA,
  })
  .signers([adminKeypair])
  .rpc();
```

### 3. Updated Errors
- **Old**: `BettingEnded` (time-based)
- **New**:
  - `BettingClosed` - "Betting is closed by admin"
  - `BettingAlreadyClosed` - "Betting is already closed"

## Usage Example (TypeScript)

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SportsPredictionMarket } from "../target/types/sports_prediction_market";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Setup
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.SportsPredictionMarket as Program<SportsPredictionMarket>;

// 1. CREATE EVENT (betting opens automatically)
const eventId = 12345;
const eventIdBuffer = Buffer.alloc(8);
eventIdBuffer.writeUInt32LE(eventId, 0);

const [eventPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("event"), eventIdBuffer],
  program.programId
);

await program.methods
  .createEvent(
    new anchor.BN(eventId),
    "TeamA",
    "TeamB",
    300, // 3% fee
    100, // 1% dev fee
    tokenMint // For SPL token betting (use null for SOL)
  )
  .accounts({
    authority: adminKeypair.publicKey,
    feeAccount: feeAccountPubkey,
    developerFeeAccount: devFeeAccountPubkey,
  })
  .signers([adminKeypair])
  .rpc();

console.log("Event created - betting is OPEN");

// 2. USERS PLACE BETS (while betting_open = true)
await program.methods
  .createBet({ winA: {} }, new anchor.BN(1000 * 1e6))
  .accounts({
    authority: user1.publicKey,
    event: eventPDA,
    eventVault: eventPDA,
    userTokenAccount: user1TokenAccount,
    eventTokenVault: eventTokenVault,
    tokenMint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([user1])
  .rpc();

console.log("User bet placed successfully");

// 3. ADMIN CLOSES BETTING MANUALLY
await program.methods
  .closeBetting()
  .accounts({
    authority: adminKeypair.publicKey,
    event: eventPDA,
  })
  .signers([adminKeypair])
  .rpc();

console.log("Betting is now CLOSED");

// 4. TRY TO BET AFTER CLOSURE (will fail)
try {
  await program.methods
    .createBet({ winA: {} }, new anchor.BN(500 * 1e6))
    .accounts({
      authority: user2.publicKey,
      event: eventPDA,
      eventVault: eventPDA,
      // ... other accounts
    })
    .signers([user2])
    .rpc();
} catch (error) {
  console.log("✅ Bet rejected: Betting is closed");
  // Error: "Betting is closed by admin"
}

// 5. ADMIN ANNOUNCES WINNER
await program.methods
  .announceWinner({ winA: {} })
  .accounts({
    authority: adminKeypair.publicKey,
    event: eventPDA,
  })
  .signers([adminKeypair])
  .rpc();

console.log("Winner announced!");

// 6. USERS SETTLE BETS
const [betPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("bet"), eventPDA.toBuffer(), user1.publicKey.toBuffer()],
  program.programId
);

await program.methods
  .settleBet()
  .accounts({
    authority: user1.publicKey,
    bet: betPDA,
    event: eventPDA,
    eventVault: eventPDA,
    userTokenAccount: user1TokenAccount,
    eventTokenVault: eventTokenVault,
    tokenMint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([user1])
  .rpc();

console.log("Bet settled - payout received!");
```

## Flow Diagram

```
┌──────────────────┐
│  Create Event    │ ──> betting_open = true
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Users Bet       │ ──> While betting_open = true
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Admin Closes     │ ──> betting_open = false
│    Betting       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Users Cannot     │ ──> Error: BettingClosed
│    Bet Anymore   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Announce Winner  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Settle Bets     │ ──> Winners get payouts
└──────────────────┘
```

## Testing

To test the new manual closure system:

1. **Build the program**:
   ```bash
   anchor build
   ```

2. **Deploy to localnet**:
   ```bash
   anchor deploy
   ```

3. **Run the test**:
   ```bash
   ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 \
   ANCHOR_WALLET=~/.config/solana/id.json \
   yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/close-betting-test.ts
   ```

## Key Benefits

✅ **Full Control**: Admin decides when to close betting
✅ **No Time Restrictions**: No forced 24-hour window
✅ **Flexible**: Can keep betting open as long as needed
✅ **Secure**: Only event authority can close betting
✅ **Clear State**: Easy to check if betting is open or closed

## Breaking Changes

⚠️ **Important**: This is a breaking change!

- Old events with `betting_end_time` are **incompatible**
- You must redeploy the program and create new events
- Existing events from the old program cannot be used

## Migration Guide

If you have existing events:

1. Close and settle all existing events using the old program
2. Deploy the new program
3. Create new events with the updated system
4. Inform users about the new manual closure process

## Support

For questions or issues, refer to the updated documentation in `CLAUDE.md`.
