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
  // Rute styles.css aman dari ENOENT
  .get("/styles.css", () => {
    if (isServerless) return new Response("Styles handled by Vercel CDN", { status: 200 });
    return new Response(Bun.file("public/styles.css"), {
      headers: { "Content-Type": "text/css;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
    });
  })
  // Rute bundle.js aman dari ENOENT
  .get("/bundle.js", () => {
    if (isServerless) return new Response("Bundle handled by Vercel CDN", { status: 200 });
    return new Response(Bun.file("public/bundle.js"), {
      headers: { "Content-Type": "application/javascript;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
    });
  })
  // Hanya gunakan staticPlugin di lokal komputer
  .use(
    isServerless 
      ? (x) => x 
      : staticPlugin({
          assets: "public",
          prefix: "",
          headers: { "Cache-Control": NO_CACHE }
        })
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
  // Rute utama / aman dari ENOENT
  .get("/", () => {
    if (isServerless) {
      return new Response("GridRen Backend API Active", { status: 200 });
    }
    return new Response(Bun.file("public/index.html"), {
      headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": NO_CACHE, "Pragma": "no-cache" }
    });
  });

if (!isServerless && typeof Bun !== "undefined" && import.meta.main) {
  app.listen(configuration.port);
  console.log(`Server running at http://${app.server?.hostname}:${app.server?.port}`);
  console.log(`Swagger docs available at http://${app.server?.hostname}:${app.server?.port}/swagger`);
}

export default app;