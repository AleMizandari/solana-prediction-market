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

describe("Close Betting Test", () => {
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

  let eventId: number;
  let eventPDA: PublicKey;

  it("Setup: Create token and wallets", async () => {
    console.log("\n=== SETUP ===");

    // Create wallets
    mintAuthority = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    console.log("User 1:", user1.publicKey.toString());
    console.log("User 2:", user2.publicKey.toString());

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

    console.log("✅ Token created:", tokenMint.toString());

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

    console.log("✅ User 1 balance:", Number(balance1.amount) / 1e6, "tokens");
    console.log("✅ User 2 balance:", Number(balance2.amount) / 1e6, "tokens");
  });

  it("Create betting event with SPL token", async () => {
    console.log("\n=== CREATE EVENT ===");

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

    const tx = await program.methods
      .createEvent(
        new anchor.BN(eventId),
        "Bitcoin",
        "Ethereum",
        300, // 3% fee
        100, // 1% dev fee
        tokenMint
      )
      .accounts({
        authority: provider.wallet.publicKey,
        feeAccount: provider.wallet.publicKey,
        developerFeeAccount: provider.wallet.publicKey,
      })
      .rpc();

    console.log("✅ Event created:", eventPDA.toString());
    console.log("Transaction:", tx);

    const event = await program.account.event.fetch(eventPDA);
    console.log("Betting open:", event.bettingOpen);
    expect(event.bettingOpen).to.be.true;
  });

  it("Users place bets (betting is open)", async () => {
    console.log("\n=== PLACE BETS (BETTING OPEN) ===");

    // User 1 bets 1000 tokens on Bitcoin
    console.log("User 1 betting 1000 tokens on Bitcoin...");
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

    console.log("✅ User 1 bet placed");

    // User 2 bets 800 tokens on Ethereum
    console.log("User 2 betting 800 tokens on Ethereum...");
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

    console.log("✅ User 2 bet placed");

    // Check balances
    const balance1 = await getAccount(provider.connection, user1TokenAccount);
    const balance2 = await getAccount(provider.connection, user2TokenAccount);

    console.log("\nBalances after betting:");
    console.log("User 1:", Number(balance1.amount) / 1e6, "tokens");
    console.log("User 2:", Number(balance2.amount) / 1e6, "tokens");

    const event = await program.account.event.fetch(eventPDA);
    console.log("\nEvent totals:");
    console.log("Bitcoin:", Number(event.winAAmount) / 1e6, "tokens");
    console.log("Ethereum:", Number(event.winBAmount) / 1e6, "tokens");
  });

  it("Admin closes betting", async () => {
    console.log("\n=== CLOSE BETTING ===");

    const tx = await program.methods
      .closeBetting()
      .accounts({
        authority: provider.wallet.publicKey,
        event: eventPDA,
      })
      .rpc();

    console.log("✅ Betting closed!");
    console.log("Transaction:", tx);

    const event = await program.account.event.fetch(eventPDA);
    console.log("Betting open:", event.bettingOpen);
    expect(event.bettingOpen).to.be.false;
  });

  it("Try to bet after betting is closed (should fail)", async () => {
    console.log("\n=== TRY TO BET AFTER CLOSURE ===");

    try {
      // Try to place a NEW bet with user1 on a different outcome (user1 already bet on Bitcoin, now trying Ethereum)
      // This will create a different bet account, so it won't hit "account already exists"
      // But it should fail with "BettingClosed" error

      // Actually, let's try with a fresh keypair to ensure we test the betting closed check
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
        console.log("✅ Bet correctly rejected: Betting is closed by admin");
      } else {
        console.log("❌ Unexpected error:", errorString);
        throw error;
      }
    }
  });

  it("Announce winner", async () => {
    console.log("\n=== ANNOUNCE WINNER ===");

    // Bitcoin wins!
    const tx = await program.methods
      .announceWinner({ winA: {} })
      .accounts({
        authority: provider.wallet.publicKey,
        event: eventPDA,
      })
      .rpc();

    console.log("✅ Winner announced: Bitcoin wins!");
    console.log("Transaction:", tx);

    const event = await program.account.event.fetch(eventPDA);
    expect(event.outcome).to.deep.equal({ winA: {} });
    console.log("Event outcome:", event.outcome);
  });

  it("Settle bets and show results", async () => {
    console.log("\n=== SETTLE BETS ===");

    // Get balances before settlement
    const balanceBefore1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const balanceBefore2 = Number((await getAccount(provider.connection, user2TokenAccount)).amount) / 1e6;

    console.log("\nBalances before settlement:");
    console.log("User 1:", balanceBefore1, "tokens");
    console.log("User 2:", balanceBefore2, "tokens");

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
    console.log("\nSettling User 1 bet (Winner)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: user1.publicKey,
        bet: betPDA1,
        event: eventPDA,
        eventVault: eventPDA,
        userTokenAccount: user1TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    // User 2 settles (Loser)
    console.log("Settling User 2 bet (Loser)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: user2.publicKey,
        bet: betPDA2,
        event: eventPDA,
        eventVault: eventPDA,
        userTokenAccount: user2TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();

    // Get balances after settlement
    const balanceAfter1 = Number((await getAccount(provider.connection, user1TokenAccount)).amount) / 1e6;
    const balanceAfter2 = Number((await getAccount(provider.connection, user2TokenAccount)).amount) / 1e6;

    console.log("\n=== FINAL RESULTS ===");
    console.log("\nBalances after settlement:");
    console.log("User 1:", balanceAfter1, "tokens");
    console.log("User 2:", balanceAfter2, "tokens");

    console.log("\nNet profit/loss:");
    console.log("User 1 (Winner):", balanceAfter1 - balanceBefore1 > 0 ? "+" : "", (balanceAfter1 - balanceBefore1).toFixed(2), "tokens");
    console.log("User 2 (Loser):", balanceAfter2 - balanceBefore2 > 0 ? "+" : "", (balanceAfter2 - balanceBefore2).toFixed(2), "tokens");

    // Verify winner got payout
    expect(balanceAfter1).to.be.greaterThan(balanceBefore1);
    expect(balanceAfter2).to.equal(balanceBefore2); // Loser gets nothing

    console.log("\n✅ Test completed successfully!");
    console.log("✅ Betting closure system works as expected!");
  });
});
