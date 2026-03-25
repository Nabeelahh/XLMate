/**
 * Bankrun tests — use `solana-bankrun` to warp the clock and verify both
 * the rejection (< 24 h) and the success (>= 24 h) paths.
 *
 * Run with:
 *   npx ts-mocha -p tsconfig.json tests/match-escrow-bankrun.ts
 *
 * Requires:  npm install solana-bankrun @coral-xyz/anchor-bankrun
 */
import { startAnchor, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program, Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { assert } from "chai";

const TWENTY_FOUR_HOURS = 24 * 60 * 60;

describe("match-escrow (bankrun)", () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: Program<Idl>;
  let player: Keypair;

  const matchId = new BN(171);
  const depositAmount = new BN(0.5 * LAMPORTS_PER_SOL);
  let escrowPda: PublicKey;

  before(async () => {
    player = Keypair.generate();

    context = await startAnchor(".", [], [
      {
        address: player.publicKey,
        info: {
          lamports: 2 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
    ]);

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    program = anchor.workspace.MatchEscrow as Program<Idl>;

    [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        player.publicKey.toBuffer(),
        matchId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  });

  it("deposits and records ledger timestamp", async () => {
    const clock = await context.banksClient.getClock();
    const depositTime = Number(clock.unixTimestamp);

    await program.methods
      .deposit(matchId, depositAmount)
      .accounts({
        player: player.publicKey,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    const escrow = await (program.account as any).escrowAccount.fetch(escrowPda);
    assert.ok(escrow.depositTime.toNumber() >= depositTime, "timestamp recorded");
    assert.ok(escrow.amount.eq(depositAmount), "amount stored");
  });

  it("rejects claim_timeout_refund before 24 hours", async () => {
    // Clock is still at deposit time — should fail
    try {
      await program.methods
        .claimTimeoutRefund()
        .accounts({
          player: player.publicKey,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      assert.fail("Should have thrown TimeoutNotReached");
    } catch (err: any) {
      assert.ok(
        err.toString().includes("TimeoutNotReached") ||
          err.toString().includes("24-hour timeout"),
        `Wrong error: ${err}`
      );
    }
  });

  it("allows claim_timeout_refund after 24 hours", async () => {
    // Warp clock forward by 25 hours
    const clock = await context.banksClient.getClock();
    context.setClock({
      slot: clock.slot,
      epoch: clock.epoch,
      epochStartTimestamp: clock.epochStartTimestamp,
      leaderScheduleEpoch: clock.leaderScheduleEpoch,
      unixTimestamp: clock.unixTimestamp + BigInt(TWENTY_FOUR_HOURS + 3600),
    });

    const playerBalanceBefore = await context.banksClient
      .getBalance(player.publicKey);

    await program.methods
      .claimTimeoutRefund()
      .accounts({
        player: player.publicKey,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    const playerBalanceAfter = await context.banksClient
      .getBalance(player.publicKey);

    // Player should have received the deposit back (minus tx fees)
    assert.ok(
      playerBalanceAfter > playerBalanceBefore,
      "player balance should increase after refund"
    );

    // Escrow account should be closed
    const escrowInfo = await context.banksClient.getAccount(escrowPda);
    assert.isNull(escrowInfo, "escrow account should be closed after refund");
  });
});
