import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { configuration } from "./config";
import { errorHandlingMiddleware } from "./middleware/error";
import { apiRouter } from "./routes";

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({
    assets: "public",
    prefix: "",
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  }))
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: {
          title: "GridRen API Documentation",
          version: "1.0.50"
        }
      }
    })
  )
  .use(errorHandlingMiddleware)
  .use(apiRouter)
  .get("/", ({ set }) => {
    set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
    return Bun.file("public/index.html");
  })
  .listen(configuration.port);

console.log(`Server running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`Swagger docs available at http://${app.server?.hostname}:${app.server?.port}/swagger`);
