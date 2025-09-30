import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SportsPredictionMarket } from "../target/types/sports_prediction_market";
import { expect } from "chai";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import readline from "readline";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

describe("interactive-single-bets", () => {
  const testWallet = anchor.web3.Keypair.generate();

  const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(testWallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.SportsPredictionMarket as Program<SportsPredictionMarket>;
  const PROGRAM_ID = new PublicKey("71MzeGyujpPthcwVQ5tC1p2eweBMbF6radaCdaJgsit9");

  let wallet1: Keypair;
  let wallet2: Keypair;
  let wallet3: Keypair;
  let wallet4: Keypair;

  before(async () => {
    const airdropSignature = await connection.requestAirdrop(testWallet.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);

    wallet1 = Keypair.generate();
    wallet2 = Keypair.generate();
    wallet3 = Keypair.generate();
    wallet4 = Keypair.generate();

    const airdrops = await Promise.all([
      provider.connection.requestAirdrop(wallet1.publicKey, 2 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(wallet2.publicKey, 2 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(wallet3.publicKey, 2 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(wallet4.publicKey, 2 * LAMPORTS_PER_SOL),
    ]);
    await Promise.all(airdrops.map(sig => provider.connection.confirmTransaction(sig)));
  });

  it("Creates a market, places single random bets, announces winner interactively, settles and prints results", async () => {
    const defaultQuestion = "Will Team A win?";
    const question = (await ask(`Enter market question [${defaultQuestion}]: `)).trim() || defaultQuestion;
    console.log("\nQuestion:", question);

    const eventId = Math.floor(Math.random() * 1_000_000) + 1000;
    const opponentA = "Yes";
    const opponentB = "No";
    const feeBps = 300; // 3%
    const developerFeeBps = 100; // 1%

    const eventIdBuffer = Buffer.alloc(8);
    eventIdBuffer.writeUInt32LE(eventId, 0);
    const [eventPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("event"), eventIdBuffer],
      PROGRAM_ID
    );
    const eventVault = eventPDA;

    console.log("Creating event:", eventId);
    await program.methods
      .createEvent(new anchor.BN(eventId), opponentA, opponentB, feeBps, developerFeeBps)
      .accounts({
        authority: testWallet.publicKey,
        feeAccount: testWallet.publicKey,
        developerFeeAccount: testWallet.publicKey,
      })
      .signers([testWallet])
      .rpc();

    // Fund event vault for rent and buffer
    const vaultSig = await provider.connection.requestAirdrop(eventVault, 1 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(vaultSig);
    console.log("Event PDA/Vault:", eventVault.toString());
    console.log("Vault balance:", (await provider.connection.getBalance(eventVault)) / LAMPORTS_PER_SOL, "SOL");

    const betAmountLamports = Math.floor(0.25 * LAMPORTS_PER_SOL);
    const wallets = [wallet1, wallet2, wallet3, wallet4];

    type OutcomeChoice = { label: "Yes" | "No"; ix: any };
    const choices: OutcomeChoice[] = wallets.map(() => Math.random() < 0.5
      ? { label: "Yes", ix: { winA: {} } }
      : { label: "No", ix: { winB: {} } }
    );

    // Create bet PDAs and place bets
    const betPDAs = wallets.map(w => PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), eventPDA.toBuffer(), w.publicKey.toBuffer()],
      PROGRAM_ID
    )[0]);

    for (let i = 0; i < wallets.length; i++) {
      console.log(`Wallet ${i + 1} betting 0.25 SOL on '${choices[i].label}'...`);
      await program.methods
        .createBet(choices[i].ix, new anchor.BN(betAmountLamports))
        .accounts({ authority: wallets[i].publicKey, event: eventPDA, eventVault })
        .signers([wallets[i]])
        .rpc();
    }

    const eventAccountBefore = await program.account.event.fetch(eventPDA);
    console.log("\nEvent totals after betting:");
    console.log("WinA total:", eventAccountBefore.winAAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("WinB total:", eventAccountBefore.winBAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");

    // Ask user to announce winner
    const winnerInput = (await ask("Announce winner (Yes/No): ")).trim().toLowerCase();
    const winnerIx = winnerInput === "yes" ? { winA: {} } : { winB: {} };
    console.log("Announcing winner:", winnerInput === "yes" ? "Yes" : "No");
    await program.methods
      .announceWinner(winnerIx)
      .accounts({ authority: testWallet.publicKey, event: eventPDA })
      .signers([testWallet])
      .rpc();

    // Record balances before settlement
    const balancesBefore = await Promise.all(wallets.map(w => provider.connection.getBalance(w.publicKey)));

    // Settle each bet
    for (let i = 0; i < wallets.length; i++) {
      await program.methods
        .settleBet()
        .accounts({ authority: wallets[i].publicKey, bet: betPDAs[i], event: eventPDA, eventVault })
        .signers([wallets[i]])
        .rpc();
    }

    const balancesAfter = await Promise.all(wallets.map(w => provider.connection.getBalance(w.publicKey)));

    console.log("\n=== RESULTS ===");
    for (let i = 0; i < wallets.length; i++) {
      const delta = (balancesAfter[i] - balancesBefore[i]) / LAMPORTS_PER_SOL;
      const picked = choices[i].label;
      const won = (winnerInput === "yes" && picked === "Yes") || (winnerInput === "no" && picked === "No");
      console.log(`Wallet ${i + 1} picked ${picked} -> ${won ? "WIN" : "LOSE"}; delta: ${delta}`);
    }

    // Basic assertions: losers ~0 change or negative fees very small; winners positive
    const winnerWasYes = winnerInput === "yes";
    const deltas = balancesAfter.map((b, i) => (b - balancesBefore[i]) / LAMPORTS_PER_SOL);
    for (let i = 0; i < wallets.length; i++) {
      const pickedYes = choices[i].label === "Yes";
      if (pickedYes === winnerWasYes) {
        expect(deltas[i]).to.be.greaterThan(0);
      }
    }
  });
});


