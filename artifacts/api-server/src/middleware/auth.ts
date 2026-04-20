import { type Request, type Response, type NextFunction } from "express";
import { eq, gt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token));

  if (!session || session.expiresAt < now) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = session.userId;
  next();
}
