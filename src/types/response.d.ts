// Standard API response shapes used across the backend
export interface SuccessResponse<T = any> {
  success: true;
  message?: string;
  code?: string;
  data?: T;
  meta?: Record<string, any>;
  // Allow other optional fields (e.g., pagination, next, route)
  [key: string]: any;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  type?: string;
  hint?: string;
  action?: string;
  next?: string;
  route?: string;
  [key: string]: any;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Convenience aliases for JS projects that use JSDoc typedefs
export type ApiSuccess<T = any> = SuccessResponse<T>;
export type ApiError = ErrorResponse;
