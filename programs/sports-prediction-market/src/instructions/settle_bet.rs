use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::state::{Event, Bet, Outcome};
use crate::error::Error;

pub fn settle_bet(
    ctx: Context<SettleBet>,
) -> Result<()> {
    let bet = &mut ctx.accounts.bet;
    let event = &mut ctx.accounts.event;
    
    // Validate inputs
    require!(!bet.settled, Error::BetSettled);
    require!(event.outcome != Outcome::Undrawn, Error::EventNotSettled);
    require!(bet.event == event.key(), Error::InvalidEvent);
    
    // Calculate winnings
    let (_total_pool, winning_pool, losing_pool) = if event.outcome == Outcome::WinA {
        (event.win_a_amount + event.win_b_amount, event.win_a_amount, event.win_b_amount)
    } else {
        (event.win_a_amount + event.win_b_amount, event.win_b_amount, event.win_a_amount)
    };
    
    let mut payout = 0u64;
    
    if bet.outcome == event.outcome {
        // Winner - calculate proportional payout
        if winning_pool > 0 {
            let bet_amount = bet.amount as u128;
            let fee_amount = (bet_amount * event.fee_bps as u128) / 10000;
            let developer_fee_amount = (bet_amount * event.developer_fee_bps as u128) / 10000;
            let net_bet_amount = bet_amount - fee_amount - developer_fee_amount;
            
            // Calculate proportional share of the losing pool
            let share_of_losing_pool = (net_bet_amount * losing_pool) / winning_pool;
            payout = (net_bet_amount + share_of_losing_pool) as u64;
        }
    } else {
        // Loser - no payout
        payout = 0;
    }
    
    // Mark bet as settled
    bet.settled = true;

    // Transfer payout if any
    if payout > 0 {
        if event.uses_spl_token {
            // Transfer SPL tokens
            let event_id_bytes = event.event_id.to_le_bytes();
            let seeds = &[
                b"event",
                event_id_bytes.as_ref(),
                &[event.bump[0]],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.event_token_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: event.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::transfer(cpi_ctx, payout)?;
        } else {
            // Transfer SOL
            let vault_info = ctx.accounts.event_vault.to_account_info();
            let authority_info = ctx.accounts.authority.to_account_info();

            // Ensure vault has enough lamports
            let vault_lamports = vault_info.lamports();
            require!(vault_lamports >= payout, Error::InsufficientFunds);

            // Move lamports directly (allowed because the program owns the event account)
            **vault_info.try_borrow_mut_lamports()? -= payout;
            **authority_info.try_borrow_mut_lamports()? += payout;
        }
    }
    
    emit!(BetSettled {
        bet: bet.key(),
        event: event.key(),
        authority: bet.authority,
        outcome: bet.outcome,
        amount: bet.amount,
        payout,
        won: bet.outcome == event.outcome,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct SettleBet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = bet.authority == authority.key() @ Error::Unauthorized,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        constraint = bet.event == event.key() @ Error::InvalidEvent,
    )]
    pub event: Account<'info, Event>,

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

    pub system_program: Program<'info, System>,
}

#[event]
pub struct BetSettled {
    pub bet: Pubkey,
    pub event: Pubkey,
    pub authority: Pubkey,
    pub outcome: Outcome,
    pub amount: u64,
    pub payout: u64,
    pub won: bool,
}
