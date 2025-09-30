use anchor_lang::prelude::*;
use crate::state::Event;
use crate::error::Error;

pub fn close_betting(ctx: Context<CloseBetting>) -> Result<()> {
    let event = &mut ctx.accounts.event;

    // Check if betting is currently open
    require!(event.betting_open, Error::BettingAlreadyClosed);

    // Close betting
    event.betting_open = false;

    emit!(BettingClosed {
        event: event.key(),
        event_id: event.event_id,
        closed_by: ctx.accounts.authority.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CloseBetting<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = event.authority == authority.key() @ Error::Unauthorized,
    )]
    pub event: Account<'info, Event>,
}

#[event]
pub struct BettingClosed {
    pub event: Pubkey,
    pub event_id: u64,
    pub closed_by: Pubkey,
}
