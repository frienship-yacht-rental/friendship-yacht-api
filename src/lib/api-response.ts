import type { ErrorBody } from "../middleware/error.js";

type Success<T> = {
  success: true;
  data?: T;
  message: string;
};

export type ApiResponse<T> = Success<T> | ErrorBody;
