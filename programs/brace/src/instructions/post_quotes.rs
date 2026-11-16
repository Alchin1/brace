use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{constants::*, error::BraceError, math, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct QuoteArg {
    pub strike_e6: u64,
    pub bid_bps: u16,
    pub ask_bps: u16,
}

#[derive(Accounts)]
#[instruction(symbol: [u8; 8])]
pub struct PostQuotes<'info> {
    #[account(mut)]
    pub relayer: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.relayer == relayer.key() @ BraceError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    /// CHECK: Feed PDA, created on first post (init-if-needed done by hand) and
    /// verified by seeds; owner and discriminator are checked in the handler.
    #[account(mut, seeds = [FEED_SEED, symbol.as_ref()], bump)]
    pub feed: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn valid_symbol(symbol: &[u8; 8]) -> bool {
    let len = symbol.iter().position(|&b| b == 0).unwrap_or(8);
    len > 0
        && symbol[..len].iter().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
        && symbol[len..].iter().all(|&b| b == 0)
}

fn create_feed_account(ctx: &Context<PostQuotes>, symbol: &[u8; 8], bump: u8) -> Result<()> {
    let feed = ctx.accounts.feed.to_account_info();
    let payer = ctx.accounts.relayer.to_account_info();
    let space = 8 + Feed::INIT_SPACE;
    let rent = Rent::get()?.minimum_balance(space);
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[FEED_SEED, symbol.as_ref(), &bump_seed];
    let signer: &[&[&[u8]]] = &[seeds];
    let sys = ctx.accounts.system_program.key();

    if feed.lamports() == 0 {
        system_program::create_account(
            CpiContext::new_with_signer(
                sys,
                system_program::CreateAccount { from: payer, to: feed },
                signer,
            ),
            rent,
            space as u64,
            ctx.program_id,
        )?;
    } else {
        let top_up = rent.saturating_sub(feed.lamports());
        if top_up > 0 {
            system_program::transfer(
                CpiContext::new(sys, system_program::Transfer { from: payer, to: feed.clone() }),
                top_up,
            )?;
        }
        system_program::allocate(
            CpiContext::new_with_signer(
                sys,
                system_program::Allocate { account_to_allocate: feed.clone() },
                signer,
            ),
            space as u64,
        )?;
        system_program::assign(
            CpiContext::new_with_signer(
                sys,
                system_program::Assign { account_to_assign: feed },
                signer,
            ),
            ctx.program_id,
        )?;
    }
    Ok(())
}

pub fn handle_post_quotes(
    ctx: Context<PostQuotes>,
    symbol: [u8; 8],
    expiry_ts: i64,
    ticker: [u8; 32],
    spot_e6: u64,
    quotes: Vec<QuoteArg>,
) -> Result<()> {
    require!(quotes.len() <= MAX_QUOTES, BraceError::TooManyQuotes);
    require!(valid_symbol(&symbol), BraceError::InvalidSymbol);
    require!(spot_e6 > 0, BraceError::InvalidAmount);

    let now = Clock::get()?.unix_timestamp;
    let p = ctx.accounts.config.params;
    let bump = ctx.bumps.feed;

    // init_if_needed
    let feed_info = ctx.accounts.feed.to_account_info();
    let mut feed: Feed = if *feed_info.owner == system_program::ID {
        create_feed_account(&ctx, &symbol, bump)?;
        Feed {
            symbol,
            spot_e6: 0,
            median_e6: 0,
            sigma_bps: 0,
            horizon_move_e6: 0,
            points: 0,
            expiry_ts: 0,
            ticker: [0; 32],
            confident: false,
            max_ltv_bps: 0,
            has_valid: false,
            last_valid_at: 0,
            posted_at: 0,
            bump,
        }
    } else {
        require_keys_eq!(*feed_info.owner, crate::ID, ErrorCode::AccountOwnedByWrongProgram);
        let data = feed_info.try_borrow_data()?;
        Feed::try_deserialize(&mut &data[..])?
    };

    feed.symbol = symbol;
    feed.expiry_ts = expiry_ts;
    feed.ticker = ticker;
    feed.posted_at = now;
    feed.bump = bump;

    let converted: Vec<math::Quote> = quotes
        .iter()
        .map(|q| math::Quote { strike_e6: q.strike_e6, bid_bps: q.bid_bps, ask_bps: q.ask_bps })
        .collect();

    let t = expiry_ts.saturating_sub(now);
    let t_ok = t >= p.min_expiry_secs as i64 && t <= p.max_expiry_secs as i64;
    let fit = math::fit_ladder(&converted, p.max_spread_bps, p.min_points);

    let mut result: Option<(u64, u64, u16)> = None; // (sigma, s_h, limit)
    if let (true, Some(f)) = (t_ok, fit) {
        let gap_ok = f.median_e6 > 0 && {
            let diff = (spot_e6 as u128).abs_diff(f.median_e6 as u128);
            diff * 10_000 / f.median_e6 as u128 <= p.max_spot_gap_bps as u128
        };
        if gap_ok {
            let t_u = t as u64;
            if let (Some(sigma), Some(s_h)) = (
                math::sigma_annual_bps(f.s_t_e6, t_u),
                math::horizon_move_e6(f.s_t_e6, t_u, p.horizon_secs as u64),
            ) {
                if sigma < MIN_SIGMA_BPS {
                    msg!("brace sigma_bps={} below floor {}", sigma, MIN_SIGMA_BPS);
                } else {
                    let limit = math::vol_limit_bps(
                        p.liq_threshold_bps,
                        p.k_x100,
                        s_h,
                        p.abs_floor_ltv_bps,
                        p.gov_max_ltv_bps,
                    );
                    result = Some((sigma, s_h, limit));
                }
            }
        }
    }

    match (result, fit) {
        (Some((sigma, s_h, limit)), Some(f)) => {
            // Spot only moves together with a confident fit it was checked against.
            feed.spot_e6 = spot_e6;
            feed.points = f.points;
            feed.median_e6 = f.median_e6;
            feed.sigma_bps = sigma;
            feed.horizon_move_e6 = s_h;
            feed.max_ltv_bps = limit;
            feed.has_valid = true;
            feed.last_valid_at = now;
            feed.confident = true;
        }
        _ => {
            feed.confident = false;
            feed.points = fit.map(|f| f.points).unwrap_or(0);
        }
    }

    let effective = feed.effective_ltv_bps(&p, now);
    {
        let mut data = feed_info.try_borrow_mut_data()?;
        feed.try_serialize(&mut &mut data[..])?;
    }

    emit!(QuotesPosted {
        symbol,
        confident: feed.confident,
        sigma_bps: feed.sigma_bps,
        max_ltv_bps: feed.max_ltv_bps,
        effective_ltv_bps: effective,
        spot_e6: feed.spot_e6,
        median_e6: feed.median_e6,
        points: feed.points,
        expiry_ts,
        ticker,
        posted_at: now,
    });
    let len = symbol.iter().position(|&b| b == 0).unwrap_or(8);
    msg!(
        "brace {} conf={} sigma_bps={} max_ltv={}",
        core::str::from_utf8(&symbol[..len]).unwrap_or("?"),
        feed.confident as u8,
        feed.sigma_bps,
        feed.max_ltv_bps
    );
    Ok(())
}
