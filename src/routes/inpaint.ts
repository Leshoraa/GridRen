import { Elysia, t } from "elysia";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export const inpaintRoutes = new Elysia({ prefix: "/inpaint" })
  .post(
    "/",
    async ({ body, set }) => {
      try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
          set.status = 500;
          return { error: "Cloudinary is not configured in backend environment." };
        }

        const uploadRes = await cloudinary.uploader.upload(body.image, {
          folder: "gridren_inpaint"
        });

        let effectStr = "";
        if (body.prompt) {
          effectStr = `gen_remove:prompt_${encodeURIComponent(body.prompt)}`;
        } else if (body.region) {
          effectStr = `gen_remove:region_((x_${body.region.x};y_${body.region.y};w_${body.region.w};h_${body.region.h}))`;
        } else {
          effectStr = "gen_remove";
        }

        const transformedUrl = cloudinary.url(uploadRes.public_id, {
          transformation: [
            { effect: effectStr }
          ],
          secure: true
        });

        const fetchRes = await fetch(transformedUrl);
        if (!fetchRes.ok) {
          const cldErr = fetchRes.headers.get("x-cld-error") || "Unknown Cloudinary error";
          set.status = 400;
          return { error: `Cloudinary error: ${cldErr}` };
        }

        const contentType = fetchRes.headers.get("content-type") || "image/png";
        const arrayBuffer = await fetchRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        
        return { image: `data:${contentType};base64,${base64Data}` };
      } catch (err: any) {
        set.status = 500;
        return { error: err.message || "Internal server error" };
      }
    },
    {
      body: t.Object({
        image: t.String(),
        prompt: t.Optional(t.String()),
        region: t.Optional(
          t.Object({
            x: t.Number(),
            y: t.Number(),
            w: t.Number(),
            h: t.Number()
          })
        )
      })
    }
  );
