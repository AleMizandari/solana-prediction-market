use anchor_lang::prelude::*;

#[error_code]
pub enum Error {
    #[msg("Event has already been settled")]
    EventSettled,
    #[msg("Event has not been settled yet")]
    EventNotSettled,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid event")]
    InvalidEvent,
    #[msg("Invalid outcome")]
    InvalidOutcome,
    #[msg("Betting period has ended")]
    BettingEnded,
    #[msg("Bet has already been settled")]
    BetSettled,
    #[msg("Zero amount not allowed")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    OverflowError,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Invalid fee rate")]
    InvalidFee,
    #[msg("Invalid string length")]
    InvalidStringLength,
}
