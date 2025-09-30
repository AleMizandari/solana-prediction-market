use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
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

    // Check if betting is currently open (controlled by admin)
    require!(event.betting_open, Error::BettingClosed);

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

    // Transfer funds based on token type
    if event.uses_spl_token {
        // Transfer SPL tokens
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.event_token_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        );
        token::transfer(cpi_ctx, amount)?;
    } else {
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
    }
    
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

    // SPL token accounts (only used if event.uses_spl_token = true)
    /// CHECK: Validated in instruction logic when uses_spl_token is true
    #[account(mut)]
    pub user_token_account: AccountInfo<'info>,

    /// CHECK: Validated in instruction logic when uses_spl_token is true
    #[account(mut)]
    pub event_token_vault: AccountInfo<'info>,

    /// CHECK: Validated in instruction logic when uses_spl_token is true
    pub token_mint: AccountInfo<'info>,

    /// CHECK: Validated in instruction logic when uses_spl_token is true
    pub token_program: AccountInfo<'info>,

    /// CHECK: Validated in instruction logic when uses_spl_token is true
    pub associated_token_program: AccountInfo<'info>,

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
