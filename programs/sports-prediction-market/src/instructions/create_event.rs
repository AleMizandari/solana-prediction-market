use anchor_lang::prelude::*;
use crate::state::{Event, Outcome};
use crate::error::Error;

pub fn create_event(
    ctx: Context<CreateEvent>,
    event_id: u64,
    opponent_a: String,
    opponent_b: String,
    fee_bps: u32,
    token_mint: Option<Pubkey>,
) -> Result<()> {
    let event = &mut ctx.accounts.event;

    // Validate inputs
    require!(fee_bps <= 10000, Error::InvalidFee); // Max 100% fee
    require!(opponent_a.len() <= 32, Error::InvalidStringLength);
    require!(opponent_b.len() <= 32, Error::InvalidStringLength);

    // Determine if using SPL token
    let uses_spl_token = token_mint.is_some();
    let mint_pubkey = if uses_spl_token {
        token_mint.unwrap()
    } else {
        Pubkey::default() // Use default pubkey for SOL
    };

    event.bump = [ctx.bumps.event];
    event.authority = ctx.accounts.authority.key();
    event.event_id = event_id;
    event.opponent_a = opponent_a;
    event.opponent_b = opponent_b;
    event.fee_bps = fee_bps;
    event.platform_fee_account = ctx.accounts.platform_fee_account.key();
    event.betting_open = true; // Betting is open by default, admin can close it manually
    event.outcome = Outcome::Undrawn;
    event.win_a_amount = 0;
    event.win_b_amount = 0;
    event.win_a_count = 0;
    event.win_b_count = 0;
    event.uses_spl_token = uses_spl_token;
    event.token_mint = mint_pubkey;

    emit!(EventCreated {
        event: event.key(),
        event_id,
        opponent_a: event.opponent_a.clone(),
        opponent_b: event.opponent_b.clone(),
        betting_open: true,
        uses_spl_token,
        token_mint: mint_pubkey,
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

    /// CHECK: Platform fee collection account
    #[account(mut)]
    pub platform_fee_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct EventCreated {
    pub event: Pubkey,
    pub event_id: u64,
    pub opponent_a: String,
    pub opponent_b: String,
    pub betting_open: bool,
    pub uses_spl_token: bool,
    pub token_mint: Pubkey,
}
