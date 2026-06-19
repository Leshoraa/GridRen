import { Elysia } from "elysia";

export const errorHandlingMiddleware = (app: Elysia) =>
  app.onError(({ code, error, set }) => {
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          status: "fail",
          message: "Validation failed",
          errors: error.all
        };
      case "NOT_FOUND":
        set.status = 404;
        return {
          status: "fail",
          message: "Requested resource not found"
        };
      default:
        set.status = 500;
        return {
          status: "error",
          message: error instanceof Error ? error.message : "Internal server error"
        };
    }
  });
