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

describe("SOL and SPL Token Betting Test", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SportsPredictionMarket as Program<SportsPredictionMarket>;
  const PROGRAM_ID = program.programId;

  // Test wallets
  let mintAuthority: Keypair;
  let tokenMint: PublicKey;
  let wallet1: Keypair;
  let wallet2: Keypair;
  let wallet3: Keypair;
  let wallet4: Keypair;

  // Token accounts
  let wallet1TokenAccount: PublicKey;
  let wallet2TokenAccount: PublicKey;
  let wallet3TokenAccount: PublicKey;
  let wallet4TokenAccount: PublicKey;
  let eventTokenVault: PublicKey;
  let platformFeeTokenAccount: PublicKey;

  // SOL Event variables
  let solEventId: number;
  let solEventPDA: PublicKey;
  let solEventVault: PublicKey;

  // SPL Token Event variables
  let tokenEventId: number;
  let tokenEventPDA: PublicKey;

  before(async () => {
    console.log("\n=== SETUP: Creating Wallets and Custom Token ===");

    // Generate mint authority (this will create the token)
    mintAuthority = Keypair.generate();

    // Generate test wallets
    wallet1 = Keypair.generate();
    wallet2 = Keypair.generate();
    wallet3 = Keypair.generate();
    wallet4 = Keypair.generate();

    console.log("Created test wallets:");
    console.log("Mint Authority:", mintAuthority.publicKey.toString());
    console.log("Wallet 1:", wallet1.publicKey.toString());
    console.log("Wallet 2:", wallet2.publicKey.toString());
    console.log("Wallet 3:", wallet3.publicKey.toString());
    console.log("Wallet 4:", wallet4.publicKey.toString());

    // Airdrop SOL to mint authority (for creating mint and transaction fees)
    const airdropSig1 = await provider.connection.requestAirdrop(
      mintAuthority.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig1, "confirmed");

    // Airdrop SOL to wallets (for transaction fees and rent)
    const airdropPromises = [wallet1, wallet2, wallet3, wallet4].map(async (wallet) => {
      const sig = await provider.connection.requestAirdrop(
        wallet.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
    });
    await Promise.all(airdropPromises);

    console.log("\n✅ All wallets funded with SOL for fees");
  });

  it("Creates a custom SPL token", async () => {
    console.log("\n=== CREATING CUSTOM SPL TOKEN ===");

    // Create a new token mint (6 decimals like USDC)
    tokenMint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null, // No freeze authority
      6 // 6 decimals
    );

    console.log("Custom Token Mint Created:", tokenMint.toString());
    console.log("Decimals: 6");
    console.log("Mint Authority:", mintAuthority.publicKey.toString());

    expect(tokenMint).to.not.be.undefined;
  });

  it("Creates token accounts for all wallets", async () => {
    console.log("\n=== CREATING TOKEN ACCOUNTS ===");

    // Create associated token accounts for each wallet
    const wallet1TokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet1.publicKey
    );
    wallet1TokenAccount = wallet1TokenAccountInfo.address;

    const wallet2TokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet2.publicKey
    );
    wallet2TokenAccount = wallet2TokenAccountInfo.address;

    const wallet3TokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet3.publicKey
    );
    wallet3TokenAccount = wallet3TokenAccountInfo.address;

    const wallet4TokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet4.publicKey
    );
    wallet4TokenAccount = wallet4TokenAccountInfo.address;

    console.log("Token accounts created:");
    console.log("Wallet 1 Token Account:", wallet1TokenAccount.toString());
    console.log("Wallet 2 Token Account:", wallet2TokenAccount.toString());
    console.log("Wallet 3 Token Account:", wallet3TokenAccount.toString());
    console.log("Wallet 4 Token Account:", wallet4TokenAccount.toString());
  });

  it("Distributes tokens to all wallets", async () => {
    console.log("\n=== DISTRIBUTING TOKENS ===");

    const amountToMint = 10000 * 1e6; // 10,000 tokens (with 6 decimals)

    // Mint tokens to each wallet
    await mintTo(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet1TokenAccount,
      mintAuthority.publicKey,
      amountToMint
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet2TokenAccount,
      mintAuthority.publicKey,
      amountToMint
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet3TokenAccount,
      mintAuthority.publicKey,
      amountToMint
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      tokenMint,
      wallet4TokenAccount,
      mintAuthority.publicKey,
      amountToMint
    );

    // Verify balances
    const wallet1Balance = await getAccount(provider.connection, wallet1TokenAccount);
    const wallet2Balance = await getAccount(provider.connection, wallet2TokenAccount);
    const wallet3Balance = await getAccount(provider.connection, wallet3TokenAccount);
    const wallet4Balance = await getAccount(provider.connection, wallet4TokenAccount);

    console.log("Token balances after distribution:");
    console.log("Wallet 1:", Number(wallet1Balance.amount) / 1e6, "tokens");
    console.log("Wallet 2:", Number(wallet2Balance.amount) / 1e6, "tokens");
    console.log("Wallet 3:", Number(wallet3Balance.amount) / 1e6, "tokens");
    console.log("Wallet 4:", Number(wallet4Balance.amount) / 1e6, "tokens");

    expect(Number(wallet1Balance.amount)).to.equal(amountToMint);
    expect(Number(wallet2Balance.amount)).to.equal(amountToMint);
    expect(Number(wallet3Balance.amount)).to.equal(amountToMint);
    expect(Number(wallet4Balance.amount)).to.equal(amountToMint);
  });

  it("Creates a SOL betting event", async () => {
    console.log("\n=== CREATING SOL BETTING EVENT ===");

    solEventId = Math.floor(Math.random() * 1000000) + 1000;
    const opponentA = "Fighter A";
    const opponentB = "Fighter B";
    const feeBps = 250; // 2.5% fee
    const developerFeeBps = 50; // 0.5% developer fee

    // Generate event PDA
    const eventIdBuffer = Buffer.alloc(8);
    eventIdBuffer.writeUInt32LE(solEventId, 0);
    [solEventPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("event"), eventIdBuffer],
      PROGRAM_ID
    );

    solEventVault = solEventPDA;

    console.log("SOL Event ID:", solEventId);
    console.log("SOL Event PDA:", solEventPDA.toString());
    console.log("Question: Fighter A vs Fighter B (SOL Betting)");

    try {
      const tx = await program.methods
        .createEvent(
          new anchor.BN(solEventId),
          opponentA,
          opponentB,
          feeBps,
          null // null = SOL betting
        )
        .accounts({
          authority: provider.wallet.publicKey,
          platformFeeAccount: provider.wallet.publicKey,
        })
        .rpc();

      console.log("SOL Event created successfully!");
      console.log("Transaction signature:", tx);

      // Verify the event was created
      const eventAccount = await program.account.event.fetch(solEventPDA);
      expect(eventAccount.eventId.toNumber()).to.equal(solEventId);
      expect(eventAccount.opponentA).to.equal(opponentA);
      expect(eventAccount.opponentB).to.equal(opponentB);
      expect(eventAccount.usesSplToken).to.be.false;

      console.log("\nSOL Event details verified:");
      console.log("- Uses SPL Token:", eventAccount.usesSplToken);
      console.log("- Fee (bps):", eventAccount.feeBps);
      console.log("- Developer Fee (bps):", eventAccount.developerFeeBps);
    } catch (error) {
      console.error("Failed to create SOL event:", error);
      throw error;
    }
  });

  it("Wallets place bets using SOL", async () => {
    console.log("\n=== BETTING PHASE WITH SOL ===");

    // Get initial SOL balances
    const initialBalances = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("Initial SOL balances:");
    console.log("Wallet 1:", initialBalances.wallet1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", initialBalances.wallet2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", initialBalances.wallet3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", initialBalances.wallet4 / LAMPORTS_PER_SOL, "SOL");

    // Bet amounts in lamports
    const betAmount1 = 0.3 * LAMPORTS_PER_SOL; // 0.3 SOL
    const betAmount2 = 0.2 * LAMPORTS_PER_SOL; // 0.2 SOL
    const betAmount3 = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL
    const betAmount4 = 0.4 * LAMPORTS_PER_SOL; // 0.4 SOL

    // Wallet 1 bets on Fighter A (WinA)
    console.log("\nWallet 1 betting 0.3 SOL on Fighter A...");
    await program.methods
      .createBet({ winA: {} }, new anchor.BN(betAmount1))
      .accounts({
        authority: wallet1.publicKey,
        event: solEventPDA,
        eventVault: solEventVault,
        userTokenAccount: wallet1.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet1])
      .rpc();

    console.log("✅ Wallet 1 bet placed");

    // Wallet 2 bets on Fighter B (WinB)
    console.log("\nWallet 2 betting 0.2 SOL on Fighter B...");
    await program.methods
      .createBet({ winB: {} }, new anchor.BN(betAmount2))
      .accounts({
        authority: wallet2.publicKey,
        event: solEventPDA,
        eventVault: solEventVault,
        userTokenAccount: wallet2.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet2])
      .rpc();

    console.log("✅ Wallet 2 bet placed");

    // Wallet 3 bets on Fighter A (WinA)
    console.log("\nWallet 3 betting 0.5 SOL on Fighter A...");
    await program.methods
      .createBet({ winA: {} }, new anchor.BN(betAmount3))
      .accounts({
        authority: wallet3.publicKey,
        event: solEventPDA,
        eventVault: solEventVault,
        userTokenAccount: wallet3.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet3])
      .rpc();

    console.log("✅ Wallet 3 bet placed");

    // Wallet 4 bets on Fighter B (WinB)
    console.log("\nWallet 4 betting 0.4 SOL on Fighter B...");
    await program.methods
      .createBet({ winB: {} }, new anchor.BN(betAmount4))
      .accounts({
        authority: wallet4.publicKey,
        event: solEventPDA,
        eventVault: solEventVault,
        userTokenAccount: wallet4.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet4])
      .rpc();

    console.log("✅ Wallet 4 bet placed");

    // Verify event state after all bets
    const eventAccount = await program.account.event.fetch(solEventPDA);
    console.log("\nSOL Event state after all bets:");
    console.log("- Total bet on Fighter A:", Number(eventAccount.winAAmount) / LAMPORTS_PER_SOL, "SOL");
    console.log("- Total bet on Fighter B:", Number(eventAccount.winBAmount) / LAMPORTS_PER_SOL, "SOL");
    console.log("- Number of bets on Fighter A:", eventAccount.winACount);
    console.log("- Number of bets on Fighter B:", eventAccount.winBCount);

    // Verify balances after betting
    const balancesAfterBetting = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("\nSOL balances after betting:");
    console.log("Wallet 1:", balancesAfterBetting.wallet1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", balancesAfterBetting.wallet2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", balancesAfterBetting.wallet3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", balancesAfterBetting.wallet4 / LAMPORTS_PER_SOL, "SOL");

    // Verify vault balance
    const vaultBalance = await provider.connection.getBalance(solEventVault);
    console.log("SOL Event vault balance:", vaultBalance / LAMPORTS_PER_SOL, "SOL");
  });

  it("Announces the winner for SOL event: Fighter A wins!", async () => {
    console.log("\n=== SOL EVENT WINNER ANNOUNCEMENT ===");

    const tx = await program.methods
      .announceWinner({ winA: {} })
      .accounts({
        authority: provider.wallet.publicKey,
        event: solEventPDA,
      })
      .rpc();

    console.log("Winner announcement transaction:", tx);

    // Verify the event outcome
    const eventAccount = await program.account.event.fetch(solEventPDA);
    expect(eventAccount.outcome).to.deep.equal({ winA: {} });

    console.log("Winner announced: Fighter A wins!");
  });

  it("Settles all SOL bets and shows winners/losers", async () => {
    console.log("\n=== SOL BET SETTLEMENT ===");

    // Get balances before settlement
    const balancesBeforeSettlement = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("SOL balances before settlement:");
    console.log("Wallet 1:", balancesBeforeSettlement.wallet1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", balancesBeforeSettlement.wallet2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", balancesBeforeSettlement.wallet3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", balancesBeforeSettlement.wallet4 / LAMPORTS_PER_SOL, "SOL");

    // Get bet PDAs
    const [betPDA1] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), solEventPDA.toBuffer(), wallet1.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA2] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), solEventPDA.toBuffer(), wallet2.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA3] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), solEventPDA.toBuffer(), wallet3.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA4] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), solEventPDA.toBuffer(), wallet4.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Settle all bets
    console.log("\nSettling Wallet 1's bet (Winner)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet1.publicKey,
        bet: betPDA1,
        event: solEventPDA,
        eventVault: solEventVault,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet1.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        platformFeeTokenAccount: provider.wallet.publicKey, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet1])
      .rpc();

    console.log("Settling Wallet 2's bet (Loser)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet2.publicKey,
        bet: betPDA2,
        event: solEventPDA,
        eventVault: solEventVault,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet2.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        platformFeeTokenAccount: provider.wallet.publicKey, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet2])
      .rpc();

    console.log("Settling Wallet 3's bet (Winner)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet3.publicKey,
        bet: betPDA3,
        event: solEventPDA,
        eventVault: solEventVault,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet3.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        platformFeeTokenAccount: provider.wallet.publicKey, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet3])
      .rpc();

    console.log("Settling Wallet 4's bet (Loser)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet4.publicKey,
        bet: betPDA4,
        event: solEventPDA,
        eventVault: solEventVault,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet4.publicKey, // Dummy for SOL betting
        eventTokenVault: solEventPDA, // Dummy for SOL betting
        platformFeeTokenAccount: provider.wallet.publicKey, // Dummy for SOL betting
        tokenMint: solEventPDA, // Dummy for SOL betting
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet4])
      .rpc();

    // Get balances after settlement
    const balancesAfterSettlement = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("\n=== SOL EVENT FINAL RESULTS ===");
    console.log("SOL balances after settlement:");
    console.log("Wallet 1:", balancesAfterSettlement.wallet1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", balancesAfterSettlement.wallet2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", balancesAfterSettlement.wallet3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", balancesAfterSettlement.wallet4 / LAMPORTS_PER_SOL, "SOL");

    // Calculate net gains/losses
    const netResults = {
      wallet1: (balancesAfterSettlement.wallet1 - balancesBeforeSettlement.wallet1) / LAMPORTS_PER_SOL,
      wallet2: (balancesAfterSettlement.wallet2 - balancesBeforeSettlement.wallet2) / LAMPORTS_PER_SOL,
      wallet3: (balancesAfterSettlement.wallet3 - balancesBeforeSettlement.wallet3) / LAMPORTS_PER_SOL,
      wallet4: (balancesAfterSettlement.wallet4 - balancesBeforeSettlement.wallet4) / LAMPORTS_PER_SOL,
    };

    console.log("\nNet gains/losses (SOL):");
    console.log("Wallet 1 (Winner):", netResults.wallet1 > 0 ? "+" : "", netResults.wallet1.toFixed(4), "SOL");
    console.log("Wallet 2 (Loser):", netResults.wallet2 > 0 ? "+" : "", netResults.wallet2.toFixed(4), "SOL");
    console.log("Wallet 3 (Winner):", netResults.wallet3 > 0 ? "+" : "", netResults.wallet3.toFixed(4), "SOL");
    console.log("Wallet 4 (Loser):", netResults.wallet4 > 0 ? "+" : "", netResults.wallet4.toFixed(4), "SOL");

    // Verify winners got more SOL back, losers got nothing
    expect(netResults.wallet1).to.be.greaterThan(0);
    expect(netResults.wallet2).to.equal(0);
    expect(netResults.wallet3).to.be.greaterThan(0);
    expect(netResults.wallet4).to.equal(0);

    console.log("\n✅ All SOL bets settled successfully!");
  });

  it("Creates a betting event with the custom token", async () => {
    console.log("\n=== CREATING BETTING EVENT WITH CUSTOM TOKEN ===");

    tokenEventId = Math.floor(Math.random() * 1000000) + 1000;
    const opponentA = "TeamA";
    const opponentB = "TeamB";
    const feeBps = 300; // 3% fee
    const developerFeeBps = 100; // 1% developer fee

    // Generate event PDA
    const eventIdBuffer = Buffer.alloc(8);
    eventIdBuffer.writeUInt32LE(tokenEventId, 0);
    [tokenEventPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("event"), eventIdBuffer],
      PROGRAM_ID
    );

    // Create associated token account for event PDA (this will be the event token vault)
    const eventTokenVaultInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      tokenEventPDA,
      true // Allow owner to be a PDA
    );
    eventTokenVault = eventTokenVaultInfo.address;

    // Create platform fee token account
    const platformFeeInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAuthority,
      tokenMint,
      provider.wallet.publicKey
    );
    platformFeeTokenAccount = platformFeeInfo.address;

    console.log("Token Event ID:", tokenEventId);
    console.log("Token Event PDA:", tokenEventPDA.toString());
    console.log("Event Token Vault:", eventTokenVault.toString());
    console.log("Token Mint:", tokenMint.toString());
    console.log("Question: TeamA vs TeamB (Token Betting)");

    try {
      const tx = await program.methods
        .createEvent(
          new anchor.BN(tokenEventId),
          opponentA,
          opponentB,
          feeBps,
          tokenMint // Pass the token mint as Option<Pubkey>
        )
        .accounts({
          authority: provider.wallet.publicKey,
          platformFeeAccount: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Token Event created successfully!");
      console.log("Transaction signature:", tx);

      // Verify the event was created
      const eventAccount = await program.account.event.fetch(tokenEventPDA);
      expect(eventAccount.eventId.toNumber()).to.equal(tokenEventId);
      expect(eventAccount.opponentA).to.equal(opponentA);
      expect(eventAccount.opponentB).to.equal(opponentB);
      expect(eventAccount.usesSplToken).to.be.true;
      expect(eventAccount.tokenMint.toString()).to.equal(tokenMint.toString());

      console.log("\nToken Event details verified:");
      console.log("- Uses SPL Token:", eventAccount.usesSplToken);
      console.log("- Token Mint:", eventAccount.tokenMint.toString());
      console.log("- Fee (bps):", eventAccount.feeBps);
      console.log("- Developer Fee (bps):", eventAccount.developerFeeBps);
    } catch (error) {
      console.error("Failed to create token event:", error);
      throw error;
    }
  });

  it("Wallets place bets using the custom token", async () => {
    console.log("\n=== BETTING PHASE WITH CUSTOM TOKEN ===");

    // Get initial token balances
    const initialBalances = {
      wallet1: Number((await getAccount(provider.connection, wallet1TokenAccount)).amount),
      wallet2: Number((await getAccount(provider.connection, wallet2TokenAccount)).amount),
      wallet3: Number((await getAccount(provider.connection, wallet3TokenAccount)).amount),
      wallet4: Number((await getAccount(provider.connection, wallet4TokenAccount)).amount),
    };

    console.log("Initial token balances:");
    console.log("Wallet 1:", initialBalances.wallet1 / 1e6, "tokens");
    console.log("Wallet 2:", initialBalances.wallet2 / 1e6, "tokens");
    console.log("Wallet 3:", initialBalances.wallet3 / 1e6, "tokens");
    console.log("Wallet 4:", initialBalances.wallet4 / 1e6, "tokens");

    // Bet amounts (in token base units with 6 decimals)
    const betAmount1 = 1000 * 1e6; // 1000 tokens
    const betAmount2 = 500 * 1e6;  // 500 tokens
    const betAmount3 = 1500 * 1e6; // 1500 tokens
    const betAmount4 = 800 * 1e6;  // 800 tokens

    // Wallet 1 bets on TeamA (WinA)
    console.log("\nWallet 1 betting 1000 tokens on TeamA...");
    await program.methods
      .createBet({ winA: {} }, new anchor.BN(betAmount1))
      .accounts({
        authority: wallet1.publicKey,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        userTokenAccount: wallet1TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet1])
      .rpc();

    console.log("✅ Wallet 1 bet placed");

    // Wallet 2 bets on TeamB (WinB)
    console.log("\nWallet 2 betting 500 tokens on TeamB...");
    await program.methods
      .createBet({ winB: {} }, new anchor.BN(betAmount2))
      .accounts({
        authority: wallet2.publicKey,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        userTokenAccount: wallet2TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet2])
      .rpc();

    console.log("✅ Wallet 2 bet placed");

    // Wallet 3 bets on TeamA (WinA)
    console.log("\nWallet 3 betting 1500 tokens on TeamA...");
    await program.methods
      .createBet({ winA: {} }, new anchor.BN(betAmount3))
      .accounts({
        authority: wallet3.publicKey,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        userTokenAccount: wallet3TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet3])
      .rpc();

    console.log("✅ Wallet 3 bet placed");

    // Wallet 4 bets on TeamB (WinB)
    console.log("\nWallet 4 betting 800 tokens on TeamB...");
    await program.methods
      .createBet({ winB: {} }, new anchor.BN(betAmount4))
      .accounts({
        authority: wallet4.publicKey,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        userTokenAccount: wallet4TokenAccount,
        eventTokenVault: eventTokenVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet4])
      .rpc();

    console.log("✅ Wallet 4 bet placed");

    // Verify event state after all bets
    const eventAccount = await program.account.event.fetch(tokenEventPDA);
    console.log("\nToken Event state after all bets:");
    console.log("- Total bet on TeamA:", Number(eventAccount.winAAmount) / 1e6, "tokens");
    console.log("- Total bet on TeamB:", Number(eventAccount.winBAmount) / 1e6, "tokens");
    console.log("- Number of bets on TeamA:", eventAccount.winACount);
    console.log("- Number of bets on TeamB:", eventAccount.winBCount);

    // Verify token balances after betting
    const balancesAfterBetting = {
      wallet1: Number((await getAccount(provider.connection, wallet1TokenAccount)).amount),
      wallet2: Number((await getAccount(provider.connection, wallet2TokenAccount)).amount),
      wallet3: Number((await getAccount(provider.connection, wallet3TokenAccount)).amount),
      wallet4: Number((await getAccount(provider.connection, wallet4TokenAccount)).amount),
    };

    console.log("\nToken balances after betting:");
    console.log("Wallet 1:", balancesAfterBetting.wallet1 / 1e6, "tokens (spent", (initialBalances.wallet1 - balancesAfterBetting.wallet1) / 1e6, "tokens)");
    console.log("Wallet 2:", balancesAfterBetting.wallet2 / 1e6, "tokens (spent", (initialBalances.wallet2 - balancesAfterBetting.wallet2) / 1e6, "tokens)");
    console.log("Wallet 3:", balancesAfterBetting.wallet3 / 1e6, "tokens (spent", (initialBalances.wallet3 - balancesAfterBetting.wallet3) / 1e6, "tokens)");
    console.log("Wallet 4:", balancesAfterBetting.wallet4 / 1e6, "tokens (spent", (initialBalances.wallet4 - balancesAfterBetting.wallet4) / 1e6, "tokens)");

    // Verify event vault balance
    const vaultBalance = await getAccount(provider.connection, eventTokenVault);
    console.log("Event vault balance:", Number(vaultBalance.amount) / 1e6, "tokens");

    expect(balancesAfterBetting.wallet1).to.equal(initialBalances.wallet1 - betAmount1);
    expect(balancesAfterBetting.wallet2).to.equal(initialBalances.wallet2 - betAmount2);
    expect(balancesAfterBetting.wallet3).to.equal(initialBalances.wallet3 - betAmount3);
    expect(balancesAfterBetting.wallet4).to.equal(initialBalances.wallet4 - betAmount4);
  });

  it("Announces the winner for token event: TeamA wins!", async () => {
    console.log("\n=== TOKEN EVENT WINNER ANNOUNCEMENT ===");

    const tx = await program.methods
      .announceWinner({ winA: {} })
      .accounts({
        authority: provider.wallet.publicKey,
        event: tokenEventPDA,
      })
      .rpc();

    console.log("Winner announcement transaction:", tx);

    // Verify the event outcome
    const eventAccount = await program.account.event.fetch(tokenEventPDA);
    expect(eventAccount.outcome).to.deep.equal({ winA: {} });

    console.log("Winner announced: TeamA wins!");
  });

  it("Settles all token bets and shows winners/losers", async () => {
    console.log("\n=== TOKEN BET SETTLEMENT ===");

    // Get balances before settlement
    const balancesBeforeSettlement = {
      wallet1: Number((await getAccount(provider.connection, wallet1TokenAccount)).amount),
      wallet2: Number((await getAccount(provider.connection, wallet2TokenAccount)).amount),
      wallet3: Number((await getAccount(provider.connection, wallet3TokenAccount)).amount),
      wallet4: Number((await getAccount(provider.connection, wallet4TokenAccount)).amount),
    };

    console.log("Token balances before settlement:");
    console.log("Wallet 1:", balancesBeforeSettlement.wallet1 / 1e6, "tokens");
    console.log("Wallet 2:", balancesBeforeSettlement.wallet2 / 1e6, "tokens");
    console.log("Wallet 3:", balancesBeforeSettlement.wallet3 / 1e6, "tokens");
    console.log("Wallet 4:", balancesBeforeSettlement.wallet4 / 1e6, "tokens");

    // Get bet PDAs
    const [betPDA1] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), tokenEventPDA.toBuffer(), wallet1.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA2] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), tokenEventPDA.toBuffer(), wallet2.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA3] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), tokenEventPDA.toBuffer(), wallet3.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA4] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), tokenEventPDA.toBuffer(), wallet4.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Settle Wallet 1's bet (Winner - bet on TeamA)
    console.log("\nSettling Wallet 1's bet (Winner)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet1.publicKey,
        bet: betPDA1,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet1TokenAccount,
        eventTokenVault: eventTokenVault,
        platformFeeTokenAccount: platformFeeTokenAccount,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet1])
      .rpc();

    // Settle Wallet 2's bet (Loser - bet on TeamB)
    console.log("Settling Wallet 2's bet (Loser)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet2.publicKey,
        bet: betPDA2,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet2TokenAccount,
        eventTokenVault: eventTokenVault,
        platformFeeTokenAccount: platformFeeTokenAccount,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet2])
      .rpc();

    // Settle Wallet 3's bet (Winner - bet on TeamA)
    console.log("Settling Wallet 3's bet (Winner)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet3.publicKey,
        bet: betPDA3,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet3TokenAccount,
        eventTokenVault: eventTokenVault,
        platformFeeTokenAccount: platformFeeTokenAccount,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet3])
      .rpc();

    // Settle Wallet 4's bet (Loser - bet on TeamB)
    console.log("Settling Wallet 4's bet (Loser)...");
    await program.methods
      .settleBet()
      .accounts({
        authority: wallet4.publicKey,
        bet: betPDA4,
        event: tokenEventPDA,
        eventVault: tokenEventPDA,
        platformFeeAccount: provider.wallet.publicKey,
        userTokenAccount: wallet4TokenAccount,
        eventTokenVault: eventTokenVault,
        platformFeeTokenAccount: platformFeeTokenAccount,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet4])
      .rpc();

    // Get balances after settlement
    const balancesAfterSettlement = {
      wallet1: Number((await getAccount(provider.connection, wallet1TokenAccount)).amount),
      wallet2: Number((await getAccount(provider.connection, wallet2TokenAccount)).amount),
      wallet3: Number((await getAccount(provider.connection, wallet3TokenAccount)).amount),
      wallet4: Number((await getAccount(provider.connection, wallet4TokenAccount)).amount),
    };

    console.log("\n=== TOKEN EVENT FINAL RESULTS ===");
    console.log("Token balances after settlement:");
    console.log("Wallet 1:", balancesAfterSettlement.wallet1 / 1e6, "tokens");
    console.log("Wallet 2:", balancesAfterSettlement.wallet2 / 1e6, "tokens");
    console.log("Wallet 3:", balancesAfterSettlement.wallet3 / 1e6, "tokens");
    console.log("Wallet 4:", balancesAfterSettlement.wallet4 / 1e6, "tokens");

    // Calculate net gains/losses
    const netResults = {
      wallet1: (balancesAfterSettlement.wallet1 - balancesBeforeSettlement.wallet1) / 1e6,
      wallet2: (balancesAfterSettlement.wallet2 - balancesBeforeSettlement.wallet2) / 1e6,
      wallet3: (balancesAfterSettlement.wallet3 - balancesBeforeSettlement.wallet3) / 1e6,
      wallet4: (balancesAfterSettlement.wallet4 - balancesBeforeSettlement.wallet4) / 1e6,
    };

    console.log("\nNet gains/losses:");
    console.log("Wallet 1 (Winner):", netResults.wallet1 > 0 ? "+" : "", netResults.wallet1, "tokens");
    console.log("Wallet 2 (Loser):", netResults.wallet2 > 0 ? "+" : "", netResults.wallet2, "tokens");
    console.log("Wallet 3 (Winner):", netResults.wallet3 > 0 ? "+" : "", netResults.wallet3, "tokens");
    console.log("Wallet 4 (Loser):", netResults.wallet4 > 0 ? "+" : "", netResults.wallet4, "tokens");

    // Verify winners got more tokens back, losers got nothing
    expect(netResults.wallet1).to.be.greaterThan(0);
    expect(netResults.wallet2).to.equal(0);
    expect(netResults.wallet3).to.be.greaterThan(0);
    expect(netResults.wallet4).to.equal(0);

    console.log("\n✅ All bets settled successfully with custom token!");
    console.log("✅ Winners received their token payouts!");
    console.log("✅ Losers received nothing (as expected)!");
  });
});
