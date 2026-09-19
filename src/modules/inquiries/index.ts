import { yachtService } from "../yachts/index.js";
import { createInquiryController } from "./controller.js";
import { InMemoryInquiryRepository } from "./repository.js";
import { createInquiryRouter } from "./router.js";
import { InquiryService } from "./service.js";

export const inquiryService = new InquiryService(
  new InMemoryInquiryRepository(),
  yachtService,
);
export const inquiryRouter = createInquiryRouter(createInquiryController(inquiryService));

export type { CreateInquiry, InquiryReceipt } from "./schema.js";
