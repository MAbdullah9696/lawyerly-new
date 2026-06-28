import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  uploadDocument,
  listDocuments,
  getDocument,
  getDocumentUrl,
  getAnalysis,
  deleteDocument,
} from "./documents.controller.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.post("/upload", ...uploadDocument);
documentsRouter.get("/", listDocuments);
documentsRouter.get("/:id", getDocument);
documentsRouter.get("/:id/url", getDocumentUrl);
documentsRouter.get("/:id/analysis", getAnalysis);
documentsRouter.delete("/:id", deleteDocument);
