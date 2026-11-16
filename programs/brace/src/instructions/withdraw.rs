use anchor_lang::prelude::*;

use crate::{constants::*, error::BraceError, instructions::borrow::check_limit, state::*};

/// Moves lamports out of the program-owned pool PDA, keeping it rent-exempt.
pub fn pay_from_pool<'info>(pool: &AccountInfo<'info>, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
    let rent = Rent::get()?.minimum_balance(pool.data_len());
    let remaining = pool.lamports().checked_sub(lamports).ok_or(BraceError::InsufficientCollateral)?;
    require!(remaining >= rent, BraceError::InsufficientCollateral);
    **pool.try_borrow_mut_lamports()? = remaining;
    let credited = to.lamports().checked_add(lamports).ok_or(BraceError::MathOverflow)?;
    **to.try_borrow_mut_lamports()? = credited;
    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
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
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [FEED_SEED, SOL_SYMBOL.as_ref()], bump = sol_feed.bump)]
    pub sol_feed: Account<'info, Feed>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, lamports: u64) -> Result<()> {
    require!(lamports > 0, BraceError::InvalidAmount);
    let pos = &ctx.accounts.position;
    require!(lamports <= pos.collateral_lamports, BraceError::InsufficientCollateral);
    let new_collateral = pos.collateral_lamports - lamports;
    // Zero debt: the owner can always exit, even on a stale price.
    if pos.debt > 0 {
        check_limit(pos.debt, new_collateral, &ctx.accounts.sol_feed, &ctx.accounts.config.params)?;
    }

    pay_from_pool(&ctx.accounts.pool.to_account_info(), &ctx.accounts.owner.to_account_info(), lamports)?;

    let pos = &mut ctx.accounts.position;
    pos.collateral_lamports = new_collateral;
    let pool = &mut ctx.accounts.pool;
    pool.total_collateral = pool.total_collateral.checked_sub(lamports).ok_or(BraceError::MathOverflow)?;
    emit!(Withdrawn { owner: pos.owner, lamports });
    msg!("brace withdraw owner={} lamports={}", pos.owner, lamports);
    Ok(())
}
