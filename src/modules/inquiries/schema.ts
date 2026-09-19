import { z } from "zod";
import { yachtSlugParamsSchema } from "../yachts/schema.js";

export const createInquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(2000),
  /** Optional: which yacht the enquiry is about. Must exist. */
  yachtSlug: yachtSlugParamsSchema.shape.slug.optional(),
});

export const inquirySchema = createInquirySchema.extend({
  id: z.uuid(),
  receivedAt: z.iso.datetime(),
});

/** What the client gets back: enough to reference the enquiry, nothing more. */
export const inquiryReceiptSchema = inquirySchema.pick({ id: true, receivedAt: true });

export type CreateInquiry = z.infer<typeof createInquirySchema>;
export type Inquiry = z.infer<typeof inquirySchema>;
export type InquiryReceipt = z.infer<typeof inquiryReceiptSchema>;
