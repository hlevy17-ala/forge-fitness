import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable, otpTokensTable, sessionsTable, workoutSetsTable, bodyMetricsTable, calorieLogsTable, workoutTemplatesTable } from "@workspace/db";
import {
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  LogoutResponse,
  GetMeResponse,
} from "@workspace/api-zod";
import { authMiddleware } from "../middleware/auth";

const router: IRouter = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "Forge <noreply@tryforgefitness.com>";
const OTP_TTL_MS = 10 * 60 * 1000;
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

async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[DEV] OTP for ${to}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: "Your Forge login code",
      html: `<p>Your login code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error: ${res.status} ${body}`);
  }
}

// Create an anonymous guest session — no email, no OTP
router.post("/auth/guest", async (_req, res): Promise<void> => {
  const [user] = await db.insert(usersTable).values({}).returning();
  const token = await createSession(user.id);
  res.json(VerifyOtpResponse.parse({ token, user: { id: user.id, email: null, isGuest: true } }));
});

router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const parsed = RequestOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    [user] = await db.insert(usersTable).values({ email }).returning();
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db.insert(otpTokensTable).values({ userId: user.id, code, expiresAt });

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    res.status(500).json({ error: "Failed to send OTP email" });
    return;
  }

  res.json(RequestOtpResponse.parse({ message: "OTP sent" }));
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { code, guestToken } = parsed.data;
  const now = new Date();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  const [otp] = await db
    .select()
    .from(otpTokensTable)
    .where(and(eq(otpTokensTable.userId, user.id), eq(otpTokensTable.code, code), eq(otpTokensTable.used, false)))
    .orderBy(otpTokensTable.expiresAt)
    .limit(1);

  if (!otp || otp.expiresAt < now) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db.update(otpTokensTable).set({ used: true }).where(eq(otpTokensTable.id, otp.id));

  // Migrate guest data if a guest token was provided
  if (guestToken) {
    const [guestSession] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, guestToken));
    if (guestSession && guestSession.userId !== user.id) {
      const guestUserId = guestSession.userId;
      await Promise.all([
        db.update(workoutSetsTable).set({ userId: user.id }).where(eq(workoutSetsTable.userId, guestUserId)),
        db.update(bodyMetricsTable).set({ userId: user.id }).where(eq(bodyMetricsTable.userId, guestUserId)),
        db.update(calorieLogsTable).set({ userId: user.id }).where(eq(calorieLogsTable.userId, guestUserId)),
        db.update(workoutTemplatesTable).set({ userId: user.id }).where(eq(workoutTemplatesTable.userId, guestUserId)),
      ]);
      // Clean up the guest user
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, guestUserId));
      await db.delete(usersTable).where(eq(usersTable.id, guestUserId));
    }
  } else {
    // Legacy: claim any null-userId rows (first login on old data)
    await Promise.all([
      db.update(workoutSetsTable).set({ userId: user.id }).where(isNull(workoutSetsTable.userId)),
      db.update(bodyMetricsTable).set({ userId: user.id }).where(isNull(bodyMetricsTable.userId)),
      db.update(calorieLogsTable).set({ userId: user.id }).where(isNull(calorieLogsTable.userId)),
      db.update(workoutTemplatesTable).set({ userId: user.id }).where(isNull(workoutTemplatesTable.userId)),
    ]);
  }

  const token = await createSession(user.id);
  res.json(VerifyOtpResponse.parse({ token, user: { id: user.id, email: user.email, isGuest: false } }));
});

router.post("/auth/logout", authMiddleware, async (req, res): Promise<void> => {
  const token = req.headers.authorization!.slice(7);
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  res.json(LogoutResponse.parse({ message: "Logged out" }));
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(GetMeResponse.parse({ id: user.id, email: user.email, isGuest: !user.email }));
});

export default router;
