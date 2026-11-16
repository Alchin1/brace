use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::{constants::*, error::BraceError, instructions::withdraw::pay_from_pool, state::*};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(mut, token::mint = usd_mint, token::authority = liquidator)]
    pub liquidator_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [POSITION_SEED, position.owner.as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [FEED_SEED, SOL_SYMBOL.as_ref()], bump = sol_feed.bump)]
    pub sol_feed: Account<'info, Feed>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = usd_mint)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [USD_MINT_SEED], bump = pool.mint_bump)]
    pub usd_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_liquidate(ctx: Context<Liquidate>) -> Result<()> {
    let pos = &ctx.accounts.position;
    let spot = ctx.accounts.sol_feed.spot_e6;
    let debt = pos.debt;
    let collateral = pos.collateral_lamports;
    let value = collateral_value_e6(collateral, spot)?;
    let ltv = ltv_bps(debt, value)?;
    // Hard threshold only: never the odds-driven effective limit.
    require!(ltv > ctx.accounts.config.params.liq_threshold_bps as u64, BraceError::NotLiquidatable);

    let seize = if spot == 0 {
        collateral
    } else {
        let debt_lamports = (debt as u128)
            .checked_mul(LAMPORTS_PER_SOL)
            .ok_or(BraceError::MathOverflow)?
            .div_ceil(spot as u128);
        let with_bonus = debt_lamports.checked_mul(LIQ_BONUS_BPS).ok_or(BraceError::MathOverflow)? / 10_000;
        with_bonus.min(collateral as u128) as u64
    };

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.usd_mint.to_account_info(),
                from: ctx.accounts.liquidator_token.to_account_info(),
                authority: ctx.accounts.liquidator.to_account_info(),
            },
        ),
        debt,
    )?;
    pay_from_pool(&ctx.accounts.pool.to_account_info(), &ctx.accounts.liquidator.to_account_info(), seize)?;

    let owner = ctx.accounts.position.owner;
    let pos = &mut ctx.accounts.position;
    pos.debt = 0;
    pos.collateral_lamports = collateral - seize;
    let pool = &mut ctx.accounts.pool;
    pool.total_debt = pool.total_debt.checked_sub(debt).ok_or(BraceError::MathOverflow)?;
    pool.total_collateral = pool.total_collateral.checked_sub(seize).ok_or(BraceError::MathOverflow)?;
    let liquidator = ctx.accounts.liquidator.key();
    emit!(Liquidated { owner, liquidator, debt, seized: seize });
    msg!("brace liquidate owner={} ltv={} debt={} seized={}", owner, ltv, debt, seize);
    Ok(())
}
