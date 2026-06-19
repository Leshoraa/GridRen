import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { configuration } from "./config";
import { errorHandlingMiddleware } from "./middleware/error";
import { apiRouter } from "./routes";

const NO_CACHE = "no-store, no-cache, must-revalidate, proxy-revalidate";
const isServerless = typeof process !== "undefined" && process.env.VERCEL === "1";

const app = new Elysia()
  .use(cors())
  .get("/styles.css", () => new Response(Bun.file("public/styles.css"), {
    headers: { "Content-Type": "text/css;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
  }))
  .get("/bundle.js", () => new Response(Bun.file("public/bundle.js"), {
    headers: { "Content-Type": "application/javascript;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
  }))
  .use(staticPlugin({
    assets: "public",
    prefix: "",
    headers: { "Cache-Control": NO_CACHE }
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
  .get("/", () => new Response(Bun.file("public/index.html"), {
    headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
  }));

if (!isServerless && typeof Bun !== "undefined" && import.meta.main) {
  app.listen(configuration.port);
  console.log(`Server running at http://${app.server?.hostname}:${app.server?.port}`);
  console.log(`Swagger docs available at http://${app.server?.hostname}:${app.server?.port}/swagger`);
}

export { app };

export default {
  fetch(request: Request) {
    return app.handle(request);
  }
};
