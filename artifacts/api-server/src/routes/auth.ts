import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  pendingFileDeletionsTable,
  reportsTable,
  usersTable,
} from "@workspace/db";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
  requireAdministrator,
  requireUser,
  isAdministrator,
} from "../lib/auth";
import { processPendingFileDeletions } from "../lib/file-cleanup";

const router: IRouter = Router();

function toUserResponse(user: { id: number; email: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    isAdmin: isAdministrator(user),
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

router.use("/auth/users", requireUser, requireAdministrator);

router.get("/auth/users", async (_request, response): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  response.json(users.map(toUserResponse));
});

router.post("/auth/users", async (request, response): Promise<void> => {
  const parsed = LoginBody.safeParse(request.body);
  if (!parsed.success || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.email.trim())) {
    response.status(400).json({ error: "Enter a valid email and a password of at least 8 characters." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [created] = await db
    .insert(usersTable)
    .values({ email, passwordHash: await hashPassword(parsed.data.password) })
    .onConflictDoNothing({ target: usersTable.email })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
    });
  if (!created) {
    response.status(400).json({ error: "An account with that email already exists." });
    return;
  }
  response.status(201).json(toUserResponse(created));
});

router.delete("/auth/users/:userId", async (request, response): Promise<void> => {
  const userId = Number(request.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    response.sendStatus(404);
    return;
  }
  if (userId === request.currentUser!.id) {
    response.status(400).json({ error: "The current administrator cannot delete their own account." });
    return;
  }

  const deleted = await db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!user) return false;

    const reports = await transaction
      .select({ storagePath: reportsTable.storagePath })
      .from(reportsTable)
      .where(eq(reportsTable.userId, userId));
    if (reports.length) {
      await transaction
        .insert(pendingFileDeletionsTable)
        .values(reports)
        .onConflictDoNothing({ target: pendingFileDeletionsTable.storagePath });
    }
    await transaction.delete(usersTable).where(eq(usersTable.id, userId));
    return true;
  });
  if (!deleted) {
    response.sendStatus(404);
    return;
  }
  await processPendingFileDeletions();
  response.sendStatus(204);
});

export default router;