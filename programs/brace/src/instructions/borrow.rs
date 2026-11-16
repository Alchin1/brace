use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::{constants::*, error::BraceError, state::*};

/// LTV of (debt, collateral) at the feed's spot, checked against the odds-driven
/// effective limit. Logs "brace blocked ..." and fails with RiskTightened if above.
pub fn check_limit(debt: u64, collateral: u64, feed: &Feed, params: &Params) -> Result<(u64, u16)> {
    let now = Clock::get()?.unix_timestamp;
    let limit = feed.effective_ltv_bps(params, now);
    let value = collateral_value_e6(collateral, feed.spot_e6)?;
    let ltv = ltv_bps(debt, value)?;
    if ltv > limit as u64 {
        msg!("brace blocked ltv={} limit={}", ltv, limit);
        return err!(BraceError::RiskTightened);
    }
    Ok((ltv, limit))
}

#[derive(Accounts)]
pub struct Borrow<'info> {
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
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [FEED_SEED, SOL_SYMBOL.as_ref()], bump = sol_feed.bump)]
    pub sol_feed: Account<'info, Feed>,
    #[account(mut, seeds = [USD_MINT_SEED], bump = pool.mint_bump)]
    pub usd_mint: Account<'info, Mint>,
    #[account(mut, token::mint = usd_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
    require!(amount > 0, BraceError::InvalidAmount);
    let pos = &ctx.accounts.position;
    let new_debt = pos.debt.checked_add(amount).ok_or(BraceError::MathOverflow)?;
    let (ltv, limit) =
        check_limit(new_debt, pos.collateral_lamports, &ctx.accounts.sol_feed, &ctx.accounts.config.params)?;

    let bump = [ctx.accounts.pool.bump];
    let seeds: &[&[u8]] = &[POOL_SEED, &bump];
    let signer: &[&[&[u8]]] = &[seeds];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.usd_mint.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.total_debt = pool.total_debt.checked_add(amount).ok_or(BraceError::MathOverflow)?;
    let pos = &mut ctx.accounts.position;
    pos.debt = new_debt;
    emit!(Borrowed { owner: pos.owner, amount, ltv_bps: ltv, limit_bps: limit });
    msg!("brace borrow owner={} amount={} ltv={} limit={}", pos.owner, amount, ltv, limit);
    Ok(())
}
