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
    /// (system create_account signed by the PDA, or top-up + allocate + assign
    /// if it was pre-funded, then InitializeMint2).
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
    let mint = ctx.accounts.usd_mint.to_account_info();
    let payer = ctx.accounts.admin.to_account_info();
    let sys = ctx.accounts.system_program.key();
    if mint.lamports() == 0 {
        system_program::create_account(
            CpiContext::new_with_signer(sys, system_program::CreateAccount { from: payer, to: mint }, signer),
            rent,
            space as u64,
            &spl_token::ID,
        )?;
    } else {
        // Someone pre-funded the PDA: create_account would fail, so top up,
        // allocate and assign (PDA-signed) instead.
        let top_up = rent.saturating_sub(mint.lamports());
        if top_up > 0 {
            system_program::transfer(
                CpiContext::new(sys, system_program::Transfer { from: payer, to: mint.clone() }),
                top_up,
            )?;
        }
        system_program::allocate(
            CpiContext::new_with_signer(
                sys,
                system_program::Allocate { account_to_allocate: mint.clone() },
                signer,
            ),
            space as u64,
        )?;
        system_program::assign(
            CpiContext::new_with_signer(sys, system_program::Assign { account_to_assign: mint }, signer),
            &spl_token::ID,
        )?;
    }
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
