# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Solana smart contract for a sports prediction market built with the Anchor framework. Users can create betting events, place bets on outcomes, and settle winnings after events conclude.

## Development Commands

### Building
```bash
anchor build
```

### Testing
```bash
# Run all tests
anchor test

# Run tests with Yarn (as configured in Anchor.toml)
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts

# Run specific test file
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/sports-prediction-market.ts
```

### Linting
```bash
# Check formatting
yarn lint

# Fix formatting
yarn lint:fix
```

### Local Validator
```bash
# Start local validator (if needed separately)
solana-test-validator
```

## Architecture

### Program Structure

The smart contract follows Anchor's modular structure:

- **lib.rs**: Entry point defining the program ID and public instruction handlers
- **state.rs**: Account structures (`Event`, `Bet`) and constants
- **error.rs**: Custom error types
- **instructions/**: Individual instruction modules (create_event, create_bet, announce_winner, settle_bet, close_event)

### Core Concepts

**Event PDA**: The Event account serves dual purposes:
1. Stores event metadata and betting state
2. Acts as the SOL vault (the Event PDA itself holds the SOL)

**Bet Account**: Created per user per event using seeds `[b"bet", event.key(), authority.key()]`

**Outcome Enum**: `Undrawn`, `Invalid`, `WinA`, `WinB`

### Instruction Flow

1. **create_event**: Creates an event with two opponents, sets 24-hour betting window, stores fee rates
2. **create_bet**: User places bet on WinA or WinB, transfers SOL to event vault, updates event totals
3. **announce_winner**: Authority sets the outcome (WinA/WinB/Invalid)
4. **settle_bet**: Users claim winnings based on proportional payout formula (bet share of winning pool gets proportional share of losing pool minus fees)
5. **close_event**: Authority closes event and reclaims rent

### Fee Structure

Two fee types are applied to winning bets:
- `fee_bps`: Platform fee in basis points (e.g., 300 = 3%)
- `developer_fee_bps`: Developer fee in basis points

Fees are deducted from the bet amount before calculating the share of the losing pool.

### Account Seeds

- Event: `[b"event", event_id.to_le_bytes()]`
- Bet: `[b"bet", event.key(), authority.key()]`

## Important Constraints

- Betting ends 24 hours after event creation (hardcoded in create_event)
- Opponent names limited to 32 characters
- Fee rates cannot exceed 10000 basis points (100%)
- Only authority can announce winner
- Bets cannot be modified once placed
- Event must be settled before bets can be settled

## Configuration

- Program ID: `71MzeGyujpPthcwVQ5tC1p2eweBMbF6radaCdaJgsit9`
- Default cluster: localnet
- Package manager: yarn
- Wallet: `~/.config/solana/id.json`
