import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import { useAuth } from "@/features/auth/useAuth";
import { listMyOrganization } from "./business.functions";

export type OrgPlan = "business" | "enterprise";
export type OrgStatus = "pending" | "active" | "suspended";
export type OrgMemberRole = "owner" | "admin";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  district: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  plan: OrgPlan;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
};

export type OrgMembership = {
  id: string;
  organization_id: string;
  role: OrgMemberRole;
  status: "pending" | "active" | "revoked";
  email: string;
};

export type OrgUsage = {
  coursesUsed: number;
  courseLimit: number | null;
  memberCount: number;
  memberLimit: number;
};

export type MyOrganizationResult = {
  membership: OrgMembership | null;
  organization: Organization | null;
  usage: OrgUsage | null;
};

export function useMyOrganization() {
  const { user } = useAuth();
  const listFn = useServerFn(listMyOrganization);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-organization", user?.id ?? null],
    queryFn: () => listFn() as Promise<MyOrganizationResult>,
    enabled: !!user,
    staleTime: 15_000,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["my-organization"] });
  }, [queryClient]);

  return {
    ...query,
    membership: query.data?.membership ?? null,
    organization: query.data?.organization ?? null,
    usage: query.data?.usage ?? null,
    invalidate,
  };
}
