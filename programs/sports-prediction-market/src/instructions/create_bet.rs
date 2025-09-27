use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::{Event, Bet, Outcome};
use crate::error::Error;

pub fn create_bet(
    ctx: Context<CreateBet>,
    outcome: Outcome,
    amount: u64,
) -> Result<()> {
    let event = &mut ctx.accounts.event;
    let bet = &mut ctx.accounts.bet;
    
    // Validate inputs
    require!(amount > 0, Error::ZeroAmount);
    require!(outcome == Outcome::WinA || outcome == Outcome::WinB, Error::InvalidOutcome);
    
    // Check if betting period is still open
    let current_time = Clock::get()?.unix_timestamp;
    require!(current_time < event.betting_end_time, Error::BettingEnded);
    
    // Check if event is still undrawn
    require!(event.outcome == Outcome::Undrawn, Error::EventSettled);
    
    // Initialize bet account
    bet.bump = [ctx.bumps.bet];
    bet.authority = ctx.accounts.authority.key();
    bet.event = event.key();
    bet.outcome = outcome;
    bet.amount = amount;
    bet.settled = false;
    
    // Update event totals
    if outcome == Outcome::WinA {
        event.win_a_amount = event.win_a_amount.checked_add(amount as u128)
            .ok_or(Error::OverflowError)?;
        event.win_a_count += 1;
    } else {
        event.win_b_amount = event.win_b_amount.checked_add(amount as u128)
            .ok_or(Error::OverflowError)?;
        event.win_b_count += 1;
    }
    
    // Transfer SOL funds
    let transfer_instruction = anchor_lang::system_program::Transfer {
        from: ctx.accounts.authority.to_account_info(),
        to: ctx.accounts.event_vault.to_account_info(),
    };
    
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        ),
        amount,
    )?;
    
    emit!(BetCreated {
        bet: bet.key(),
        event: event.key(),
        authority: bet.authority,
        outcome,
        amount,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct CreateBet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = event.outcome == Outcome::Undrawn @ Error::EventSettled,
    )]
    pub event: Account<'info, Event>,

    #[account(
        init,
        seeds = [b"bet", event.key().as_ref(), authority.key().as_ref()],
        bump,
        space = Bet::SPACE,
        payer = authority,
    )]
    pub bet: Account<'info, Bet>,

    /// CHECK: This is the event PDA used as the SOL vault. It is program-owned and
    /// constrained to equal the `event` PDA via the `constraint` below, which ensures
    /// it matches the expected address. No further type-level checks are necessary.
    #[account(
        mut,
        constraint = event_vault.key() == event.key() @ Error::InvalidEvent,
    )]
    pub event_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct BetCreated {
    pub bet: Pubkey,
    pub event: Pubkey,
    pub authority: Pubkey,
    pub outcome: Outcome,
    pub amount: u64,
}
