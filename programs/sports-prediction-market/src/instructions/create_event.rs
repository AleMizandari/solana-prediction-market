use anchor_lang::prelude::*;
use crate::state::{Event, Outcome};
use crate::error::Error;

pub fn create_event(
    ctx: Context<CreateEvent>,
    event_id: u64,
    opponent_a: String,
    opponent_b: String,
    fee_bps: u32,
    developer_fee_bps: u32,
) -> Result<()> {
    let event = &mut ctx.accounts.event;
    
    // Validate inputs
    require!(fee_bps <= 10000, Error::InvalidFee); // Max 100% fee
    require!(developer_fee_bps <= 10000, Error::InvalidFee); // Max 100% developer fee
    require!(opponent_a.len() <= 32, Error::InvalidStringLength);
    require!(opponent_b.len() <= 32, Error::InvalidStringLength);
    
    // Set betting end time to 24 hours from now
    let betting_end_time = Clock::get()?.unix_timestamp + 86400; // 24 hours
    
    event.bump = [ctx.bumps.event];
    event.authority = ctx.accounts.authority.key();
    event.event_id = event_id;
    event.opponent_a = opponent_a;
    event.opponent_b = opponent_b;
    event.fee_bps = fee_bps;
    event.developer_fee_bps = developer_fee_bps;
    event.betting_end_time = betting_end_time;
    event.outcome = Outcome::Undrawn;
    event.win_a_amount = 0;
    event.win_b_amount = 0;
    event.win_a_count = 0;
    event.win_b_count = 0;
    event.uses_spl_token = false; // Default to SOL
    
    emit!(EventCreated {
        event: event.key(),
        event_id,
        opponent_a: event.opponent_a.clone(),
        opponent_b: event.opponent_b.clone(),
        betting_end_time,
    });
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(event_id: u64)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"event", event_id.to_le_bytes().as_ref()],
        bump,
        space = Event::SPACE,
        payer = authority,
    )]
    pub event: Account<'info, Event>,

    #[account(mut)]
    pub fee_account: SystemAccount<'info>,

    #[account(mut)]
    pub developer_fee_account: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct EventCreated {
    pub event: Pubkey,
    pub event_id: u64,
    pub opponent_a: String,
    pub opponent_b: String,
    pub betting_end_time: i64,
}
