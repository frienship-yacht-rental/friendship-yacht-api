import type { Inquiry } from "./schema.js";

export interface InquiryRepository {
  create(inquiry: Inquiry): Promise<Inquiry>;
}

/** Placeholder until enquiries are persisted (database, CRM, mailbox). */
export class InMemoryInquiryRepository implements InquiryRepository {
  readonly inquiries: Inquiry[] = [];

  async create(inquiry: Inquiry): Promise<Inquiry> {
    this.inquiries.push(inquiry);
    return inquiry;
  }
}
