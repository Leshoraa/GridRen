import { Elysia, t } from "elysia";

export const inpaintRoutes = new Elysia({ prefix: "/inpaint" })
  .post(
    "/",
    async ({ body, set }) => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return { error: "OpenRouter API Key is not configured in backend environment." };
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "GridRen Photo Editor"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: body.prompt || "Erase the area covered in bright red, fill and reconstruct the background seamlessly."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: body.image
                  }
                }
              ]
            }
          ],
          modalities: ["image", "text"],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        set.status = response.status;
        return { error: `OpenRouter error: ${errText}` };
      }

      const result = await response.json() as any;
      const base64Url = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!base64Url) {
        set.status = 502;
        return { error: "No image generated in the response." };
      }

      return { image: base64Url };
    },
    {
      body: t.Object({
        image: t.String(),
        prompt: t.Optional(t.String())
      })
    }
  );
