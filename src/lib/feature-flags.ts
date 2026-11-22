export const CENTRE_MARKET_ENABLED = false;

/**
 * #794 AC-400-3: the public `/impact` page is built but HELD. It must stay off
 * production until the first NGO partner is confirmed, so Explore keeps
 * pointing at `/guide#impact`. Flipping this is the only change needed to
 * release it; the route 404s while it is false, exactly as matchmax.hk/impact
 * does today.
 */
export const IMPACT_PAGE_LIVE = false;
