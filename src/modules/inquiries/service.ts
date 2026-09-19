import { randomUUID } from "node:crypto";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import type { YachtService } from "../yachts/service.js";
import type { InquiryRepository } from "./repository.js";
import type { CreateInquiry, InquiryReceipt } from "./schema.js";

export class InquiryService {
  constructor(
    private readonly repository: InquiryRepository,
    private readonly yachts: YachtService,
  ) {}

  async create(input: CreateInquiry): Promise<InquiryReceipt> {
    // A domain rule, not a schema rule: the slug is well-formed but must also
    // refer to a real yacht. Cross-module checks go through the other
    // module's service, never its repository.
    if (input.yachtSlug) {
      await this.yachts.getBySlug(input.yachtSlug).catch((error: unknown) => {
        if (error instanceof NotFoundError) {
          throw new BadRequestError(`Unknown yacht "${input.yachtSlug}"`, {
            field: "yachtSlug",
          });
        }
        throw error;
      });
    }

    const inquiry = await this.repository.create({
      ...input,
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
    });

    return { id: inquiry.id, receivedAt: inquiry.receivedAt };
  }
}
