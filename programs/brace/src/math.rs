//! Fixed-point math for ladder fitting and LTV limits.
//! Integer-only (no floats outside tests); every function is total and never panics.

extern crate alloc;
use alloc::vec::Vec;

pub const BPS: u64 = 10_000;
pub const E6: i64 = 1_000_000;
pub const YEAR_SECS: u64 = 31_536_000;

const E9: i128 = 1_000_000_000;
const LN_MAX_U_E9: i128 = 150_000_000;
const EXP_MAX_Y_E9: i64 = 500_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Quote { pub strike_e6: u64, pub bid_bps: u16, pub ask_bps: u16 }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fit { pub points: u8, pub k_ref_e6: u64, pub s_t_e6: u64, pub median_e6: u64 }

/// round(inverse normal CDF(m / 10000) * 1e6) for m = 50, 100, ..., 9950.
/// Generated with Python statistics.NormalDist().inv_cdf.
const PROBIT_TABLE_E6: [i64; 199] = [
    -2575829, -2326348, -2170090, -2053749, -1959964, -1880794, -1811911, -1750686,
    -1695398, -1644854, -1598193, -1554774, -1514102, -1475791, -1439531, -1405072,
    -1372204, -1340755, -1310579, -1281552, -1253565, -1226528, -1200359, -1174987,
    -1150349, -1126391, -1103063, -1080319, -1058122, -1036433, -1015222, -994458,
    -974114, -954165, -934589, -915365, -896473, -877896, -859617, -841621,
    -823894, -806421, -789192, -772193, -755415, -738847, -722479, -706303,
    -690309, -674490, -658838, -643345, -628006, -612813, -597760, -582842,
    -568051, -553385, -538836, -524401, -510073, -495850, -481727, -467699,
    -453762, -439913, -426148, -412463, -398855, -385320, -371856, -358459,
    -345126, -331853, -318639, -305481, -292375, -279319, -266311, -253347,
    -240426, -227545, -214702, -201893, -189118, -176374, -163658, -150969,
    -138304, -125661, -113039, -100434, -87845, -75270, -62707, -50154,
    -37608, -25069, -12533, 0, 12533, 25069, 37608, 50154,
    62707, 75270, 87845, 100434, 113039, 125661, 138304, 150969,
    163658, 176374, 189118, 201893, 214702, 227545, 240426, 253347,
    266311, 279319, 292375, 305481, 318639, 331853, 345126, 358459,
    371856, 385320, 398855, 412463, 426148, 439913, 453762, 467699,
    481727, 495850, 510073, 524401, 538836, 553385, 568051, 582842,
    597760, 612813, 628006, 643345, 658838, 674490, 690309, 706303,
    722479, 738847, 755415, 772193, 789192, 806421, 823894, 841621,
    859617, 877896, 896473, 915365, 934589, 954165, 974114, 994458,
    1015222, 1036433, 1058122, 1080319, 1103063, 1126391, 1150349, 1174987,
    1200359, 1226528, 1253565, 1281552, 1310579, 1340755, 1372204, 1405072,
    1439531, 1475791, 1514102, 1554774, 1598193, 1644854, 1695398, 1750686,
    1811911, 1880794, 1959964, 2053749, 2170090, 2326348, 2575829,
];

/// Probit of a midpoint in bps, scaled 1e6. Only multiples of 50 in 50..=9950.
pub fn probit_e6(mid_bps: u16) -> Option<i64> {
    if !(50..=9950).contains(&mid_bps) || mid_bps % 50 != 0 {
        return None;
    }
    PROBIT_TABLE_E6.get((mid_bps / 50) as usize - 1).copied()
}

/// ln(k / k_ref) scaled 1e9 via a 4-term series in u = (k - k_ref) / k_ref, |u| <= 0.15.
pub fn ln_ratio_e9(k_e6: u64, k_ref_e6: u64) -> Option<i64> {
    if k_ref_e6 == 0 {
        return None;
    }
    let kr = k_ref_e6 as i128;
    let u = (k_e6 as i128 - kr).checked_mul(E9)? / kr;
    if u.abs() > LN_MAX_U_E9 {
        return None;
    }
    let u2 = u * u / E9;
    let u3 = u2 * u / E9;
    let u4 = u3 * u / E9;
    i64::try_from(u - u2 / 2 + u3 / 3 - u4 / 4).ok()
}

/// e^y scaled 1e9 for |y| <= 0.5 (y scaled 1e9), Taylor series through y^6.
pub fn exp_small_e9(y_e9: i64) -> Option<u64> {
    if y_e9 < -EXP_MAX_Y_E9 || y_e9 > EXP_MAX_Y_E9 {
        return None;
    }
    let y = y_e9 as i128;
    let mut term = E9;
    let mut sum = E9;
    for i in 1..=6i128 {
        term = term * y / (E9 * i);
        sum += term;
    }
    u64::try_from(sum).ok()
}

/// Floor square root (digit-by-digit, no overflow).
pub fn isqrt_u128(n: u128) -> u128 {
    let mut rem = n;
    let mut res: u128 = 0;
    let mut bit: u128 = 1u128 << 126;
    while bit > rem {
        bit >>= 2;
    }
    while bit != 0 {
        if rem >= res + bit {
            rem -= res + bit;
            res = (res >> 1) + bit;
        } else {
            res >>= 1;
        }
        bit >>= 2;
    }
    res
}

/// Signed division rounded half away from zero. den must be non-zero.
fn div_round_i128(num: i128, den: i128) -> Option<i128> {
    if den == 0 {
        return None;
    }
    let (n, d) = if den < 0 { (num.checked_neg()?, den.checked_neg()?) } else { (num, den) };
    let half = d / 2;
    if n >= 0 {
        Some(n.checked_add(half)? / d)
    } else {
        Some(n.checked_sub(half)? / d)
    }
}

fn div_round_u128(num: u128, den: u128) -> Option<u128> {
    if den == 0 {
        return None;
    }
    Some(num.checked_add(den / 2)? / den)
}

/// Fit z = c + a*x (z = probit(mid), x = ln(K/k_ref)) by OLS and derive sT = -1/a
/// and the median F with ln(F/k_ref) = c*sT.
pub fn fit_ladder(quotes: &[Quote], max_spread_bps: u16, min_points: u8) -> Option<Fit> {
    let mut kept: Vec<(u64, u16)> = Vec::new();
    for q in quotes {
        if q.bid_bps == 0 || q.ask_bps == 0 || q.ask_bps < q.bid_bps {
            continue;
        }
        if q.ask_bps - q.bid_bps > max_spread_bps {
            continue;
        }
        // (bid + ask) is in half-bps: range-check the unsnapped midpoint (3%..97%),
        // then snap to the 50-bps grid (one step is 100 half-bps). Ties round up.
        let sum = q.bid_bps as u32 + q.ask_bps as u32;
        if !(600..=19_400).contains(&sum) {
            continue;
        }
        let mid = (sum + 50) / 100 * 50;
        kept.push((q.strike_e6, mid as u16));
    }
    if kept.is_empty() {
        return None;
    }
    let mut strikes: Vec<u64> = kept.iter().map(|&(k, _)| k).collect();
    strikes.sort_unstable();
    let k_ref = strikes[strikes.len() / 2];

    // Strikes beyond the ln-series range (more than 15% from k_ref) are skipped.
    let mut pts: Vec<(i128, i128, u64)> = Vec::with_capacity(kept.len());
    for &(k, mid) in &kept {
        if let Some(x) = ln_ratio_e9(k, k_ref) {
            pts.push((x as i128, probit_e6(mid)? as i128, k));
        }
    }
    let n = pts.len();
    if n < 2 || n < min_points as usize {
        return None;
    }
    let points = u8::try_from(n).ok()?;

    // Degenerate ladders: the kept strikes must span at least 0.5%.
    let min_k = pts.iter().map(|p| p.2).min()? as u128;
    let max_k = pts.iter().map(|p| p.2).max()? as u128;
    if max_k * 10_000 < min_k * 10_050 {
        return None;
    }

    let (mut sx, mut sz, mut sxx, mut sxz) = (0i128, 0i128, 0i128, 0i128);
    for &(x, z, _) in &pts {
        sx = sx.checked_add(x)?;
        sz = sz.checked_add(z)?;
        sxx = sxx.checked_add(x.checked_mul(x)?)?;
        sxz = sxz.checked_add(x.checked_mul(z)?)?;
    }
    let nn = n as i128;
    // n-scaled centered sums: Cxx = n*Sxx - Sx^2, Cxz = n*Sxz - Sx*Sz.
    let cxx = nn.checked_mul(sxx)?.checked_sub(sx.checked_mul(sx)?)?;
    let cxz = nn.checked_mul(sxz)?.checked_sub(sx.checked_mul(sz)?)?;
    if cxx <= 0 || cxz >= 0 {
        return None;
    }
    // a = Cxz/Cxx in (e6 / e9) units; natural sT = -1/a = -(Cxx/Cxz) * 1e-3; e6 => -Cxx*1e3/Cxz.
    let s_t = div_round_i128(cxx.checked_mul(1_000)?, cxz.checked_neg()?)?;
    let s_t_e6 = u64::try_from(s_t).ok()?;

    // ln(F/k_ref) = c*sT with c = mean_z - a*mean_x and a*sT = -1, so
    // y = mean_z*sT + mean_x. In e9: y = (Sx*Cxz - Sz*Cxx) / (n*Cxz).
    let num = sx.checked_mul(cxz)?.checked_sub(sz.checked_mul(cxx)?)?;
    let y_e9 = div_round_i128(num, nn.checked_mul(cxz)?)?;
    let exp = exp_small_e9(i64::try_from(y_e9).ok()?)?;
    let median = div_round_u128((k_ref as u128).checked_mul(exp as u128)?, E9 as u128)?;
    let median_e6 = u64::try_from(median).ok()?;

    Some(Fit { points, k_ref_e6: k_ref, s_t_e6, median_e6 })
}

/// Annualised sigma in bps: sT / sqrt(t / YEAR).
pub fn sigma_annual_bps(s_t_e6: u64, t_secs: u64) -> Option<u64> {
    if t_secs == 0 {
        return None;
    }
    // sqrt(YEAR / t) scaled 1e9.
    let r_e9 = isqrt_u128((YEAR_SECS as u128).checked_mul(1_000_000_000_000_000_000)? / t_secs as u128);
    // e6 * e9 -> bps (e4): divide by 1e11.
    let v = div_round_u128((s_t_e6 as u128).checked_mul(r_e9)?, 100_000_000_000)?;
    u64::try_from(v).ok()
}

/// Move over the horizon, e6: sT * sqrt(horizon / t).
pub fn horizon_move_e6(s_t_e6: u64, t_secs: u64, horizon_secs: u64) -> Option<u64> {
    if t_secs == 0 {
        return None;
    }
    let r_e9 = isqrt_u128((horizon_secs as u128).checked_mul(1_000_000_000_000_000_000)? / t_secs as u128);
    let v = div_round_u128((s_t_e6 as u128).checked_mul(r_e9)?, E9 as u128)?;
    u64::try_from(v).ok()
}

/// liq * (1 - (k_x100/100) * s_h), floored to bps, clamped to [floor, gov_max].
pub fn vol_limit_bps(liq_bps: u16, k_x100: u16, s_h_e6: u64, abs_floor_bps: u16, gov_max_bps: u16) -> u16 {
    if abs_floor_bps > gov_max_bps {
        return gov_max_bps;
    }
    const DEN: u128 = 100 * 1_000_000;
    let m = (k_x100 as u128).saturating_mul(s_h_e6 as u128);
    let raw: u128 = if m >= DEN { 0 } else { (liq_bps as u128) * (DEN - m) / DEN };
    let raw = u16::try_from(raw).unwrap_or(u16::MAX);
    raw.clamp(abs_floor_bps, gov_max_bps)
}

/// LTV in bps for the liquidation check, computed in one step from lamports and
/// spot and rounded DOWN (exact debt / (lamports * spot / 1e9), floored), so a
/// position at or below the threshold by true value never qualifies.
/// Zero debt is 0; debt against zero value is 10001.
pub fn liq_ltv_bps(debt: u64, lamports: u64, spot_e6: u64) -> Option<u64> {
    if debt == 0 {
        return Some(0);
    }
    let den = (lamports as u128).checked_mul(spot_e6 as u128)?;
    if den == 0 {
        return Some(10_001);
    }
    // debt * 1e4 (bps) * 1e9 (lamports per SOL) fits u128 for any u64 debt.
    let num = (debt as u128).checked_mul(10_000_000_000_000)?;
    u64::try_from(num / den).ok().or(Some(u64::MAX))
}

/// Max LTV with staleness decay: steps down by stale_step per stale period,
/// never below min(stale_floor, base), never above base = min(max_ltv, gov_max).
#[allow(clippy::too_many_arguments)]
pub fn effective_limit_bps(
    has_valid: bool,
    max_ltv_bps: u16,
    last_valid_at: i64,
    now: i64,
    stale_secs: u32,
    stale_step_bps: u16,
    stale_floor_bps: u16,
    gov_max_bps: u16,
) -> u16 {
    if !has_valid {
        return stale_floor_bps.min(gov_max_bps);
    }
    let base = max_ltv_bps.min(gov_max_bps);
    let age = (now as i128 - last_valid_at as i128).max(0) as u128;
    if age <= stale_secs as u128 {
        return base;
    }
    let steps: u128 = if stale_secs == 0 { u128::MAX } else { age / stale_secs as u128 };
    let drop = steps.saturating_mul(stale_step_bps as u128);
    let stepped = (base as u128).saturating_sub(drop) as u16;
    stepped.max(stale_floor_bps.min(base))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn q(k: u64, b: u16, a: u16) -> Quote {
        Quote { strike_e6: k, bid_bps: b, ask_bps: a }
    }

    fn rel_close(got: f64, want: f64, tol: f64) -> bool {
        ((got - want) / want).abs() <= tol
    }

    #[test]
    fn probit_values() {
        assert_eq!(probit_e6(5000), Some(0));
        let p = probit_e6(9750).unwrap();
        assert!((p - 1_959_964).abs() <= 2, "{p}");
        assert_eq!(probit_e6(250), probit_e6(9750).map(|v| -v));
        assert_eq!(probit_e6(49), None);
        assert_eq!(probit_e6(5025), None);
        assert_eq!(probit_e6(9951), None);
        for m in (50..=9950u16).step_by(50) {
            assert_eq!(probit_e6(m), probit_e6(10_000 - m).map(|v| -v));
        }
    }

    #[test]
    fn ln_ratio_values() {
        let a = ln_ratio_e9(1_050_000, 1_000_000).unwrap() as f64;
        assert!(rel_close(a, 48_790_164.0, 0.001), "{a}");
        let b = ln_ratio_e9(950_000, 1_000_000).unwrap() as f64;
        assert!(rel_close(b, -51_293_294.0, 0.001), "{b}");
        assert_eq!(ln_ratio_e9(1_000_000, 0), None);
        assert_eq!(ln_ratio_e9(1_300_000, 1_000_000), None);
        assert_eq!(ln_ratio_e9(700_000, 1_000_000), None);
    }

    #[test]
    fn exp_small_values() {
        assert_eq!(exp_small_e9(0), Some(1_000_000_000));
        let e = exp_small_e9(100_000_000).unwrap() as f64;
        assert!(rel_close(e, 1_105_170_918.0, 1e-6), "{e}");
        assert_eq!(exp_small_e9(500_000_001), None);
        assert_eq!(exp_small_e9(-500_000_001), None);
        assert_eq!(exp_small_e9(i64::MIN), None);
    }

    #[test]
    fn isqrt_values() {
        assert_eq!(isqrt_u128(0), 0);
        assert_eq!(isqrt_u128(1), 1);
        assert_eq!(isqrt_u128(15), 3);
        assert_eq!(isqrt_u128(16), 4);
        assert_eq!(isqrt_u128(u128::MAX), u64::MAX as u128);
    }

    struct Ref {
        t: u64,
        points: u8,
        s_t: f64,
        median: f64,
        sigma: f64,
        limit: u16,
    }

    fn check_fixture(name: &str, quotes: &[Quote], r: Ref) {
        let fit = fit_ladder(quotes, 1500, 3).unwrap_or_else(|| panic!("{name}: no fit"));
        assert_eq!(fit.points, r.points, "{name} points");
        let s_t = fit.s_t_e6 as f64 / 1e6;
        assert!(rel_close(s_t, r.s_t, 0.02), "{name} s_t {s_t}");
        let med = fit.median_e6 as f64 / 1e6;
        assert!(rel_close(med, r.median, 0.001), "{name} median {med}");
        let sig = sigma_annual_bps(fit.s_t_e6, r.t).unwrap() as f64;
        assert!((sig - r.sigma * 10_000.0).abs() <= 50.0, "{name} sigma {sig}");
        let s_h = horizon_move_e6(fit.s_t_e6, r.t, 86_400).unwrap();
        let lim = vol_limit_bps(8000, 300, s_h, 3000, 7500);
        assert!((lim as i32 - r.limit as i32).abs() <= 15, "{name} limit {lim}");
    }

    #[test]
    fn gemini_sol() {
        check_fixture(
            "SOL",
            &[q(67000000, 9100, 9600), q(68000000, 8800, 9100), q(69000000, 8200, 8500), q(70000000, 7200, 7600), q(71000000, 5900, 6400), q(72000000, 4400, 5000), q(73000000, 3100, 3700), q(74000000, 2000, 2600)],
            Ref { t: 86134, points: 8, s_t: 0.043230, median: 71.7891, sigma: 0.8272, limit: 6960 },
        );
    }

    #[test]
    fn gemini_btc() {
        check_fixture(
            "BTC",
            &[q(64900000000, 9300, 9900), q(65000000000, 9000, 9700), q(65100000000, 8500, 9200), q(65200000000, 7600, 8300), q(65300000000, 6200, 7200), q(65400000000, 4800, 5400), q(65500000000, 3300, 3900), q(65600000000, 2000, 3000), q(64500000000, 9500, 0), q(64600000000, 9500, 0), q(64700000000, 9500, 0), q(64800000000, 9500, 0)],
            Ref { t: 3334, points: 8, s_t: 0.004256, median: 65413.6932, sigma: 0.4139, limit: 7479 },
        );
    }

    #[test]
    fn gemini_zec() {
        check_fixture(
            "ZEC",
            &[q(900000000, 7400, 8700), q(910000000, 4700, 6000), q(920000000, 1900, 3200), q(930000000, 200, 1400), q(870000000, 9300, 0), q(880000000, 9300, 0), q(890000000, 8800, 0)],
            Ref { t: 3334, points: 4, s_t: 0.014494, median: 911.2378, sigma: 1.4097, limit: 6229 },
        );
    }

    #[test]
    fn negative_fits() {
        // only 2 usable quotes
        let two = [q(70_000_000, 7000, 7400), q(71_000_000, 5000, 5400), q(72_000_000, 3000, 0)];
        assert_eq!(fit_ladder(&two, 1500, 3), None);
        // probabilities increasing with strike: wrong slope sign
        let wrong = [q(70_000_000, 3000, 3400), q(71_000_000, 5000, 5400), q(72_000_000, 7000, 7400)];
        assert_eq!(fit_ladder(&wrong, 1500, 3), None);
        // all spreads wider than max
        let wide = [q(70_000_000, 6000, 9000), q(71_000_000, 4000, 7000), q(72_000_000, 1000, 4000)];
        assert_eq!(fit_ladder(&wide, 1500, 3), None);
        assert_eq!(fit_ladder(&[], 1500, 0), None);
    }

    #[test]
    fn far_strike_is_skipped_not_fatal() {
        // ZEC ladder plus a valid quote >15% from k_ref: the far strike is dropped.
        let quotes = [
            q(900000000, 7400, 8700),
            q(910000000, 4700, 6000),
            q(920000000, 1900, 3200),
            q(930000000, 200, 1400),
            q(750000000, 9500, 9700),
            q(870000000, 9300, 0),
        ];
        let fit = fit_ladder(&quotes, 1500, 3).expect("far strike must not kill the fit");
        assert_eq!(fit.points, 4);
        let base = fit_ladder(&quotes[..4], 1500, 3).unwrap();
        assert_eq!(fit.s_t_e6, base.s_t_e6);
        // k_ref is picked before the far strike is dropped, so allow rounding noise.
        assert!(fit.median_e6.abs_diff(base.median_e6) <= 10, "{} vs {}", fit.median_e6, base.median_e6);
        // Count after the filter: 2 near + 1 far is below min_points 3.
        let few = [q(910000000, 4700, 6000), q(920000000, 1900, 3200), q(1_300_000_000, 9500, 9700)];
        assert_eq!(fit_ladder(&few, 1500, 3), None);
    }

    #[test]
    fn mid_range_checked_before_snapping() {
        // bid+ask = 590 half-bps (mid 2.95%) snaps to 300 but is outside 300..=9700.
        let low = [q(70_000_000, 7000, 7400), q(71_000_000, 5000, 5400), q(72_000_000, 250, 340)];
        assert_eq!(fit_ladder(&low, 1500, 3), None);
        // bid+ask = 19410 (mid 97.05%) snaps to 9700 but is outside the range.
        let high = [q(70_000_000, 9700, 9710), q(71_000_000, 5000, 5400), q(72_000_000, 3000, 3400)];
        assert_eq!(fit_ladder(&high, 1500, 3), None);
        // Exactly at the edges (600 and 19400 half-bps) is kept.
        let edge = [q(70_000_000, 9650, 9750), q(71_000_000, 5000, 5400), q(72_000_000, 250, 350)];
        assert_eq!(fit_ladder(&edge, 1500, 3).map(|f| f.points), Some(3));
    }

    #[test]
    fn degenerate_strike_span_rejected() {
        let tight = [q(100_000_000, 9650, 9750), q(100_000_001, 4950, 5050), q(100_000_002, 250, 350)];
        assert_eq!(fit_ladder(&tight, 1500, 3), None);
        // Span exactly 0.5% is accepted; just under is rejected.
        let ok = [q(100_000_000, 9650, 9750), q(100_250_000, 4950, 5050), q(100_500_000, 250, 350)];
        assert!(fit_ladder(&ok, 1500, 3).is_some());
        let under = [q(100_000_000, 9650, 9750), q(100_250_000, 4950, 5050), q(100_499_999, 250, 350)];
        assert_eq!(fit_ladder(&under, 1500, 3), None);
    }

    #[test]
    fn liquidation_ltv_rounds_in_borrowers_favour() {
        // True LTV 801 / 1001.9 = 79.95%: floors to 7994.
        assert_eq!(liq_ltv_bps(801, 1_001_900, 1_000_000), Some(7994));
        assert_eq!(liq_ltv_bps(0, 0, 0), Some(0));
        assert_eq!(liq_ltv_bps(1, 0, 1_000_000), Some(10_001));
        assert_eq!(liq_ltv_bps(1, 1_000, 0), Some(10_001));
        // Exactly 80%: 800 / 1000.
        assert_eq!(liq_ltv_bps(800, 1_000_000_000, 1_000), Some(8000));
        assert!(liq_ltv_bps(u64::MAX, 1, 1).is_some());
        let mut r = Rng(42);
        for _ in 0..5_000 {
            let (d, l, s) = (r.next() % 1_000_000_000_000, r.next() % 1_000_000_000_000_000, r.next() % 1_000_000_000_000);
            let got = liq_ltv_bps(d, l, s).unwrap() as u128;
            // got <= true LTV < got + 1
            let den = l as u128 * s as u128;
            if d == 0 || den == 0 {
                continue;
            }
            let num = d as u128 * 10_000_000_000_000;
            assert!(got * den <= num && num < (got + 1) * den);
        }
    }

    #[test]
    fn vol_limit_cases() {
        assert_eq!(vol_limit_bps(8000, 300, 0, 3000, 7500), 7500);
        assert_eq!(vol_limit_bps(8000, 300, 10_000_000, 3000, 7500), 3000);
        assert_eq!(vol_limit_bps(8000, 300, u64::MAX, 3000, 7500), 3000);
        assert_eq!(vol_limit_bps(8000, 300, 0, 8000, 7500), 7500);
        assert_eq!(vol_limit_bps(8000, 300, u64::MAX, 8000, 7500), 7500);
    }

    #[test]
    fn effective_limit_cases() {
        // !has_valid
        assert_eq!(effective_limit_bps(false, 7000, 0, 1000, 300, 250, 5000, 7500), 5000);
        // fresh
        assert_eq!(effective_limit_bps(true, 7000, 1000, 1100, 300, 250, 5000, 7500), 7000);
        // age 650, step 250 -> 2 steps
        assert_eq!(effective_limit_bps(true, 7000, 1000, 1650, 300, 250, 5000, 7500), 6500);
        // very old
        assert_eq!(effective_limit_bps(true, 7000, 0, 1_000_000_000, 300, 250, 5000, 7500), 5000);
        // max_ltv below stale floor, stale -> never raised
        assert_eq!(effective_limit_bps(true, 4000, 0, 1_000_000, 300, 250, 5000, 7500), 4000);
        // max_ltv above gov max -> capped
        assert_eq!(effective_limit_bps(true, 9000, 1000, 1100, 300, 250, 5000, 7500), 7500);
        // stale_secs 0
        assert_eq!(effective_limit_bps(true, 7000, 1000, 1001, 0, 250, 5000, 7500), 5000);
        // extreme times do not panic
        assert_eq!(effective_limit_bps(true, 7000, i64::MIN, i64::MAX, 1, u16::MAX, 5000, 7500), 5000);
        assert_eq!(effective_limit_bps(true, 7000, i64::MAX, i64::MIN, 1, 250, 5000, 7500), 7000);
    }

    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u64 {
            let mut x = self.0;
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            self.0 = x;
            x
        }
        fn u16(&mut self) -> u16 {
            self.next() as u16
        }
    }

    #[test]
    fn properties() {
        let mut r = Rng(0x9E37_79B9_7F4A_7C15);
        for _ in 0..5_000 {
            let has_valid = r.next() & 1 == 1;
            let max_ltv = r.u16() % 12_000;
            let gov = r.u16() % 12_000;
            let floor = r.u16() % 12_000;
            let step = r.u16() % 2_000;
            let stale = (r.next() % 2_000) as u32;
            let last = (r.next() % 1_000_000) as i64 - 500_000;
            let now = (r.next() % 2_000_000) as i64 - 1_000_000;

            let e = effective_limit_bps(has_valid, max_ltv, last, now, stale, step, floor, gov);
            // (a)
            assert!(e <= gov);
            // (b)
            if has_valid {
                assert!(e <= max_ltv.min(gov));
            }
            // (c) non-increasing in now
            let mut prev = effective_limit_bps(has_valid, max_ltv, last, now, stale, step, floor, gov);
            let mut n2 = now;
            for _ in 0..20 {
                n2 += (r.next() % 500) as i64;
                let cur = effective_limit_bps(has_valid, max_ltv, last, n2, stale, step, floor, gov);
                assert!(cur <= prev, "now not monotone");
                prev = cur;
            }

            // (d) vol_limit bounds and monotone in s_h
            let liq = r.u16();
            let k = r.u16() % 1_000;
            let s1 = r.next() % 2_000_000;
            let s2 = s1 + r.next() % 2_000_000;
            let v1 = vol_limit_bps(liq, k, s1, floor, gov);
            let v2 = vol_limit_bps(liq, k, s2, floor, gov);
            assert!(v1 >= floor.min(gov) && v1 <= gov);
            assert!(v2 >= floor.min(gov) && v2 <= gov);
            assert!(v2 <= v1);
            let _ = vol_limit_bps(r.u16(), r.u16(), r.next(), r.u16(), r.u16());

            // (e) no panics on random inputs
            let len = (r.next() % 17) as usize;
            let mut qs = [Quote { strike_e6: 0, bid_bps: 0, ask_bps: 0 }; 16];
            let base = r.next() % 200_000_000_000;
            for slot in qs.iter_mut().take(len) {
                let strike = if r.next() & 3 == 0 { r.next() } else { base + r.next() % (base / 10 + 1) };
                *slot = Quote { strike_e6: strike, bid_bps: r.u16() % 11_000, ask_bps: r.u16() % 11_000 };
            }
            let _ = fit_ladder(&qs[..len], r.u16(), (r.next() % 8) as u8);
            let _ = probit_e6(r.u16());
            let _ = ln_ratio_e9(r.next(), r.next());
            let _ = exp_small_e9(r.next() as i64);
            let _ = isqrt_u128(((r.next() as u128) << 64) | r.next() as u128);
            let _ = sigma_annual_bps(r.next(), r.next());
            let _ = sigma_annual_bps(r.next() % 1_000_000, r.next() % 100_000);
            let _ = horizon_move_e6(r.next(), r.next(), r.next());
            let _ = horizon_move_e6(r.next() % 1_000_000, r.next() % 100_000, r.next() % 100_000);
            let _ = effective_limit_bps(has_valid, r.u16(), r.next() as i64, r.next() as i64, r.next() as u32, r.u16(), r.u16(), r.u16());
        }
    }
}

