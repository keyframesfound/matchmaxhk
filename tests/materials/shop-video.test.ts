import { describe, expect, it } from "vitest";

import { parseVimeoUrl, validateCourseVideoUrl } from "../../src/lib/vimeo";
import { parseYouTubeUrl } from "../../src/lib/youtube";
import {
  computeFolderAdjustedPrice,
  folderSavingsPercent,
  splitMaterialMoney,
} from "../../src/features/materials/lifecycle";
import {
  buildFolderChildGrantRows,
  FOLDER_GRANT_REASON_PREFIX,
} from "../../src/features/materials/checkout.functions";

describe("parseVimeoUrl — embed-only allowlist", () => {
  it("accepts vimeo.com/<digits> and player.vimeo.com/video/<digits>", () => {
    expect(parseVimeoUrl("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      videoId: "123456789",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
    expect(parseVimeoUrl("https://player.vimeo.com/video/987654321")?.videoId).toBe("987654321");
    expect(parseVimeoUrl("https://vimeo.com/123456789?h=abc123")?.videoId).toBe("123456789");
  });

  it("rejects albums, showcases, reviews and non-Vimeo hosts", () => {
    expect(parseVimeoUrl("https://vimeo.com/album/123/some-video")).toBeNull();
    expect(parseVimeoUrl("https://vimeo.com/channels/staffpicks/123456789")).toBeNull();
    expect(parseVimeoUrl("https://vimeo.com/showcase/1234567")).toBeNull();
    expect(parseVimeoUrl("https://vimeo.com/manage/videos/123456789")).toBeNull();
    expect(parseVimeoUrl("https://loom.com/share/abc")).toBeNull();
    expect(parseVimeoUrl("not a url")).toBeNull();
    expect(parseVimeoUrl("")).toBeNull();
    expect(parseVimeoUrl(null)).toBeNull();
  });
});

describe("validateCourseVideoUrl — the single validator everywhere", () => {
  it("routes unlisted YouTube links to youtube-nocookie embeds", () => {
    const result = validateCourseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result?.provider).toBe("youtube");
    expect(result?.embedUrl).toBe(
      parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embedUrl,
    );
    expect(result?.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/")).toBe(true);
  });

  it("accepts youtu.be and Vimeo alike", () => {
    expect(validateCourseVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(validateCourseVideoUrl("https://vimeo.com/123456789")?.provider).toBe("vimeo");
  });

  it("rejects Google Drive, Loom, OneDrive, bare MP4s and junk", () => {
    for (const bad of [
      "https://drive.google.com/file/d/1AbCdEfGh/view",
      "https://www.loom.com/share/abc123def456",
      "https://1drv.ms/v/s!AbCdEfGh",
      "https://cdn.example.com/lesson.mp4",
      "watch?v=short",
    ]) {
      expect(validateCourseVideoUrl(bad)).toBeNull();
    }
  });
});

describe("computeFolderAdjustedPrice — folder upgrade proration", () => {
  it("subtracts what the buyer already paid, floored at 0", () => {
    expect(computeFolderAdjustedPrice({ bulkHkd: 100, paidChildGross: [40, 30] })).toEqual({
      ownedSum: 70,
      adjusted: 30,
    });
    expect(computeFolderAdjustedPrice({ bulkHkd: 50, paidChildGross: [40, 30] })).toEqual({
      ownedSum: 70,
      adjusted: 0,
    });
  });

  it("ignores negative junk and rounds to cents", () => {
    // bulk 33.335 → 33.34; owned 10.111 → 10.11; adjusted 23.23.
    expect(computeFolderAdjustedPrice({ bulkHkd: 33.335, paidChildGross: [-5, 10.111] })).toEqual({
      ownedSum: 10.11,
      adjusted: 23.23,
    });
  });

  it("no owned children → full bulk price", () => {
    expect(computeFolderAdjustedPrice({ bulkHkd: 120, paidChildGross: [] })).toEqual({
      ownedSum: 0,
      adjusted: 120,
    });
  });
});

describe("folderSavingsPercent", () => {
  it("returns whole percent of the discount vs list price", () => {
    expect(folderSavingsPercent(80, 100)).toBe(20);
    expect(folderSavingsPercent(99, 100)).toBe(1);
  });

  it("is 0 when there is no saving or the sum is empty", () => {
    expect(folderSavingsPercent(100, 100)).toBe(0);
    expect(folderSavingsPercent(120, 100)).toBe(0);
    expect(folderSavingsPercent(50, 0)).toBe(0);
  });
});

describe("buildFolderChildGrantRows — the #250 grant shape per child", () => {
  it("builds delivered is_grant rows at HK$0 with the folder reason", () => {
    const now = new Date("2026-10-24T03:24:00Z");
    const rows = buildFolderChildGrantRows({
      folderId: "folder-1",
      childIds: ["child-1", "child-2"],
      buyerAccountId: "buyer-1",
      tutorId: "tutor-1",
      grantedBy: "staff-1",
      now,
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe("delivered");
      expect(row.is_grant).toBe(true);
      expect(row.gross_hkd).toBe(0);
      expect(row.platform_fee_hkd).toBe(0);
      expect(row.tutor_net_hkd).toBe(0);
      expect(row.grant_reason).toBe(`${FOLDER_GRANT_REASON_PREFIX}folder-1`);
      expect(row.granted_by).toBe("staff-1");
      expect(row.delivered_at).toBe(now.toISOString());
    }
    expect(rows[0].material_id).toBe("child-1");
    expect(rows[1].material_id).toBe("child-2");
  });

  it("null granted_by on the $0 proration path (no staff involved)", () => {
    const rows = buildFolderChildGrantRows({
      folderId: "folder-1",
      childIds: ["child-1"],
      buyerAccountId: "buyer-1",
      tutorId: "tutor-1",
      grantedBy: null,
    });
    expect(rows[0].granted_by).toBeNull();
    expect(rows[0].delivered_by).toBeNull();
  });

  it("the grant invariants match the money split the folder order skips", () => {
    // Sanity: the prorated folder order itself pays the normal 20/80 split.
    const { platformFeeHkd, tutorNetHkd } = splitMaterialMoney(30);
    expect(platformFeeHkd).toBe(6);
    expect(tutorNetHkd).toBe(24);
  });
});
