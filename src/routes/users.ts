import { Elysia, t } from "elysia";

export const userRoutes = new Elysia({ prefix: "/users" })
  .get("/", () => {
    return [
      { id: 1, name: "Alice Dev", email: "alice@example.com" },
      { id: 2, name: "Bob Dev", email: "bob@example.com" }
    ];
  })
  .get(
    "/:id",
    ({ params: { id } }) => {
      return {
        id,
        name: "Alice Dev",
        email: "alice@example.com"
      };
    },
    {
      params: t.Object({
        id: t.Numeric()
      })
    }
  )
  .post(
    "/",
    ({ body }) => {
      return {
        status: "success",
        data: body
      };
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String({ format: "email" })
      })
    }
  );
