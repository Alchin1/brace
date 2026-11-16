use anchor_lang::prelude::*;

use crate::{constants::*, error::BraceError, state::*};

#[derive(Accounts)]
pub struct AdminConfig<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ BraceError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

pub fn handle_set_params(ctx: Context<AdminConfig>, params: Params) -> Result<()> {
    require!(params.is_valid(), BraceError::InvalidParams);
    ctx.accounts.config.params = params;
    Ok(())
}

pub fn handle_set_relayer(ctx: Context<AdminConfig>, relayer: Pubkey) -> Result<()> {
    require!(relayer != Pubkey::default(), BraceError::InvalidParams);
    ctx.accounts.config.relayer = relayer;
    Ok(())
}
