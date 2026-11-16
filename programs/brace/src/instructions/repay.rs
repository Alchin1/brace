use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::{constants::*, error::BraceError, state::*};

#[derive(Accounts)]
pub struct Repay<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [POSITION_SEED, owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ BraceError::Unauthorized
    )]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = usd_mint)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [USD_MINT_SEED], bump = pool.mint_bump)]
    pub usd_mint: Account<'info, Mint>,
    #[account(mut, token::mint = usd_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
    require!(amount > 0 && amount <= ctx.accounts.position.debt, BraceError::InvalidAmount);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.usd_mint.to_account_info(),
                from: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
    )?;
    let pos = &mut ctx.accounts.position;
    pos.debt -= amount;
    let pool = &mut ctx.accounts.pool;
    pool.total_debt = pool.total_debt.checked_sub(amount).ok_or(BraceError::MathOverflow)?;
    emit!(Repaid { owner: pos.owner, amount });
    msg!("brace repay owner={} amount={} debt={}", pos.owner, amount, pos.debt);
    Ok(())
}
