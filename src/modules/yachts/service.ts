import { NotFoundError } from "../../lib/errors.js";
import type { YachtRepository } from "./repository.js";
import type { ListYachtsQuery, Yacht, YachtList } from "./schema.js";

/**
 * Business rules live here, independent of HTTP. Controllers translate
 * requests into calls on this class; repositories translate its needs into
 * storage. Neither leaks into the other.
 */
export class YachtService {
  constructor(private readonly repository: YachtRepository) {}

  list(query: ListYachtsQuery): Promise<YachtList> {
    return this.repository.list(query);
  }

  async getBySlug(slug: string): Promise<Yacht> {
    const yacht = await this.repository.findBySlug(slug);
    if (!yacht) throw new NotFoundError("Yacht");
    return yacht;
  }
}
