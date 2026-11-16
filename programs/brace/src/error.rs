use anchor_lang::prelude::*;

#[error_code]
pub enum BraceError {
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Params are out of bounds")]
    InvalidParams,
    #[msg("Too many quotes (max 16)")]
    TooManyQuotes,
    #[msg("Symbol must be uppercase ASCII letters/digits followed by zero padding")]
    InvalidSymbol,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Action would exceed the current risk limit")]
    RiskTightened,
    #[msg("Position is not liquidatable")]
    NotLiquidatable,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Invalid amount")]
    InvalidAmount,
}
