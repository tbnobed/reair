import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { logger } from "./logger";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "reair_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: number;
  email: string;
  createdAt: Date;
};

function hashToken(token: string): string {
  const secret =
    process.env.SESSION_SECRET ?? "development-only-session-secret";
  return createHmac("sha256", secret).update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [, saltHex, hashHex] = encoded.split("$");
  if (!saltHex || !hashHex) return false;

  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function seedAdminUser(): Promise<void> {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredEmail && !configuredPassword) return;
  if (!configuredEmail || !configuredPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set together.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (configuredPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long.");
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, configuredEmail))
    .limit(1);

  if (existing[0]) {
    logger.info({ email: configuredEmail }, "Configured admin account already exists");
    return;
  }

  await db
    .insert(usersTable)
    .values({
      email: configuredEmail,
      passwordHash: await hashPassword(configuredPassword),
    })
    .onConflictDoNothing({ target: usersTable.email });

  logger.info({ email: configuredEmail }, "Seeded configured admin account");
}

export async function createSession(
  userId: number,
  response: Response,
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessionsTable).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });

  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
      sessionId: sessionsTable.id,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        eq(sessionsTable.tokenHash, hashToken(token)),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    createdAt: rows[0].createdAt,
  };
}

export async function destroySession(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  }
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function requireUser(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getCurrentUser(request);
  if (!user) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  request.currentUser = user;
  next();
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}