use anchor_lang::prelude::*;

use crate::state::Params;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const FEED_SEED: &[u8] = b"feed";

pub const MAX_QUOTES: usize = 16;

pub const DEFAULT_PARAMS: Params = Params {
    gov_max_ltv_bps: 7500,
    liq_threshold_bps: 8000,
    horizon_secs: 86_400,
    k_x100: 300,
    abs_floor_ltv_bps: 3000,
    stale_secs: 300,
    stale_step_bps: 250,
    stale_floor_ltv_bps: 5000,
    max_spread_bps: 1500,
    min_points: 3,
    min_expiry_secs: 900,
    max_expiry_secs: 259_200,
    max_spot_gap_bps: 300,
};

#[constant]
pub const POOL_SEED: &[u8] = b"pool";

#[constant]
pub const USD_MINT_SEED: &[u8] = b"usd_mint";

#[constant]
pub const POSITION_SEED: &[u8] = b"position";

/// Symbol of the feed that prices pool collateral.
pub const SOL_SYMBOL: [u8; 8] = *b"SOL\0\0\0\0\0";

pub const USD_DECIMALS: u8 = 6;
pub const LAMPORTS_PER_SOL: u128 = 1_000_000_000;
/// Liquidator receives debt value + 5%.
pub const LIQ_BONUS_BPS: u128 = 10_500;
