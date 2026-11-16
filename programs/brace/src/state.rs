use anchor_lang::prelude::*;

use crate::math;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq, Debug)]
pub struct Params {
    pub gov_max_ltv_bps: u16,
    pub liq_threshold_bps: u16,
    pub horizon_secs: u32,
    pub k_x100: u16,
    pub abs_floor_ltv_bps: u16,
    pub stale_secs: u32,
    pub stale_step_bps: u16,
    pub stale_floor_ltv_bps: u16,
    pub max_spread_bps: u16,
    pub min_points: u8,
    pub min_expiry_secs: u32,
    pub max_expiry_secs: u32,
    pub max_spot_gap_bps: u16,
}

impl Params {
    pub fn is_valid(&self) -> bool {
        let p = self;
        0 < p.abs_floor_ltv_bps
            && p.abs_floor_ltv_bps <= p.stale_floor_ltv_bps
            && p.stale_floor_ltv_bps <= p.gov_max_ltv_bps
            && p.gov_max_ltv_bps < p.liq_threshold_bps
            && p.liq_threshold_bps <= 9500
            && (60..=604_800).contains(&p.horizon_secs)
            && (100..=1000).contains(&p.k_x100)
            && (60..=3600).contains(&p.stale_secs)
            && p.stale_step_bps <= 2000
            && (100..=5000).contains(&p.max_spread_bps)
            && (3..=16).contains(&p.min_points)
            && 60 <= p.min_expiry_secs
            && p.min_expiry_secs < p.max_expiry_secs
            && p.max_expiry_secs <= 604_800
            && (10..=2000).contains(&p.max_spot_gap_bps)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub relayer: Pubkey,
    pub params: Params,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Feed {
    pub symbol: [u8; 8],
    pub spot_e6: u64,
    pub median_e6: u64,
    pub sigma_bps: u64,
    pub horizon_move_e6: u64,
    pub points: u8,
    pub expiry_ts: i64,
    pub ticker: [u8; 32],
    pub confident: bool,
    pub max_ltv_bps: u16,
    pub has_valid: bool,
    pub last_valid_at: i64,
    pub posted_at: i64,
    pub bump: u8,
}

impl Feed {
    pub fn effective_ltv_bps(&self, p: &Params, now: i64) -> u16 {
        math::effective_limit_bps(
            self.has_valid,
            self.max_ltv_bps,
            self.last_valid_at,
            now,
            p.stale_secs,
            p.stale_step_bps,
            p.stale_floor_ltv_bps,
            p.gov_max_ltv_bps,
        )
    }
}

#[event]
pub struct QuotesPosted {
    pub symbol: [u8; 8],
    pub confident: bool,
    pub sigma_bps: u64,
    pub max_ltv_bps: u16,
    pub effective_ltv_bps: u16,
    pub spot_e6: u64,
    pub median_e6: u64,
    pub points: u8,
    pub expiry_ts: i64,
    pub ticker: [u8; 32],
    pub posted_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub usd_mint: Pubkey,
    pub total_debt: u64,
    pub total_collateral: u64,
    pub bump: u8,
    pub mint_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub collateral_lamports: u64,
    pub debt: u64,
    pub bump: u8,
}

/// Collateral value in test USD base units: lamports * spot_e6 / 1e9.
pub fn collateral_value_e6(lamports: u64, spot_e6: u64) -> Result<u64> {
    let v = (lamports as u128)
        .checked_mul(spot_e6 as u128)
        .ok_or(crate::error::BraceError::MathOverflow)?
        / crate::constants::LAMPORTS_PER_SOL;
    u64::try_from(v).map_err(|_| crate::error::BraceError::MathOverflow.into())
}

/// LTV in bps, rounded up. Zero debt is 0; debt against zero value is 10001.
pub fn ltv_bps(debt: u64, value: u64) -> Result<u64> {
    if debt == 0 {
        return Ok(0);
    }
    if value == 0 {
        return Ok(10_001);
    }
    let n = (debt as u128).checked_mul(10_000).ok_or(crate::error::BraceError::MathOverflow)?;
    u64::try_from(n.div_ceil(value as u128)).map_err(|_| crate::error::BraceError::MathOverflow.into())
}

#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub lamports: u64,
}

#[event]
pub struct Borrowed {
    pub owner: Pubkey,
    pub amount: u64,
    pub ltv_bps: u64,
    pub limit_bps: u16,
}

#[event]
pub struct Repaid {
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Withdrawn {
    pub owner: Pubkey,
    pub lamports: u64,
}

#[event]
pub struct Liquidated {
    pub owner: Pubkey,
    pub liquidator: Pubkey,
    pub debt: u64,
    pub seized: u64,
}
