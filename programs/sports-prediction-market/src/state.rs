use anchor_lang::prelude::*;

pub mod outcome;

pub use outcome::Outcome;

pub const EVENT_SIZE: usize = 8 + 1 + 32 + 8 + 64 + 64 + 4 + 32 + 1 + 1 + 16 + 16 + 4 + 4 + 1 + 32;

pub const BET_SIZE: usize = 8 + 1 + 32 + 32 + 1 + 8 + 1;

#[account]
pub struct Event {
    /// Bump seed used to generate the program address
    pub bump: [u8; 1],
    /// Authority who can announce the winner and control betting
    pub authority: Pubkey,
    /// Unique event identifier
    pub event_id: u64,
    /// Name of opponent A (e.g., "Fighter A")
    pub opponent_a: String,
    /// Name of opponent B (e.g., "Fighter B")
    pub opponent_b: String,
    /// Platform fee rate in basis points (e.g., 300 = 3%)
    pub fee_bps: u32,
    /// Platform fee collection account
    pub platform_fee_account: Pubkey,
    /// Whether betting is currently open (controlled by authority)
    pub betting_open: bool,
    /// Outcome of the event
    pub outcome: Outcome,
    /// Total amount bet on opponent A
    pub win_a_amount: u128,
    /// Total amount bet on opponent B
    pub win_b_amount: u128,
    /// Number of bets on opponent A
    pub win_a_count: u32,
    /// Number of bets on opponent B
    pub win_b_count: u32,
    /// Whether the event uses SPL tokens (false = SOL)
    pub uses_spl_token: bool,
    /// Token mint address (None for SOL)
    pub token_mint: Pubkey,
}

impl Event {
    pub const SPACE: usize = EVENT_SIZE;
}

#[account]
pub struct Bet {
    /// Bump seed used to generate the program address
    pub bump: [u8; 1],
    /// Authority who placed the bet
    pub authority: Pubkey,
    /// Event this bet is for
    pub event: Pubkey,
    /// Outcome bet on
    pub outcome: Outcome,
    /// Amount bet
    pub amount: u64,
    /// Whether this bet has been settled
    pub settled: bool,
}

impl Bet {
    pub const SPACE: usize = BET_SIZE;
}
