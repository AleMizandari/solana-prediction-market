import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SportsPredictionMarket } from "../target/types/sports_prediction_market";
import { expect } from "chai";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("sports-prediction-market", () => {
  // Create a test wallet for the provider
  const testWallet = anchor.web3.Keypair.generate();
  
  // Configure the client to use the local cluster with a test wallet
  const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(testWallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.SportsPredictionMarket as Program<SportsPredictionMarket>;

  // Program ID from Anchor.toml
  const PROGRAM_ID = new PublicKey("5kmkxnmH5Jg9RfBxPwTughpTsGcSepobKxkK9ufFAXWp");

  // Test wallets
  let wallet1: Keypair;
  let wallet2: Keypair;
  let wallet3: Keypair;
  let wallet4: Keypair;

  before(async () => {
    // Airdrop SOL to the test wallet (provider)
    const airdropSignature = await connection.requestAirdrop(testWallet.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);
    
    // Create 4 test wallets
    wallet1 = Keypair.generate();
    wallet2 = Keypair.generate();
    wallet3 = Keypair.generate();
    wallet4 = Keypair.generate();

    console.log("Created 4 test wallets:");
    console.log("Wallet 1:", wallet1.publicKey.toString());
    console.log("Wallet 2:", wallet2.publicKey.toString());
    console.log("Wallet 3:", wallet3.publicKey.toString());
    console.log("Wallet 4:", wallet4.publicKey.toString());
    
    console.log("Test provider wallet:", testWallet.publicKey.toString());
  });

  it("Airdrops 2 SOL to each wallet", async () => {
    const airdropAmount = 2 * LAMPORTS_PER_SOL;

    // Airdrop to wallet1
    const signature1 = await provider.connection.requestAirdrop(wallet1.publicKey, airdropAmount);
    await provider.connection.confirmTransaction(signature1);

    // Airdrop to wallet2
    const signature2 = await provider.connection.requestAirdrop(wallet2.publicKey, airdropAmount);
    await provider.connection.confirmTransaction(signature2);

    // Airdrop to wallet3
    const signature3 = await provider.connection.requestAirdrop(wallet3.publicKey, airdropAmount);
    await provider.connection.confirmTransaction(signature3);

    // Airdrop to wallet4
    const signature4 = await provider.connection.requestAirdrop(wallet4.publicKey, airdropAmount);
    await provider.connection.confirmTransaction(signature4);

    // Check balances
    const balance1 = await provider.connection.getBalance(wallet1.publicKey);
    const balance2 = await provider.connection.getBalance(wallet2.publicKey);
    const balance3 = await provider.connection.getBalance(wallet3.publicKey);
    const balance4 = await provider.connection.getBalance(wallet4.publicKey);

    console.log("Wallet balances after airdrop:");
    console.log("Wallet 1:", balance1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", balance2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", balance3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", balance4 / LAMPORTS_PER_SOL, "SOL");

    expect(balance1).to.be.greaterThan(0);
    expect(balance2).to.be.greaterThan(0);
    expect(balance3).to.be.greaterThan(0);
    expect(balance4).to.be.greaterThan(0);
  });

  it("Connects to the sports prediction market program", async () => {
    // Verify program is deployed
    const programInfo = await provider.connection.getAccountInfo(PROGRAM_ID);
    expect(programInfo).to.not.be.null;
    expect(programInfo!.executable).to.be.true;

    console.log("Successfully connected to program:", PROGRAM_ID.toString());
    console.log("Program is executable:", programInfo!.executable);
  });

  // Global variables for the betting event
  let eventId: number;
  let eventPDA: PublicKey;
  let eventVault: Keypair;

  it("Creates a betting event: Will Ronaldo be TOP 1 player?", async () => {
    // Use a random event ID to avoid conflicts with previous test runs
    eventId = Math.floor(Math.random() * 1000000) + 1000;
    const opponentA = "Yes";
    const opponentB = "No";
    const feeBps = 300; // 3% fee
    const developerFeeBps = 100; // 1% developer fee

    // Generate event PDA - event ID needs to be in little-endian bytes
    const eventIdBuffer = Buffer.alloc(8);
    eventIdBuffer.writeUInt32LE(eventId, 0);
    [eventPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("event"), eventIdBuffer],
      PROGRAM_ID
    );

    // Use the event PDA as the vault - it should be able to hold SOL
    eventVault = eventPDA;

    // Create fee accounts (using test wallet for simplicity)
    const feeAccount = testWallet.publicKey;
    const developerFeeAccount = testWallet.publicKey;

    console.log("Creating event with ID:", eventId);
    console.log("Event PDA:", eventPDA.toString());
    console.log("Question: Will Ronaldo be TOP 1 player?");
    console.log("Options: Yes vs No");

    try {
      const tx = await program.methods
        .createEvent(
          new anchor.BN(eventId),
          opponentA,
          opponentB,
          feeBps,
          developerFeeBps
        )
      .accounts({
        authority: testWallet.publicKey,
        feeAccount: feeAccount,
        developerFeeAccount: developerFeeAccount,
      })
        .signers([testWallet])
        .rpc();

      console.log("Event created successfully!");
      console.log("Transaction signature:", tx);

      // Verify the event was created
      const eventAccount = await program.account.event.fetch(eventPDA);
      expect(eventAccount.eventId.toNumber()).to.equal(eventId);
      expect(eventAccount.opponentA).to.equal(opponentA);
      expect(eventAccount.opponentB).to.equal(opponentB);
      expect(eventAccount.feeBps).to.equal(feeBps);
      expect(eventAccount.developerFeeBps).to.equal(developerFeeBps);
      expect(eventAccount.outcome).to.deep.equal({ undrawn: {} });

      console.log("Event details verified:");
      console.log("- Event ID:", eventAccount.eventId.toNumber());
      console.log("- Opponent A (Yes):", eventAccount.opponentA);
      console.log("- Opponent B (No):", eventAccount.opponentB);
      console.log("- Fee (bps):", eventAccount.feeBps);
      console.log("- Developer Fee (bps):", eventAccount.developerFeeBps);
      console.log("- Betting End Time:", new Date(eventAccount.bettingEndTime.toNumber() * 1000).toISOString());
      console.log("- Current Outcome:", eventAccount.outcome);

    } catch (error) {
      console.error("Failed to create event:", error);
      throw error;
    }
  });

  it("Creates and funds the event vault account", async () => {
    console.log("\n=== CREATING VAULT ACCOUNT ===");
    
    // Airdrop some SOL to the vault account to cover rent and initial funding
    const vaultAirdropSignature = await provider.connection.requestAirdrop(eventVault, 1 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(vaultAirdropSignature);
    
    console.log("Event vault created:", eventVault.toString());
    console.log("Vault balance:", (await provider.connection.getBalance(eventVault)) / LAMPORTS_PER_SOL, "SOL");
  });

  it("Multiple wallets place bets on different outcomes", async () => {
    console.log("\n=== BETTING PHASE ===");
    
    // Track initial balances
    const initialBalances = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("Initial balances:");
    console.log("Wallet 1:", initialBalances.wallet1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", initialBalances.wallet2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", initialBalances.wallet3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", initialBalances.wallet4 / LAMPORTS_PER_SOL, "SOL");

    // Wallet 1 bets 0.5 SOL on "Yes" (WinA)
    const betAmount1 = 0.5 * LAMPORTS_PER_SOL;
    const [betPDA1] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet1.publicKey.toBuffer()],
      PROGRAM_ID
    );

    console.log("\nWallet 1 betting 0.5 SOL on 'Yes'...");
    const tx1 = await program.methods
      .createBet({ winA: {} }, new anchor.BN(betAmount1))
      .accounts({
        authority: wallet1.publicKey,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet1])
      .rpc();

    console.log("Wallet 1 bet transaction:", tx1);

    // Wallet 2 bets 0.3 SOL on "No" (WinB)
    const betAmount2 = 0.3 * LAMPORTS_PER_SOL;
    const [betPDA2] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet2.publicKey.toBuffer()],
      PROGRAM_ID
    );

    console.log("\nWallet 2 betting 0.3 SOL on 'No'...");
    const tx2 = await program.methods
      .createBet({ winB: {} }, new anchor.BN(betAmount2))
      .accounts({
        authority: wallet2.publicKey,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet2])
      .rpc();

    console.log("Wallet 2 bet transaction:", tx2);

    // Wallet 3 bets 0.8 SOL on "Yes" (WinA)
    const betAmount3 = 0.8 * LAMPORTS_PER_SOL;
    const [betPDA3] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet3.publicKey.toBuffer()],
      PROGRAM_ID
    );

    console.log("\nWallet 3 betting 0.8 SOL on 'Yes'...");
    const tx3 = await program.methods
      .createBet({ winA: {} }, new anchor.BN(betAmount3))
      .accounts({
        authority: wallet3.publicKey,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet3])
      .rpc();

    console.log("Wallet 3 bet transaction:", tx3);

    // Wallet 4 bets 0.4 SOL on "No" (WinB)
    const betAmount4 = 0.4 * LAMPORTS_PER_SOL;
    const [betPDA4] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet4.publicKey.toBuffer()],
      PROGRAM_ID
    );

    console.log("\nWallet 4 betting 0.4 SOL on 'No'...");
    const tx4 = await program.methods
      .createBet({ winB: {} }, new anchor.BN(betAmount4))
      .accounts({
        authority: wallet4.publicKey,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet4])
      .rpc();

    console.log("Wallet 4 bet transaction:", tx4);

    // Verify event state after all bets
    const eventAccount = await program.account.event.fetch(eventPDA);
    console.log("\nEvent state after all bets:");
    console.log("- Total bet on 'Yes' (WinA):", eventAccount.winAAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("- Total bet on 'No' (WinB):", eventAccount.winBAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("- Number of bets on 'Yes':", eventAccount.winACount);
    console.log("- Number of bets on 'No':", eventAccount.winBCount);

    // Verify balances after betting
    const balancesAfterBetting = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("\nBalances after betting:");
    console.log("Wallet 1:", balancesAfterBetting.wallet1 / LAMPORTS_PER_SOL, "SOL (lost", (initialBalances.wallet1 - balancesAfterBetting.wallet1) / LAMPORTS_PER_SOL, "SOL)");
    console.log("Wallet 2:", balancesAfterBetting.wallet2 / LAMPORTS_PER_SOL, "SOL (lost", (initialBalances.wallet2 - balancesAfterBetting.wallet2) / LAMPORTS_PER_SOL, "SOL)");
    console.log("Wallet 3:", balancesAfterBetting.wallet3 / LAMPORTS_PER_SOL, "SOL (lost", (initialBalances.wallet3 - balancesAfterBetting.wallet3) / LAMPORTS_PER_SOL, "SOL)");
    console.log("Wallet 4:", balancesAfterBetting.wallet4 / LAMPORTS_PER_SOL, "SOL (lost", (initialBalances.wallet4 - balancesAfterBetting.wallet4) / LAMPORTS_PER_SOL, "SOL)");

    // Verify event vault balance
    const vaultBalance = await provider.connection.getBalance(eventVault);
    console.log("Event vault balance:", vaultBalance / LAMPORTS_PER_SOL, "SOL");

    // Verify all bets were created correctly
    const bet1 = await program.account.bet.fetch(betPDA1);
    const bet2 = await program.account.bet.fetch(betPDA2);
    const bet3 = await program.account.bet.fetch(betPDA3);
    const bet4 = await program.account.bet.fetch(betPDA4);

    expect(bet1.amount.toNumber()).to.equal(betAmount1);
    expect(bet1.outcome).to.deep.equal({ winA: {} });
    expect(bet1.settled).to.be.false;

    expect(bet2.amount.toNumber()).to.equal(betAmount2);
    expect(bet2.outcome).to.deep.equal({ winB: {} });
    expect(bet2.settled).to.be.false;

    expect(bet3.amount.toNumber()).to.equal(betAmount3);
    expect(bet3.outcome).to.deep.equal({ winA: {} });
    expect(bet3.settled).to.be.false;

    expect(bet4.amount.toNumber()).to.equal(betAmount4);
    expect(bet4.outcome).to.deep.equal({ winB: {} });
    expect(bet4.settled).to.be.false;

    console.log("\nAll bets verified successfully!");
  });

  it("Announces the winner: 'Yes' wins!", async () => {
    console.log("\n=== WINNER ANNOUNCEMENT ===");
    
    // Announce winner as "Yes" (WinA)
    console.log("Announcing winner: 'Yes' (WinA)");
    
    const tx = await program.methods
      .announceWinner({ winA: {} })
      .accounts({
        authority: testWallet.publicKey,
        event: eventPDA,
      })
      .signers([testWallet])
      .rpc();

    console.log("Winner announcement transaction:", tx);

    // Verify the event outcome
    const eventAccount = await program.account.event.fetch(eventPDA);
    expect(eventAccount.outcome).to.deep.equal({ winA: {} });

    console.log("Winner announced successfully!");
    console.log("Event outcome:", eventAccount.outcome);
  });

  it("Settles all bets and shows winners/losers", async () => {
    console.log("\n=== BET SETTLEMENT ===");
    
    // Get balances before settlement
    const balancesBeforeSettlement = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("Balances before settlement:");
    console.log("Wallet 1:", balancesBeforeSettlement.wallet1 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 2:", balancesBeforeSettlement.wallet2 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 3:", balancesBeforeSettlement.wallet3 / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet 4:", balancesBeforeSettlement.wallet4 / LAMPORTS_PER_SOL, "SOL");

    // Get bet PDAs
    const [betPDA1] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet1.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA2] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet2.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA3] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet3.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [betPDA4] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), wallet4.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Settle Wallet 1's bet (Winner - bet on "Yes")
    console.log("\nSettling Wallet 1's bet (Winner - bet on 'Yes')...");
    const tx1 = await program.methods
      .settleBet()
      .accounts({
        authority: wallet1.publicKey,
        bet: betPDA1,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet1])
      .rpc();

    console.log("Wallet 1 settlement transaction:", tx1);

    // Settle Wallet 2's bet (Loser - bet on "No")
    console.log("\nSettling Wallet 2's bet (Loser - bet on 'No')...");
    const tx2 = await program.methods
      .settleBet()
      .accounts({
        authority: wallet2.publicKey,
        bet: betPDA2,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet2])
      .rpc();

    console.log("Wallet 2 settlement transaction:", tx2);

    // Settle Wallet 3's bet (Winner - bet on "Yes")
    console.log("\nSettling Wallet 3's bet (Winner - bet on 'Yes')...");
    const tx3 = await program.methods
      .settleBet()
      .accounts({
        authority: wallet3.publicKey,
        bet: betPDA3,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet3])
      .rpc();

    console.log("Wallet 3 settlement transaction:", tx3);

    // Settle Wallet 4's bet (Loser - bet on "No")
    console.log("\nSettling Wallet 4's bet (Loser - bet on 'No')...");
    const tx4 = await program.methods
      .settleBet()
      .accounts({
        authority: wallet4.publicKey,
        bet: betPDA4,
        event: eventPDA,
        eventVault: eventVault,
      })
      .signers([wallet4])
      .rpc();

    console.log("Wallet 4 settlement transaction:", tx4);

    // Get balances after settlement
    const balancesAfterSettlement = {
      wallet1: await provider.connection.getBalance(wallet1.publicKey),
      wallet2: await provider.connection.getBalance(wallet2.publicKey),
      wallet3: await provider.connection.getBalance(wallet3.publicKey),
      wallet4: await provider.connection.getBalance(wallet4.publicKey),
    };

    console.log("\n=== FINAL RESULTS ===");
    console.log("Balances after settlement:");
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

    console.log("\nNet gains/losses:");
    console.log("Wallet 1 (Winner - bet on 'Yes'):", netResults.wallet1 > 0 ? "+" : "", netResults.wallet1, "SOL");
    console.log("Wallet 2 (Loser - bet on 'No'):", netResults.wallet2 > 0 ? "+" : "", netResults.wallet2, "SOL");
    console.log("Wallet 3 (Winner - bet on 'Yes'):", netResults.wallet3 > 0 ? "+" : "", netResults.wallet3, "SOL");
    console.log("Wallet 4 (Loser - bet on 'No'):", netResults.wallet4 > 0 ? "+" : "", netResults.wallet4, "SOL");

    // Verify all bets are settled
    const bet1 = await program.account.bet.fetch(betPDA1);
    const bet2 = await program.account.bet.fetch(betPDA2);
    const bet3 = await program.account.bet.fetch(betPDA3);
    const bet4 = await program.account.bet.fetch(betPDA4);

    expect(bet1.settled).to.be.true;
    expect(bet2.settled).to.be.true;
    expect(bet3.settled).to.be.true;
    expect(bet4.settled).to.be.true;

    // Verify winners got more money back, losers got nothing
    expect(netResults.wallet1).to.be.greaterThan(0); // Winner
    expect(netResults.wallet2).to.equal(0); // Loser
    expect(netResults.wallet3).to.be.greaterThan(0); // Winner
    expect(netResults.wallet4).to.equal(0); // Loser

    console.log("\n✅ All bets settled successfully!");
    console.log("✅ Winners received their payouts!");
    console.log("✅ Losers received nothing (as expected)!");
  });
});
