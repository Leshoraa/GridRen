import { Elysia } from "elysia";
import { authenticationRoutes } from "./auth";
import { userRoutes } from "./users";
import { inpaintRoutes } from "./inpaint";

export const apiRouter = new Elysia({ prefix: "/api/v1" })
  .use(authenticationRoutes)
  .use(userRoutes)
  .use(inpaintRoutes);

