import { describe, expect, it } from "vitest";

import {
  MAX_CHANNEL_PROOF_POSTS,
  selectPinnedProofPosts,
} from "../../src/features/channels/channel-proof-posts";

/**
 * #712 AC-1: the channel profile shows at most three pinned proof posts, and
 * only the four public fields. Anything without a public photo is skipped, and
 * a tampered/extended stored object cannot smuggle extra fields through.
 */
describe("#712 channel pinned proof posts", () => {
  const withPhoto = (n: number) => ({
    short_text: `Achievement ${n}`,
    detail_text: `Detail ${n}`,
    proof_image_path: `tutor-proofs/u-1/proof-${n}.jpg`,
  });

  it("returns an empty list for a missing or malformed achievements value", () => {
    expect(selectPinnedProofPosts(null)).toEqual([]);
    expect(selectPinnedProofPosts(undefined)).toEqual([]);
    expect(selectPinnedProofPosts("nope")).toEqual([]);
    expect(selectPinnedProofPosts({ short_text: "x" })).toEqual([]);
    expect(selectPinnedProofPosts([])).toEqual([]);
  });

  it("keeps only achievements that carry a proof photo", () => {
    const posts = selectPinnedProofPosts([
      { short_text: "No photo yet", detail_text: "text only" },
      withPhoto(2),
    ]);
    expect(posts).toEqual([
      {
        index: 1,
        shortText: "Achievement 2",
        detailText: "Detail 2",
        imagePath: "tutor-proofs/u-1/proof-2.jpg",
      },
    ]);
  });

  it("caps at three posts", () => {
    const posts = selectPinnedProofPosts([
      withPhoto(1),
      withPhoto(2),
      withPhoto(3),
      withPhoto(4),
    ]);
    expect(posts).toHaveLength(MAX_CHANNEL_PROOF_POSTS);
    expect(posts.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it("drops empty text and trims whitespace", () => {
    const posts = selectPinnedProofPosts([
      { short_text: "   ", proof_image_path: "tutor-proofs/u-1/a.jpg" },
      {
        short_text: "  DSE 5** in Maths  ",
        detail_text: "   ",
        proof_image_path: "  tutor-proofs/u-1/b.jpg  ",
      },
    ]);
    expect(posts).toEqual([
      {
        index: 1,
        shortText: "DSE 5** in Maths",
        detailText: null,
        imagePath: "tutor-proofs/u-1/b.jpg",
      },
    ]);
  });

  it("copies only the four public fields, never extras", () => {
    const posts = selectPinnedProofPosts([
      {
        ...withPhoto(1),
        student_name: "Private Student",
        parent_phone: "9123 4567",
        case_id: "case-1",
      },
    ]);
    expect(Object.keys(posts[0]).sort()).toEqual(["detailText", "imagePath", "index", "shortText"]);
  });

  it("clamps overlong text and paths to the save-time limits", () => {
    const posts = selectPinnedProofPosts([
      {
        short_text: "a".repeat(500),
        detail_text: "b".repeat(1000),
        proof_image_path: `tutor-proofs/u-1/${"c".repeat(400)}`,
      },
    ]);
    expect(posts[0].shortText).toHaveLength(120);
    expect(posts[0].detailText).toHaveLength(600);
    expect(posts[0].imagePath).toHaveLength(300);
  });
});
