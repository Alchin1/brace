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
