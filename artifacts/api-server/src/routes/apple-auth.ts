import { Router, type IRouter } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function makeToken() {
  return randomBytes(32).toString("hex");
}

async function createSession(userId: number): Promise<string> {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

router.post("/auth/apple", async (req, res): Promise<void> => {
  const { identityToken, guestToken } = req.body ?? {};

  if (!identityToken) {
    res.status(400).json({ error: "identityToken is required" });
    return;
  }

  let appleUserId: string;
  let email: string | null = null;

  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: "com.harrylevy.forgefit",
    });
    appleUserId = payload.sub!;
    email = (payload.email as string) ?? null;
  } catch (err) {
    console.error("Apple token verification failed:", err);
    res.status(401).json({ error: "Invalid Apple identity token" });
    return;
  }

  // Find or create user by Apple ID
  let [user] = await db.select().from(usersTable).where(eq(usersTable.appleId, appleUserId));

  if (!user) {
    // If we have an email, check if a user already exists with that email
    if (email) {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (existing) {
        // Link Apple ID to existing email account
        [user] = await db.update(usersTable)
          .set({ appleId: appleUserId })
          .where(eq(usersTable.id, existing.id))
          .returning();
      }
    }
    if (!user) {
      [user] = await db.insert(usersTable).values({ email, appleId: appleUserId }).returning();
    }
  }

  // Migrate guest data if provided
  if (guestToken) {
    const [guestSession] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, guestToken));
    if (guestSession && guestSession.userId !== user.id) {
      const { workoutSetsTable, bodyMetricsTable, calorieLogsTable, workoutTemplatesTable } = await import("@workspace/db");
      await Promise.all([
        db.update(workoutSetsTable).set({ userId: user.id }).where(eq(workoutSetsTable.userId, guestSession.userId)),
        db.update(bodyMetricsTable).set({ userId: user.id }).where(eq(bodyMetricsTable.userId, guestSession.userId)),
        db.update(calorieLogsTable).set({ userId: user.id }).where(eq(calorieLogsTable.userId, guestSession.userId)),
        db.update(workoutTemplatesTable).set({ userId: user.id }).where(eq(workoutTemplatesTable.userId, guestSession.userId)),
      ]);
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, guestSession.userId));
      await db.delete(usersTable).where(eq(usersTable.id, guestSession.userId));
    }
  }

  const token = await createSession(user.id);
  res.json({ token, user: { id: user.id, email: user.email, isGuest: false } });
});

export default router;
