# feat: time-locked withdrawal for stuck matches (#171)

## Summary

Implements `claim_timeout_refund` — a trustless escape hatch that lets a player reclaim their deposit if the backend fails to resolve a match within 24 hours. No admin intervention required.

## Problem

Matches that go unresolved (backend outage, network partition, etc.) could leave player funds locked in escrow indefinitely with no on-chain recourse.

## Solution

On `deposit`, the program records `Clock::get().unix_timestamp` (the Solana Ledger clock) into the escrow account. On `claim_timeout_refund`, it checks:

```rust
require!(
    elapsed >= TWENTY_FOUR_HOURS,
    EscrowError::TimeoutNotReached
);
```

Any call before 24 hours elapses returns a deterministic `TimeoutNotReached` error. After the window, the full deposit is transferred back to the player and the escrow PDA is closed (rent reclaimed).

## Changes

### `programs/match-escrow/src/lib.rs`
- New `EscrowAccount` state: stores `match_id`, `player`, `amount`, `deposit_time` (Ledger unix timestamp), and PDA `bump`
- `deposit` instruction: transfers lamports to a PDA seeded by `[b"escrow", player, match_id]` and records `deposit_time`
- `claim_timeout_refund` instruction: enforces the 24-hour guard via `checked_sub` + `require!`, drains the PDA, closes the account
- `has_one = player` constraint prevents a third party from triggering a refund on someone else's escrow
- `DepositEvent` and `RefundEvent` emitted for off-chain indexing
- Custom errors: `TimeoutNotReached`, `UnauthorizedPlayer`, `ArithmeticOverflow`

### `tests/match-escrow.ts`
- Localnet integration tests: deposit flow, early-refund rejection

### `tests/match-escrow-bankrun.ts`
- Bankrun tests using `solana-bankrun` + `anchor-bankrun` for deterministic clock manipulation
- Covers all three paths: deposit timestamp recording, rejection before 24 h, successful refund after `context.setClock()` warp to +25 h
- Verifies escrow PDA is closed (rent returned) after a successful refund

### Project scaffolding
- `Cargo.toml` (workspace), `Anchor.toml`, `package.json`, `tsconfig.json`
- `@coral-xyz/anchor ^0.30.0`, `solana-bankrun`, `anchor-bankrun` dependencies

## Acceptance Criteria

| Scenario | Expected result |
|---|---|
| `claim_timeout_refund` called < 24 h after deposit | Fails with `TimeoutNotReached` |
| `claim_timeout_refund` called >= 24 h after deposit | Succeeds; player balance increases; escrow account closed |
| Third party calls `claim_timeout_refund` on another player's escrow | Fails with `UnauthorizedPlayer` |

## Testing

```bash
# Standard localnet (requires running validator)
anchor test

# Bankrun (no validator needed, deterministic clock)
npx ts-mocha -p tsconfig.json tests/match-escrow-bankrun.ts
```

## Security Notes

- Timestamp uses `Clock::get()` (Ledger sysvar) — not client-supplied, not manipulable by the caller
- `checked_sub` prevents any timestamp arithmetic overflow from silently passing the guard
- PDA seeds include both `player` pubkey and `match_id`, so escrows are isolated per player per match
- `close = player` ensures rent is returned only to the original depositor
