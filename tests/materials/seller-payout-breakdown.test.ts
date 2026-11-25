import { describe, expect, it } from "vitest";

import {
  EST_GATEWAY_FIXED_HKD,
  EST_GATEWAY_RATE,
  NOTES_OPTION_A_LIVE,
  PLATFORM_FEE_RATE,
  sellerBreakdownHkd,
  SHOW_EARNINGS_BREAKDOWN,
} from "../../src/features/materials/marketplace-policy";

const cents = (value: number) => Math.round(value * 100) / 100;

describe("#784 seller payout breakdown", () => {
  it("is display-only, so checkout stays gated on the launch switch", () => {
    expect(SHOW_EARNINGS_BREAKDOWN).toBe(true);
    expect(NOTES_OPTION_A_LIVE).toBe(false);
  });

  it("nets gross - 2% - gateway fee at HK$100", () => {
    const b = sellerBreakdownHkd(100);
    expect(b).toEqual({
      isFree: false,
      showFeeLines: true,
      grossHkd: 100,
      platformFeeHkd: 2,
      estimatedGatewayFeeHkd: 5.75,
      netHkd: 92.25,
    });
    expect(b.netHkd).toBe(cents(b.grossHkd - b.platformFeeHkd - b.estimatedGatewayFeeHkd));
  });

  it("nets gross - 2% - gateway fee at HK$199", () => {
    // 199 * 0.034 + 2.35 = 9.116 -> 9.12; 199 - 3.98 - 9.12 = 185.90.
    const b = sellerBreakdownHkd(199);
    expect(b.platformFeeHkd).toBe(3.98);
    expect(b.estimatedGatewayFeeHkd).toBe(9.12);
    expect(b.netHkd).toBe(185.9);
    expect(b.netHkd).toBe(cents(b.grossHkd - b.platformFeeHkd - b.estimatedGatewayFeeHkd));
  });

  it("keeps net === gross - 2% - fee across the paid price range", () => {
    for (const gross of [20, 50, 88, 350, 1_288, 5_000]) {
      const b = sellerBreakdownHkd(gross);
      expect(b.isFree).toBe(false);
      expect(b.showFeeLines).toBe(true);
      expect(b.grossHkd).toBe(gross);
      expect(b.platformFeeHkd).toBe(cents(gross * PLATFORM_FEE_RATE));
      expect(b.estimatedGatewayFeeHkd).toBe(
        cents(gross * EST_GATEWAY_RATE + EST_GATEWAY_FIXED_HKD),
      );
      expect(b.netHkd).toBe(cents(gross - b.platformFeeHkd - b.estimatedGatewayFeeHkd));
    }
  });

  it("HK$0 hides the fee lines: free publishing asks for no payout details", () => {
    const free = {
      isFree: true,
      showFeeLines: false,
      grossHkd: 0,
      platformFeeHkd: 0,
      estimatedGatewayFeeHkd: 0,
      netHkd: 0,
    };
    expect(sellerBreakdownHkd(0)).toEqual(free);
    expect(sellerBreakdownHkd(Number.NaN)).toEqual(free);
    expect(sellerBreakdownHkd(-50)).toEqual(free);
  });

  it("accepts a tier rate for the paid rows without breaking the net identity", () => {
    const b = sellerBreakdownHkd(100, 0.08);
    expect(b.platformFeeHkd).toBe(8);
    expect(b.netHkd).toBe(86.25);
    expect(b.netHkd).toBe(cents(b.grossHkd - b.platformFeeHkd - b.estimatedGatewayFeeHkd));
  });
});
