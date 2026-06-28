/**
 * Storage presign endpoint (§8.7, §11).
 *
 * GET /api/storage/presign?type=document&filename=x.pdf
 *   → { putUrl, objectKey }  (presigned PUT, 5-min expiry)
 *
 * NOTE: The raw /serve?key= endpoint was removed (C-3 security fix — it had no
 * ownership check). All file access must go through ownership-checked routes:
 *   GET /api/documents/:id/url   (user documents, enforces userId ownership)
 */
import { Router, type Request, type Response } from "express";
import path from "node:path";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../middleware/error.js";
import { presignPut, presignGet, makeObjectKey, UPLOAD_RULES, type UploadCategory } from "../../lib/storage.js";

export const storageRouter = Router();
storageRouter.use(requireAuth);

const TYPE_TO_CATEGORY: Record<string, UploadCategory> = {
  document: "document",
  profile: "profile",
  "lawyer-doc": "lawyer-doc",
};

const TYPE_TO_FOLDER: Record<string, "documents" | "profiles" | "lawyer-docs"> = {
  document: "documents",
  profile: "profiles",
  "lawyer-doc": "lawyer-docs",
};

storageRouter.get(
  "/presign",
  asyncHandler(async (req: Request, res: Response) => {
    const type = String(req.query.type ?? "");
    const filename = String(req.query.filename ?? "");

    const category = TYPE_TO_CATEGORY[type];
    if (!category) throw new AppError(400, "invalid_type", "type must be document, profile, or lawyer-doc.");

    const ext = path.extname(filename).replace(".", "").toLowerCase();
    const rules = UPLOAD_RULES[category];

    if (!(rules.exts as readonly string[]).includes(ext)) {
      throw new AppError(400, "invalid_ext", `Allowed extensions: ${rules.exts.join(", ")}`);
    }

    const mime = extToMime(ext);
    const objectKey = makeObjectKey(TYPE_TO_FOLDER[type], ext);
    const putUrl = await presignPut(objectKey, mime, 300);

    res.json({ putUrl, objectKey });
  }),
);

// /serve endpoint removed — use /api/documents/:id/url instead (C-3 fix).

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  return map[ext] ?? "application/octet-stream";
}
