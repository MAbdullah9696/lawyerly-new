import type { Request, Response } from "express";
import * as svc from "./lawyers.service.js";

export async function list(req: Request, res: Response) {
  const out = await svc.listLawyers(req.query as never);
  res.json(out);
}

export async function getOne(req: Request, res: Response) {
  const q = req.query as { page?: number; sort?: "recent" | "highest" | "lowest" };
  const out = await svc.getLawyer(req.params.id, Number(q.page ?? 1), q.sort ?? "recent");
  res.json(out);
}
