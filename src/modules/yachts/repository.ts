import type { ListYachtsQuery, Yacht, YachtList } from "./schema.js";

/**
 * Persistence boundary. The service depends on this interface, never on a
 * concrete store, so swapping the in-memory seed for a database is a new
 * class here and one line in the module's composition root.
 */
export interface YachtRepository {
  list(query: ListYachtsQuery): Promise<YachtList>;
  findBySlug(slug: string): Promise<Yacht | null>;
}

/** Seed data so the API is useful before a database exists. */
const seed: readonly Yacht[] = [
  {
    id: "5d7c1a3e-8f2b-4c6d-9e1a-2b3c4d5e6f70",
    slug: "aurora-42",
    name: "Aurora",
    model: "FY 42",
    lengthOverallMeters: 12.8,
    beamMeters: 4.1,
    draftMeters: 2.2,
    yearBuilt: 2024,
    heroImageUrl: null,
    summary: "A fast cruiser with a hand-finished teak deck and a carbon rig.",
  },
  {
    id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    slug: "meridian-52",
    name: "Meridian",
    model: "FY 52",
    lengthOverallMeters: 15.9,
    beamMeters: 4.7,
    draftMeters: 2.6,
    yearBuilt: 2025,
    heroImageUrl: null,
    summary: "Blue-water performance with three cabins and a raised saloon.",
  },
  {
    id: "1f2e3d4c-5b6a-4798-8a7b-6c5d4e3f2a1b",
    slug: "solstice-36",
    name: "Solstice",
    model: "FY 36",
    lengthOverallMeters: 11.0,
    beamMeters: 3.7,
    draftMeters: 1.9,
    yearBuilt: 2023,
    heroImageUrl: null,
    summary: "A short-handed day sailer that still sleeps four in comfort.",
  },
];

export class InMemoryYachtRepository implements YachtRepository {
  constructor(private readonly yachts: readonly Yacht[] = seed) {}

  async list({ limit, offset }: ListYachtsQuery): Promise<YachtList> {
    return {
      items: this.yachts.slice(offset, offset + limit),
      total: this.yachts.length,
    };
  }

  async findBySlug(slug: string): Promise<Yacht | null> {
    return this.yachts.find((yacht) => yacht.slug === slug) ?? null;
  }
}
