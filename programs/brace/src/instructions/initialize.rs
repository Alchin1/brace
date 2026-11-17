use anchor_lang::prelude::*;

use crate::{constants::*, error::BraceError, state::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(ctx: Context<Initialize>, params: Params, relayer: Pubkey) -> Result<()> {
    require!(params.is_valid(), BraceError::InvalidParams);
    require!(relayer != Pubkey::default(), BraceError::InvalidParams);
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.relayer = relayer;
    config.params = params;
    config.bump = ctx.bumps.config;
    Ok(())
}
