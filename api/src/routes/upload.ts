import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "../errors";

const router = Router();

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadTicketImageMaxBytes }
});

function extFromContentType(contentType?: string): string {
  if (!contentType) return ".jpg";
  const base = contentType.split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[base] ?? ".jpg";
}

function safeExt(filename?: string): string {
  if (!filename || !filename.includes(".")) return ".jpg";
  const ext = `.${filename.split(".").pop()!.toLowerCase()}`;
  return ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
}

router.post("/ticket-image", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new ApiError(422, "VALIDATION_ERROR", "Request validation failed.", { fields: [{ field: "file", message: "Required" }] });
    const contentType = (file.mimetype || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new ApiError(422, "INVALID_IMAGE_FORMAT", "Invalid image type.", {
        allowed_types: Array.from(ALLOWED_CONTENT_TYPES).sort()
      });
    }
    if (file.size > env.uploadTicketImageMaxBytes) {
      throw new ApiError(422, "IMAGE_TOO_LARGE", "Image exceeds maximum allowed size.", {
        max_bytes: env.uploadTicketImageMaxBytes
      });
    }

    const ext = extFromContentType(file.mimetype) || safeExt(file.originalname);
    const filename = `ticket_${crypto.randomUUID().replace(/-/g, "")}${ext}`;
    fs.mkdirSync(env.uploadDir, { recursive: true });
    const target = path.join(env.uploadDir, filename);
    fs.writeFileSync(target, file.buffer);

    res.json({ url: `/${filename}` });
  } catch (e) {
    next(e);
  }
});

export default router;
