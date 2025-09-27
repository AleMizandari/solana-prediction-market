use anchor_lang::prelude::*;
use crate::state::{Event, Outcome};
use crate::error::Error;

pub fn announce_winner(
    ctx: Context<AnnounceWinner>,
    winner: Outcome,
) -> Result<()> {
    let event = &mut ctx.accounts.event;
    
    // Validate inputs
    require!(winner == Outcome::WinA || winner == Outcome::WinB, Error::InvalidOutcome);
    require!(event.outcome == Outcome::Undrawn, Error::EventSettled);
    
    // Set the winner
    event.outcome = winner;
    
    emit!(WinnerAnnounced {
        event: event.key(),
        winner,
        win_a_amount: event.win_a_amount,
        win_b_amount: event.win_b_amount,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct AnnounceWinner<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = event.authority == authority.key() @ Error::Unauthorized,
        constraint = event.outcome == Outcome::Undrawn @ Error::EventSettled,
    )]
    pub event: Account<'info, Event>,
}

#[event]
pub struct WinnerAnnounced {
    pub event: Pubkey,
    pub winner: Outcome,
    pub win_a_amount: u128,
    pub win_b_amount: u128,
}
