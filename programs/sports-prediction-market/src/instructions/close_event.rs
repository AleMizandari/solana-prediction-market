use anchor_lang::prelude::*;
use crate::state::{Event, Outcome};
use crate::error::Error;

pub fn close_event(
    ctx: Context<CloseEvent>,
) -> Result<()> {
    let event = &mut ctx.accounts.event;
    
    // Validate that event is settled
    require!(event.outcome != Outcome::Undrawn, Error::EventNotSettled);
    
    emit!(EventClosed {
        event: event.key(),
        event_id: event.event_id,
        outcome: event.outcome,
        total_bets: event.win_a_count + event.win_b_count,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct CloseEvent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = event.authority == authority.key() @ Error::Unauthorized,
        constraint = event.outcome != Outcome::Undrawn @ Error::EventNotSettled,
        close = authority,
    )]
    pub event: Account<'info, Event>,
}

#[event]
pub struct EventClosed {
    pub event: Pubkey,
    pub event_id: u64,
    pub outcome: Outcome,
    pub total_bets: u32,
}
