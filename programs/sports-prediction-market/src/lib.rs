use anchor_lang::prelude::*;

pub mod state;
pub mod error;
pub mod instructions;

use state::Outcome;
use instructions::*;

declare_id!("71MzeGyujpPthcwVQ5tC1p2eweBMbF6radaCdaJgsit9");

#[program]
pub mod sports_prediction_market {
    use super::*;

    pub fn create_event(
        ctx: Context<CreateEvent>,
        event_id: u64,
        opponent_a: String,
        opponent_b: String,
        fee_bps: u32,
        token_mint: Option<Pubkey>,
    ) -> Result<()> {
        instructions::create_event(ctx, event_id, opponent_a, opponent_b, fee_bps, token_mint)
    }

    pub fn create_bet(
        ctx: Context<CreateBet>,
        outcome: Outcome,
        amount: u64,
    ) -> Result<()> {
        instructions::create_bet(ctx, outcome, amount)
    }

    pub fn close_betting(
        ctx: Context<CloseBetting>,
    ) -> Result<()> {
        instructions::close_betting(ctx)
    }

    pub fn announce_winner(
        ctx: Context<AnnounceWinner>,
        winner: Outcome,
    ) -> Result<()> {
        instructions::announce_winner(ctx, winner)
    }

    pub fn settle_bet(
        ctx: Context<SettleBet>,
    ) -> Result<()> {
        instructions::settle_bet(ctx)
    }

    pub fn close_event(
        ctx: Context<CloseEvent>,
    ) -> Result<()> {
        instructions::close_event(ctx)
    }
}