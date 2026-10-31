// Converts between the Policy shape used by the site and crawlers and a database row.
import type { Policy } from "../types.ts";
import type { NewPolicyRow, PolicyRow } from "./schema.ts";

export function toDbRow(p: Policy): NewPolicyRow {
  return {
    id: p.id,
    level: p.level,
    jurisdiction: p.jurisdiction,
    type: p.type,
    number: p.number ?? null,
    title: p.title,
    summary: p.summary ?? "",
    year: p.year,
    presentedAt: p.presentedAt ?? null,
    signedAt: p.signedAt ?? null,
    status: p.status,
    areas: p.areas ?? [],
    parties: p.parties ?? [],
    authors: p.authors ?? [],
    executive: p.executive ?? null,
    executiveParty: p.executive?.party ?? null,
    sources: p.sources,
    bill: p.bill ?? null,
    reissues: p.reissues ?? null,
    convertedInto: p.convertedInto ?? null,
    curated: Boolean(p.curated),
  };
}

/** Optional fields are left out when empty, matching the JSON files the site was built on. */
export function fromDbRow(r: PolicyRow): Policy {
  const p: Policy = {
    id: r.id,
    level: r.level,
    jurisdiction: r.jurisdiction,
    type: r.type,
    title: r.title,
    summary: r.summary,
    year: r.year,
    presentedAt: r.presentedAt,
    status: r.status,
    areas: r.areas,
    authors: r.authors,
    parties: r.parties,
    executive: r.executive,
    sources: r.sources,
  };
  if (r.number != null) p.number = r.number;
  if (r.signedAt != null) p.signedAt = r.signedAt;
  if (r.bill != null) p.bill = r.bill;
  if (r.reissues != null) p.reissues = r.reissues;
  if (r.convertedInto != null) p.convertedInto = r.convertedInto;
  if (r.curated) p.curated = true;
  return p;
}
