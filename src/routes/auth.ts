import { Elysia, t } from "elysia";

export const authenticationRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    ({ body }) => {
      const { email } = body;
      return {
        status: "success",
        token: `jwt_token_${Buffer.from(email).toString("base64")}`
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 })
      })
    }
  );
