import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validate } from "../../middleware/validate.js";
import { uploadSchema, shareSchema } from "./documents.schemas.js";
import {
  registerUpload,
  getUserDocuments,
  getDocumentById,
  getDocumentAnalysis,
  getDocumentServeUrl,
  softDeleteDocument,
} from "./documents.service.js";

export const uploadDocument = [
  validate({ body: uploadSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { objectKey, fileName, fileType } = req.body as {
      objectKey: string;
      fileName: string;
      fileType: string;
    };
    const docId = await registerUpload(req.auth!.userId, objectKey, fileName, fileType);
    res.status(201).json({ documentId: docId, status: "processing" });
  }),
];

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const docs = await getUserDocuments(req.auth!.userId);
  res.json({ documents: docs });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.auth!.userId, req.params.id);
  res.json({ document: doc });
});

export const getAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const analysis = await getDocumentAnalysis(req.auth!.userId, req.params.id);
  res.json({ analysis });
});

export const getDocumentUrl = asyncHandler(async (req: Request, res: Response) => {
  const url = await getDocumentServeUrl(req.auth!.userId, req.params.id);
  res.json({ url });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await softDeleteDocument(req.auth!.userId, req.params.id);
  res.json({ message: "Document deleted." });
});
