import { describe, expect, it } from "vitest";

import { requireAdmin, requireDeskStaff, type Db } from "../../src/features/cases/desk-db";

function dbWithRoles(roles: string[]): Db {
  return {
    rpc: async (_name: string, args: { _role: string }) => ({
      data: roles.includes(args._role),
      error: null,
    }),
  } as unknown as Db;
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error as Error & { statusCode?: number };
  }
}

describe("#825 AC-CS-7 desk guards answer 403", () => {
  it("requireAdmin throws FORBIDDEN with statusCode 403", async () => {
    const error = await rejection(requireAdmin(dbWithRoles([]), "user-1"));
    expect(error?.message).toBe("FORBIDDEN");
    expect(error?.statusCode).toBe(403);
  });

  it("requireDeskStaff throws FORBIDDEN with statusCode 403", async () => {
    const error = await rejection(requireDeskStaff(dbWithRoles([]), "user-1"));
    expect(error?.message).toBe("FORBIDDEN");
    expect(error?.statusCode).toBe(403);
  });

  it("admits the intended roles", async () => {
    await expect(requireDeskStaff(dbWithRoles(["staff"]), "u")).resolves.toBeUndefined();
    await expect(requireDeskStaff(dbWithRoles(["admin"]), "u")).resolves.toBeUndefined();
    await expect(requireAdmin(dbWithRoles(["staff"]), "u")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
