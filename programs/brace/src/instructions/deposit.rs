use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{constants::*, error::BraceError, state::*};

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

pub fn handle_open_position(ctx: Context<OpenPosition>) -> Result<()> {
    let p = &mut ctx.accounts.position;
    p.owner = ctx.accounts.owner.key();
    p.collateral_lamports = 0;
    p.debt = 0;
    p.bump = ctx.bumps.position;
    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [POSITION_SEED, owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ BraceError::Unauthorized
    )]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    pub system_program: Program<'info, System>,
}

pub fn handle_deposit(ctx: Context<Deposit>, lamports: u64) -> Result<()> {
    require!(lamports > 0, BraceError::InvalidAmount);
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.pool.to_account_info(),
            },
        ),
        lamports,
    )?;
    let p = &mut ctx.accounts.position;
    p.collateral_lamports = p.collateral_lamports.checked_add(lamports).ok_or(BraceError::MathOverflow)?;
    let pool = &mut ctx.accounts.pool;
    pool.total_collateral = pool.total_collateral.checked_add(lamports).ok_or(BraceError::MathOverflow)?;
    emit!(Deposited { owner: p.owner, lamports });
    msg!("brace deposit owner={} lamports={}", p.owner, lamports);
    Ok(())
}
