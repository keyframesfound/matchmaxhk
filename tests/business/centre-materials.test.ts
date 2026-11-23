import { describe, expect, it } from "vitest";

import {
  centreMaterialCards,
  isListableCentreMaterial,
  toCentreMaterialCard,
  type CentreMaterialRow,
} from "../../src/features/business/centre-materials";

const row = (over: Partial<CentreMaterialRow> = {}): CentreMaterialRow => ({
  id: "mat-1",
  slug: "ib-physics-past-papers",
  title: "IB Physics Past Papers",
  price_hkd: 480,
  material_type: "past_papers",
  subject_tag: "Physics",
  curriculum_tag: "IB",
  status: "published",
  listing_kind: "digital_file",
  organization_id: "org-1",
  sold_count: 12,
  view_count: 300,
  ...over,
});

describe("#815 §2.4 centre materials listability", () => {
  it("lists only a published digital file attributed to an organisation", () => {
    expect(isListableCentreMaterial(row())).toBe(true);
  });

  it("rejects unpublished, non-file and unattributed rows", () => {
    expect(isListableCentreMaterial(row({ status: "draft" }))).toBe(false);
    expect(isListableCentreMaterial(row({ status: "pending_review" }))).toBe(false);
    expect(isListableCentreMaterial(row({ listing_kind: "group_class" }))).toBe(false);
    expect(isListableCentreMaterial(row({ organization_id: null }))).toBe(false);
  });

  it("drops the rejected rows from the card list and keeps the rest in place", () => {
    const cards = centreMaterialCards([
      row({ id: "draft", status: "draft" }),
      row({ id: "pending", status: "pending_review" }),
      row({ id: "class", listing_kind: "group_class" }),
      row({ id: "unattributed", organization_id: null }),
      row({ id: "live" }),
    ]);

    expect(cards.map((c) => c.id)).toEqual(["live"]);
  });
});

describe("#815 §2.4 centre material slug fallback", () => {
  it("falls back to the id when the slug is null or blank", () => {
    expect(toCentreMaterialCard(row({ id: "mat-7", slug: null })).slug).toBe("mat-7");
    expect(toCentreMaterialCard(row({ id: "mat-7", slug: "" })).slug).toBe("mat-7");
    expect(toCentreMaterialCard(row({ id: "mat-7", slug: "   " })).slug).toBe("mat-7");
  });

  it("keeps a real slug, trimmed", () => {
    expect(toCentreMaterialCard(row({ slug: "ib-physics" })).slug).toBe("ib-physics");
    expect(toCentreMaterialCard(row({ slug: "  ib-physics  " })).slug).toBe("ib-physics");
  });
});

describe("#815 §2.4 centre material price coercion", () => {
  it("coerces a numeric string to a number", () => {
    expect(toCentreMaterialCard(row({ price_hkd: "480" })).priceHkd).toBe(480);
    expect(toCentreMaterialCard(row({ price_hkd: 480 })).priceHkd).toBe(480);
  });

  it("floors negative, NaN and missing prices at zero", () => {
    expect(toCentreMaterialCard(row({ price_hkd: -10 })).priceHkd).toBe(0);
    expect(toCentreMaterialCard(row({ price_hkd: "-1" })).priceHkd).toBe(0);
    expect(toCentreMaterialCard(row({ price_hkd: Number.NaN })).priceHkd).toBe(0);
    expect(toCentreMaterialCard(row({ price_hkd: "not a price" })).priceHkd).toBe(0);
    expect(toCentreMaterialCard(row({ price_hkd: undefined as unknown as number })).priceHkd).toBe(
      0,
    );
  });

  it("keeps a free material at zero rather than replacing it", () => {
    expect(toCentreMaterialCard(row({ price_hkd: 0 })).priceHkd).toBe(0);
  });
});

describe("#815 §2.4 centre material soldCount defaults", () => {
  it("defaults a missing or null sold_count to zero", () => {
    expect(toCentreMaterialCard(row({ sold_count: undefined })).soldCount).toBe(0);
    expect(toCentreMaterialCard(row({ sold_count: null })).soldCount).toBe(0);
  });

  it("keeps an explicit count", () => {
    expect(toCentreMaterialCard(row({ sold_count: 0 })).soldCount).toBe(0);
    expect(toCentreMaterialCard(row({ sold_count: 34 })).soldCount).toBe(34);
  });
});

describe("#815 §2.4 centre material sorting", () => {
  it("puts the highest sold count first and breaks ties alphabetically by title", () => {
    const cards = centreMaterialCards([
      row({ id: "b", title: "Beta Notes", sold_count: 5 }),
      row({ id: "a", title: "Alpha Notes", sold_count: 5 }),
      row({ id: "c", title: "Gamma Papers", sold_count: 40 }),
      row({ id: "d", title: "Delta Drills", sold_count: 1 }),
    ]);

    expect(cards.map((c) => c.title)).toEqual([
      "Gamma Papers",
      "Alpha Notes",
      "Beta Notes",
      "Delta Drills",
    ]);
  });

  it("treats a missing sold_count as zero when ordering", () => {
    const cards = centreMaterialCards([
      row({ id: "none", title: "A Untouched", sold_count: null }),
      row({ id: "one", title: "B Sold Once", sold_count: 1 }),
    ]);

    expect(cards.map((c) => c.id)).toEqual(["one", "none"]);
  });

  it("returns an empty list for no rows and for nothing listable", () => {
    expect(centreMaterialCards([])).toEqual([]);
    expect(centreMaterialCards([row({ status: "draft" })])).toEqual([]);
  });
});

describe("#815 §2.4 centre material null-safe tags", () => {
  it("carries null subject, curriculum and material type through as null", () => {
    const card = toCentreMaterialCard(
      row({ subject_tag: null, curriculum_tag: null, material_type: null }),
    );

    expect(card.subject).toBeNull();
    expect(card.curriculum).toBeNull();
    expect(card.materialType).toBeNull();
  });

  it("keeps real tags and never leaks extra row fields onto the card", () => {
    const card = toCentreMaterialCard(row());

    expect(card.subject).toBe("Physics");
    expect(card.curriculum).toBe("IB");
    expect(card.materialType).toBe("past_papers");
    expect(Object.keys(card).sort()).toEqual([
      "curriculum",
      "id",
      "materialType",
      "priceHkd",
      "slug",
      "soldCount",
      "subject",
      "title",
    ]);
  });
});
