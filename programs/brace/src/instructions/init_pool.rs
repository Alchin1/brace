use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::system_program;
use anchor_spl::token::{self, spl_token, InitializeMint2, Token};

use crate::{constants::*, error::BraceError, state::*};

#[derive(Accounts)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ BraceError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + Pool::INIT_SPACE, seeds = [POOL_SEED], bump)]
    pub pool: Account<'info, Pool>,
    /// CHECK: test USD mint PDA, created and initialized in the handler
    /// (system create_account signed by the PDA, then InitializeMint2).
    #[account(mut, seeds = [USD_MINT_SEED], bump)]
    pub usd_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_pool(ctx: Context<InitPool>) -> Result<()> {
    let mint_bump = ctx.bumps.usd_mint;
    let space = spl_token::state::Mint::LEN;
    let rent = Rent::get()?.minimum_balance(space);
    let bump_seed = [mint_bump];
    let seeds: &[&[u8]] = &[USD_MINT_SEED, &bump_seed];
    let signer: &[&[&[u8]]] = &[seeds];
    system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            system_program::CreateAccount {
                from: ctx.accounts.admin.to_account_info(),
                to: ctx.accounts.usd_mint.to_account_info(),
            },
            signer,
        ),
        rent,
        space as u64,
        &spl_token::ID,
    )?;
    token::initialize_mint2(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            InitializeMint2 { mint: ctx.accounts.usd_mint.to_account_info() },
        ),
        USD_DECIMALS,
        &ctx.accounts.pool.key(),
        None,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.usd_mint = ctx.accounts.usd_mint.key();
    pool.total_debt = 0;
    pool.total_collateral = 0;
    pool.bump = ctx.bumps.pool;
    pool.mint_bump = mint_bump;
    msg!("brace pool init mint={}", pool.usd_mint);
    Ok(())
}
