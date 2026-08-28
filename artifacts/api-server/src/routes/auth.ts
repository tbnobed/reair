import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  RegisterBody,
  RegisterResponse,
} from "@workspace/api-zod";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

function toUserResponse(user: { id: number; email: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/auth/me", async (request, response): Promise<void> => {
  const user = await getCurrentUser(request);
  response.json(
    GetCurrentUserResponse.parse({
      authenticated: Boolean(user),
      user: user ? toUserResponse(user) : null,
    }),
  );
});

router.post("/auth/register", async (request, response): Promise<void> => {
  const parsed = RegisterBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a valid email and a password of at least 8 characters." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing[0]) {
    response.status(400).json({ error: "An account with that email already exists." });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash: await hashPassword(parsed.data.password) })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    });

  await createSession(user.id, response);
  response.status(201).json(
    RegisterResponse.parse({ user: toUserResponse(user) }),
  );
});

router.post("/auth/login", async (request, response): Promise<void> => {
  const parsed = LoginBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  await createSession(user.id, response);
  response.json(LoginResponse.parse({ user: toUserResponse(user) }));
});

router.post("/auth/logout", async (request, response): Promise<void> => {
  await destroySession(request, response);
  response.sendStatus(204);
});

export default router;