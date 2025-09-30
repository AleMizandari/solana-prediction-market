use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount};
use crate::state::{Event, Outcome};
use crate::error::Error;

pub fn close_event(
    ctx: Context<CloseEvent>,
) -> Result<()> {
    let event = &mut ctx.accounts.event;

    // Validate that event is settled
    require!(event.outcome != Outcome::Undrawn, Error::EventNotSettled);

    // Close SPL token vault if event uses SPL tokens
    if event.uses_spl_token {
        let event_id_bytes = event.event_id.to_le_bytes();
        let seeds = &[
            b"event",
            event_id_bytes.as_ref(),
            &[event.bump[0]],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = CloseAccount {
            account: ctx.accounts.event_token_vault.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: event.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::close_account(cpi_ctx)?;
    }

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

    // SPL token accounts (only used if event.uses_spl_token = true)
    /// CHECK: Validated in instruction logic when uses_spl_token is true
    #[account(mut)]
    pub event_token_vault: AccountInfo<'info>,

    /// CHECK: Validated in instruction logic when uses_spl_token is true
    pub token_program: AccountInfo<'info>,
}

#[event]
pub struct EventClosed {
    pub event: Pubkey,
    pub event_id: u64,
    pub outcome: Outcome,
    pub total_bets: u32,
}
