import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { existsSync } from "fs";
import { join } from "path";
import { configuration } from "./config";
import { errorHandlingMiddleware } from "./middleware/error";
import { apiRouter } from "./routes";

const NO_CACHE = "no-store, no-cache, must-revalidate, proxy-revalidate";
const hasPublic = existsSync(join(process.cwd(), "public"));

const app = new Elysia()
  .use(cors())
  .get("/styles.css", () => {
    if (!hasPublic) return new Response("Styles handled by Vercel CDN", { status: 200 });
    return new Response(Bun.file("public/styles.css"), {
      headers: { "Content-Type": "text/css;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
    });
  })
  .get("/bundle.js", () => {
    if (!hasPublic) return new Response("Bundle handled by Vercel CDN", { status: 200 });
    return new Response(Bun.file("public/bundle.js"), {
      headers: { "Content-Type": "application/javascript;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
    });
  })
  .use(
    hasPublic 
      ? staticPlugin({
          assets: "public",
          prefix: "",
          headers: { "Cache-Control": NO_CACHE }
        })
      : (x) => x 
  )
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
  .get("/", () => {
    if (!hasPublic) {
      return new Response("GridRen Backend API Active", { status: 200 });
    }
    return new Response(Bun.file("public/index.html"), {
      headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
    });
  });

if (hasPublic && typeof Bun !== "undefined" && import.meta.main) {
  app.listen(configuration.port);
  console.log(`Server running at http://${app.server?.hostname}:${app.server?.port}`);
  console.log(`Swagger docs available at http://${app.server?.hostname}:${app.server?.port}/swagger`);
}

export default app;