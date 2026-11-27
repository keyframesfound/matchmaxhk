import { describe, expect, it } from "vitest";

import { requireAdmin, requireDeskStaff, type Db } from "../../src/features/cases/desk-db";

/**
 * #816 §2.1: the desk admits staff, the destructive actions do not. The guards
 * are thin has_role loops, so the fake db answers rpc("has_role") from a role
 * set and nothing else.
 */
function fakeDb(roles: readonly string[], opts: { dataNull?: boolean } = {}): Db {
  return {
    rpc: async (_fn: string, args: Record<string, unknown>) => ({
      data: opts.dataNull ? null : roles.includes(String(args._role)),
      error: null,
    }),
  } as unknown as Db;
}

async function outcome(run: () => Promise<void>): Promise<"ok" | string> {
  try {
    await run();
    return "ok";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const STAFF = ["staff"];
const ADMIN = ["admin", "super_admin"];
const NOBODY = ["tutor", "parent"];

describe("desk role guards (#816 §2.1)", () => {
  it("lets a staff-only user operate the desk", async () => {
    expect(await outcome(() => requireDeskStaff(fakeDb(STAFF), "u-staff"))).toBe("ok");
  });

  it("refuses a staff-only user the admin-only actions", async () => {
    expect(await outcome(() => requireAdmin(fakeDb(STAFF), "u-staff"))).toBe("FORBIDDEN");
  });

  it("lets an admin through both guards", async () => {
    expect(await outcome(() => requireDeskStaff(fakeDb(ADMIN), "u-admin"))).toBe("ok");
    expect(await outcome(() => requireAdmin(fakeDb(ADMIN), "u-admin"))).toBe("ok");
  });

  it("refuses a tutor or parent both guards", async () => {
    expect(await outcome(() => requireDeskStaff(fakeDb(NOBODY), "u-tutor"))).toBe("FORBIDDEN");
    expect(await outcome(() => requireAdmin(fakeDb(NOBODY), "u-parent"))).toBe("FORBIDDEN");
  });

  it("refuses when has_role returns null data", async () => {
    expect(
      await outcome(() => requireDeskStaff(fakeDb(STAFF, { dataNull: true }), "u-staff")),
    ).toBe("FORBIDDEN");
    expect(await outcome(() => requireAdmin(fakeDb(ADMIN, { dataNull: true }), "u-admin"))).toBe(
      "FORBIDDEN",
    );
  });
});
