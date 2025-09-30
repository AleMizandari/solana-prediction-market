import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SportsPredictionMarket } from "../target/types/sports_prediction_market";
import { expect } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Close Betting Test with Platform Fee Tracking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SportsPredictionMarket as Program<SportsPredictionMarket>;
  const PROGRAM_ID = program.programId;

  let mintAuthority: Keypair;
  let tokenMint: PublicKey;
  let user1: Keypair;
  let user2: Keypair;

  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let eventTokenVault: PublicKey;
  let platformFeeTokenAccount: PublicKey;

  let eventId: number;
  let eventPDA: PublicKey;

  it("Setup: Create token and wallets", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                          SETUP PHASE                           ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    // Create wallets
    mintAuthority = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    console.log("\n📋 Wallet Addresses:");
    console.log("   Mint Authority:   ", mintAuthority.publicKey.toString());
    console.log("   User 1:           ", user1.publicKey.toString());
    console.log("   User 2:           ", user2.publicKey.toString());
    console.log("   Platform Fee Acc: ", provider.wallet.publicKey.toString());

    // Airdrop SOL for fees
    const airdrop1 = await provider.connection.requestAirdrop(mintAuthority.publicKey, 5 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdrop1, "confirmed");

    const airdrop2 = await provider.connection.requestAirdrop(user1.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdrop2, "confirmed");

    const airdrop3 = await provider.connection.requestAirdrop(user2.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdrop3, "confirmed");

    // Create SPL token
    tokenMint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6 // 6 decimals
    );

    console.log("\n✅ Token Mint Created:  ", tokenMint.toString());
    console.log("   Decimals: 6");

    // Create token accounts
    const user1Account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      user1.publicKey
    );
    user1TokenAccount = user1Account.address;

    const user2Account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      user2.publicKey
    );
    user2TokenAccount = user2Account.address;

    // Mint tokens to users
    await mintTo(
      provider.connection,
      mintAuthority,
      tokenMint,
      user1TokenAccount,
      mintAuthority.publicKey,
      5000 * 1e6 // 5000 tokens
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      tokenMint,
      user2TokenAccount,
      mintAuthority.publicKey,
      5000 * 1e6 // 5000 tokens
    );

    const balance1 = await getAccount(provider.connection, user1TokenAccount);
    const balance2 = await getAccount(provider.connection, user2TokenAccount);

    console.log("\n💰 Initial Token Balances:");
    console.log("   User 1:           ", Number(balance1.amount) / 1e6, "tokens");
    console.log("   User 2:           ", Number(balance2.amount) / 1e6, "tokens");
  });

  it("Create betting event with SPL token", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                      CREATE EVENT PHASE                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    eventId = Math.floor(Math.random() * 1000000);
    const eventIdBuffer = Buffer.alloc(8);
    eventIdBuffer.writeUInt32LE(eventId, 0);

    [eventPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("event"), eventIdBuffer],
      PROGRAM_ID
    );

    // Create event token vault
    const vaultInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      eventPDA,
      true // Allow PDA
    );
    eventTokenVault = vaultInfo.address;

    // Create platform fee token account
    const platformFeeInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      provider.wallet.publicKey
    );
    platformFeeTokenAccount = platformFeeInfo.address;

    console.log("\n📍 Event Details:");
    console.log("   Event ID:         ", eventId);
    console.log("   Event PDA:        ", eventPDA.toString());
    console.log("   Event Vault:      ", eventTokenVault.toString());
    console.log("   Platform Fee Acc: ", platformFeeTokenAccount.toString());
    console.log("   Matchup:           Bitcoin vs Ethereum");
    console.log("   Platform Fee:      3% (300 bps)");

    const tx = await program.methods
      .createEvent(
        new anchor.BN(eventId),
        "Bitcoin",
        "Ethereum",
        300, // 3% fee
        tokenMint
      )
      .accounts({
        authority: provider.wallet.publicKey,
        platformFeeAccount: provider.wallet.publicKey,
      })
      .rpc();

    console.log("\n✅ Event Created!");
    console.log("   Transaction:      ", tx);

    const event = await program.account.event.fetch(eventPDA);
    console.log("   Betting Status:    OPEN");
    expect(event.bettingOpen).to.be.true;

    // Check initial platform fee balance
    const platformFeeBalance = await getAccount(provider.connection, platformFeeTokenAccount);
    console.log("\n💰 Platform Fee Balance: ", Number(platformFeeBalance.amount) / 1e6, "tokens");
  });

  it("Users place bets (betting is open)", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                      PLACING BETS PHASE                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    // Get balances before betting
    const balanceBefore1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const balanceBefore2 = Number((await getAccount(provider.connection, user2TokenAccount)).amount) / 1e6;
    const platformFeeBefore = Number((await getAccount(provider.connection, platformFeeTokenAccount)).amount) / 1e6;

    console.log("\n💰 Balances BEFORE Betting:");
    console.log("   User 1:            ", balanceBefore1, "tokens");
    console.log("   User 2:            ", balanceBefore2, "tokens");
    console.log("   Platform Fee:      ", platformFeeBefore, "tokens");
    console.log("   Event Vault:        0 tokens");

    // User 1 bets 1000 tokens on Bitcoin
    console.log("\n🎲 User 1 betting 1000 tokens on Bitcoin (WinA)...");
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

    console.log("   ✅ User 1 bet placed!");

    // User 2 bets 800 tokens on Ethereum
    console.log("\n🎲 User 2 betting 800 tokens on Ethereum (WinB)...");
    await program.methods
      .createBet({ winB: {} }, new anchor.BN(800 * 1e6))
      .accounts({
        authority: user2.publicKey,
        event: eventPDA,
        eventVault: eventPDA,
        userTokenAccount: user2TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user2])
      .rpc();

    console.log("   ✅ User 2 bet placed!");

    // Check balances after betting
    const balanceAfter1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const balanceAfter2 = Number((await getAccount(provider.connection, user2TokenAccount)).amount) / 1e6;
    const vaultBalance = Number((await getAccount(provider.connection, eventTokenVault)).amount) / 1e6;
    const platformFeeAfter = Number((await getAccount(provider.connection, platformFeeTokenAccount)).amount) / 1e6;

    console.log("\n💰 Balances AFTER Betting:");
    console.log("   User 1:            ", balanceAfter1, "tokens (", balanceAfter1 - balanceBefore1, ")");
    console.log("   User 2:            ", balanceAfter2, "tokens (", balanceAfter2 - balanceBefore2, ")");
    console.log("   Event Vault:       ", vaultBalance, "tokens");
    console.log("   Platform Fee:      ", platformFeeAfter, "tokens (no change yet)");

    const event = await program.account.event.fetch(eventPDA);
    console.log("\n📊 Event Pool Stats:");
    console.log("   Bitcoin Pool:      ", Number(event.winAAmount) / 1e6, "tokens");
    console.log("   Ethereum Pool:     ", Number(event.winBAmount) / 1e6, "tokens");
    console.log("   Total Pool:        ", (Number(event.winAAmount) + Number(event.winBAmount)) / 1e6, "tokens");
  });

  it("Admin closes betting", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                    CLOSE BETTING PHASE                         ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    const tx = await program.methods
      .closeBetting()
      .accounts({
        authority: provider.wallet.publicKey,
        event: eventPDA,
      })
      .rpc();

    console.log("\n🔒 Betting closed by admin!");
    console.log("   Transaction:      ", tx);

    const event = await program.account.event.fetch(eventPDA);
    console.log("   Betting Status:    CLOSED");
    expect(event.bettingOpen).to.be.false;
  });

  it("Try to bet after betting is closed (should fail)", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║               TEST BET REJECTION AFTER CLOSURE                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    try {
      const user3 = Keypair.generate();
      const airdrop = await provider.connection.requestAirdrop(user3.publicKey, 1 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(airdrop, "confirmed");

      const user3TokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        mintAuthority,
        tokenMint,
        user3.publicKey
      );

      await mintTo(
        provider.connection,
        mintAuthority,
        tokenMint,
        user3TokenAccount.address,
        mintAuthority.publicKey,
        1000 * 1e6
      );

      console.log("\n🎲 User 3 attempting to bet 500 tokens after closure...");

      await program.methods
        .createBet({ winA: {} }, new anchor.BN(500 * 1e6))
        .accounts({
          authority: user3.publicKey,
          event: eventPDA,
          eventVault: eventPDA,
          userTokenAccount: user3TokenAccount.address,
          eventTokenVault: eventTokenVault,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user3])
        .rpc();

      // Should not reach here
      throw new Error("Bet should have failed but succeeded!");
    } catch (error) {
      const errorString = error.toString();
      if (errorString.includes("BettingClosed") ||
          errorString.includes("Betting is closed") ||
          errorString.includes("0x10")) { // Error code 16 = BettingClosed
        console.log("   ✅ Bet correctly rejected: Betting is closed by admin");
      } else {
        console.log("   ❌ Unexpected error:", errorString);
        throw error;
      }
    }
  });

  it("Announce winner", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                    ANNOUNCE WINNER PHASE                       ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    const tx = await program.methods
      .announceWinner({ winA: {} })
      .accounts({
        authority: provider.wallet.publicKey,
        event: eventPDA,
      })
      .rpc();

    console.log("\n🏆 Winner Announced: Bitcoin (WinA)!");
    console.log("   Transaction:      ", tx);

    const event = await program.account.event.fetch(eventPDA);
    expect(event.outcome).to.deep.equal({ winA: {} });
    console.log("   Event Outcome:     ", JSON.stringify(event.outcome));
  });

  it("Settle bets and show detailed results with platform fees", async () => {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                    SETTLEMENT PHASE                            ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    // Get balances before settlement
    const balanceBefore1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const balanceBefore2 = Number((await getAccount(provider.connection, user2TokenAccount)).amount) / 1e6;
    const vaultBalanceBefore = Number((await getAccount(provider.connection, eventTokenVault)).amount) / 1e6;
    const platformFeeBalanceBefore = Number((await getAccount(provider.connection, platformFeeTokenAccount)).amount) / 1e6;

    console.log("\n💰 Balances BEFORE Settlement:");
    console.log("   User 1 (Winner):   ", balanceBefore1, "tokens");
    console.log("   User 2 (Loser):    ", balanceBefore2, "tokens");
    console.log("   Event Vault:       ", vaultBalanceBefore, "tokens");
    console.log("   Platform Fee:      ", platformFeeBalanceBefore, "tokens");

    const event = await program.account.event.fetch(eventPDA);
    const winningPool = Number(event.winAAmount) / 1e6; // Bitcoin won
    const losingPool = Number(event.winBAmount) / 1e6;  // Ethereum lost

    console.log("\n📊 Pool Analysis:");
    console.log("   Winning Pool (Bitcoin):  ", winningPool, "tokens");
    console.log("   Losing Pool (Ethereum):  ", losingPool, "tokens");
    console.log("   Total Pool:              ", winningPool + losingPool, "tokens");

    // Calculate expected payouts
    const user1Bet = 1000;
    const feeBps = 300; // 3%
    const feeAmount = (user1Bet * feeBps) / 10000;
    const netBet = user1Bet - feeAmount;
    const shareOfLosingPool = (netBet / winningPool) * losingPool;
    const expectedPayout = netBet + shareOfLosingPool;

    console.log("\n🧮 Expected Payout Calculation (User 1):");
    console.log("   Original Bet:             ", user1Bet, "tokens");
    console.log("   Platform Fee (3%):        ", feeAmount, "tokens");
    console.log("   Net Bet:                  ", netBet, "tokens");
    console.log("   Share of Losing Pool:     ", shareOfLosingPool.toFixed(2), "tokens");
    console.log("   Expected Total Payout:    ", expectedPayout.toFixed(2), "tokens");
    console.log("   Expected Profit:          ", (expectedPayout - user1Bet).toFixed(2), "tokens");

    // Get bet PDAs
    const [betPDA1] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), user1.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const [betPDA2] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), user2.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // User 1 settles (Winner)
    console.log("\n⚙️  Settling User 1 bet (Winner)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: user1.publicKey,
        bet: betPDA1,
        event: eventPDA,
        eventVault: eventPDA,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: user1TokenAccount,
        eventTokenVault: eventTokenVault,
        platformFeeTokenAccount: platformFeeTokenAccount,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    console.log("   ✅ User 1 settlement complete!");

    // Check balances after User 1 settlement
    const balanceAfterUser1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const platformFeeAfterUser1 = Number((await getAccount(provider.connection, platformFeeTokenAccount)).amount) / 1e6;
    const vaultAfterUser1 = Number((await getAccount(provider.connection, eventTokenVault)).amount) / 1e6;

    console.log("\n💰 Balances AFTER User 1 Settlement:");
    console.log("   User 1:            ", balanceAfterUser1, "tokens (", (balanceAfterUser1 - balanceBefore1 > 0 ? "+" : ""), (balanceAfterUser1 - balanceBefore1).toFixed(2), ")");
    console.log("   Platform Fee:      ", platformFeeAfterUser1, "tokens (", (platformFeeAfterUser1 - platformFeeBalanceBefore > 0 ? "+" : ""), (platformFeeAfterUser1 - platformFeeBalanceBefore).toFixed(2), ")");
    console.log("   Event Vault:       ", vaultAfterUser1, "tokens");

    // User 2 settles (Loser)
    console.log("\n⚙️  Settling User 2 bet (Loser)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: user2.publicKey,
        bet: betPDA2,
        event: eventPDA,
        eventVault: eventPDA,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: user2TokenAccount,
        eventTokenVault: eventTokenVault,
        platformFeeTokenAccount: platformFeeTokenAccount,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();

    console.log("   ✅ User 2 settlement complete!");

    // Get final balances
    const balanceAfter1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const balanceAfter2 = Number((await getAccount(provider.connection, user2TokenAccount)).amount) / 1e6;
    const platformFeeBalanceAfter = Number((await getAccount(provider.connection, platformFeeTokenAccount)).amount) / 1e6;
    const vaultBalanceAfter = Number((await getAccount(provider.connection, eventTokenVault)).amount) / 1e6;

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                       FINAL RESULTS                            ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    console.log("\n💰 Final Balances:");
    console.log("   User 1 (Winner):   ", balanceAfter1, "tokens");
    console.log("   User 2 (Loser):    ", balanceAfter2, "tokens");
    console.log("   Event Vault:       ", vaultBalanceAfter, "tokens");
    console.log("   Platform Fee:      ", platformFeeBalanceAfter, "tokens");

    console.log("\n📈 Net Changes:");
    console.log("   User 1:            ", (balanceAfter1 - balanceBefore1 > 0 ? "+" : ""), (balanceAfter1 - balanceBefore1).toFixed(2), "tokens");
    console.log("   User 2:            ", (balanceAfter2 - balanceBefore2 > 0 ? "+" : ""), (balanceAfter2 - balanceBefore2).toFixed(2), "tokens");
    console.log("   Platform Fee:      ", (platformFeeBalanceAfter - platformFeeBalanceBefore > 0 ? "+" : ""), (platformFeeBalanceAfter - platformFeeBalanceBefore).toFixed(2), "tokens");

    console.log("\n💵 Fee Breakdown:");
    console.log("   Total Collected:   ", (platformFeeBalanceAfter - platformFeeBalanceBefore).toFixed(2), "tokens");
    console.log("   Fee Rate:           3%");
    console.log("   Winner's Bet:       1000 tokens");
    console.log("   Fee from Winner:    30 tokens (3% of 1000)");

    console.log("\n🎯 Verification:");
    console.log("   User 1 Profit:     ", (balanceAfter1 - 5000).toFixed(2), "tokens (from initial 5000)");
    console.log("   User 2 Loss:       ", (balanceAfter2 - 5000).toFixed(2), "tokens (from initial 5000)");
    console.log("   Platform Revenue:  ", platformFeeBalanceAfter.toFixed(2), "tokens");

    // Verify winner got payout
    expect(balanceAfter1).to.be.greaterThan(balanceBefore1);
    expect(balanceAfter2).to.equal(balanceBefore2); // Loser gets nothing
    expect(platformFeeBalanceAfter).to.be.greaterThan(platformFeeBalanceBefore);

    console.log("\n✅ All settlements verified successfully!");
    console.log("✅ Platform fee collection working correctly!");
    console.log("✅ Manual betting closure system operational!");
  });
});
