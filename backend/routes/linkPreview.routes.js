import express from "express";
import { fetchLinkPreviewImages } from "../services/linkPreview.service.js";

export function createLinkPreviewRoutes(requireAuth) {
  const router = express.Router();

  router.get("/link-preview", requireAuth, async (req, res) => {
    const rawUrl = (req.query.url || "").trim();

    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: "URL query parameter is required.",
      });
    }

    try {
      const { url, images } = await fetchLinkPreviewImages(rawUrl);
      return res.json({
        success: true,
        url,
        images,
      });
    } catch (error) {
      const message = error?.message || "Failed to fetch link preview.";
      const status = /not allowed|invalid url|required/i.test(message) ? 400 : 502;
      return res.status(status).json({
        success: false,
        error: message,
        url: rawUrl,
        images: [],
      });
    }
  });

  return router;
}
