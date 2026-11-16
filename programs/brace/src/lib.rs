pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3jpdhdCwBQW8fVTJpVSveZhDPmpb7u3AdUDd12Sg8fcU");

#[program]
pub mod brace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: Params, relayer: Pubkey) -> Result<()> {
        crate::instructions::initialize::handle_initialize(ctx, params, relayer)
    }

    pub fn set_params(ctx: Context<AdminConfig>, params: Params) -> Result<()> {
        crate::instructions::set_params::handle_set_params(ctx, params)
    }

    pub fn set_relayer(ctx: Context<AdminConfig>, relayer: Pubkey) -> Result<()> {
        crate::instructions::set_params::handle_set_relayer(ctx, relayer)
    }

    pub fn post_quotes(
        ctx: Context<PostQuotes>,
        symbol: [u8; 8],
        expiry_ts: i64,
        ticker: [u8; 32],
        spot_e6: u64,
        quotes: Vec<QuoteArg>,
    ) -> Result<()> {
        crate::instructions::post_quotes::handle_post_quotes(ctx, symbol, expiry_ts, ticker, spot_e6, quotes)
    }
}
