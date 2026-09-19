import { createYachtController } from "./controller.js";
import { InMemoryYachtRepository } from "./repository.js";
import { createYachtRouter } from "./router.js";
import { YachtService } from "./service.js";

/**
 * Composition root for the module. Dependencies are wired explicitly here
 * rather than through a container — with a handful of modules that is easier
 * to read and to test, and there is nothing to configure.
 */
export const yachtService = new YachtService(new InMemoryYachtRepository());
export const yachtRouter = createYachtRouter(createYachtController(yachtService));

export type { Yacht, YachtList } from "./schema.js";
