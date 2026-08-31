import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  pendingFileDeletionsTable,
  reportsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateUserBody,
  ChangeMyPasswordBody,
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
} from "@workspace/api-zod";
import {
  createSession,
  destroySession,
  effectiveUserRole,
  getCurrentUser,
  hashPassword,
  normalizeUserRole,
  verifyPassword,
  requireAdministrator,
  requireUser,
  isAdministrator,
} from "../lib/auth";
import { processPendingFileDeletions } from "../lib/file-cleanup";

const router: IRouter = Router();

function toUserResponse(user: { id: number; email: string; role: string; createdAt: Date }) {
  const role = effectiveUserRole({
    email: user.email,
    role: normalizeUserRole(user.role),
  });
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    isAdmin: role === "admin",
    role,
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

router.post("/auth/me/password", requireUser, async (request, response): Promise<void> => {
  const parsed = ChangeMyPasswordBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter your current password and a new password of at least 8 characters." });
    return;
  }

  const [user] = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, request.currentUser!.id))
    .limit(1);

  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    response.status(400).json({ error: "Current password is incorrect." });
    return;
  }

  await db
    .update(usersTable)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(usersTable.id, request.currentUser!.id));
  response.sendStatus(204);
});

router.use("/auth/users", requireUser, requireAdministrator);

router.get("/auth/users", async (_request, response): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  response.json(users.map(toUserResponse));
});

router.post("/auth/users", async (request, response): Promise<void> => {
  const parsed = CreateUserBody.safeParse(request.body);
  if (!parsed.success || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.email.trim())) {
    response.status(400).json({ error: "Enter a valid email and a password of at least 8 characters." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    })
    .onConflictDoNothing({ target: usersTable.email })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });
  if (!created) {
    response.status(400).json({ error: "An account with that email already exists." });
    return;
  }
  response.status(201).json(toUserResponse(created));
});

router.patch("/auth/users/:userId", async (request, response): Promise<void> => {
  const params = UpdateUserRoleParams.safeParse(request.params);
  const body = UpdateUserRoleBody.safeParse(request.body);
  if (!params.success || !body.success) {
    response.status(400).json({ error: "Choose a valid user role." });
    return;
  }
  if (params.data.userId === request.currentUser!.id && body.data.role !== "admin") {
    response.status(400).json({ error: "You cannot remove your own administrator access." });
    return;
  }

  const [target] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, params.data.userId))
    .limit(1);
  if (!target) {
    response.sendStatus(404);
    return;
  }
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configuredEmail === target.email && body.data.role !== "admin") {
    response.status(400).json({ error: "The configured administrator must keep the Administrator role." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: body.data.role })
    .where(eq(usersTable.id, params.data.userId))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });
  if (!updated) {
    response.sendStatus(404);
    return;
  }
  response.json(toUserResponse(updated));
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

  const deleteResult = await db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!user) return "not-found" as const;
    if (isAdministrator({
      email: user.email,
      role: normalizeUserRole(user.role),
    })) return "administrator" as const;

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
    return "deleted" as const;
  });
  if (deleteResult === "not-found") {
    response.sendStatus(404);
    return;
  }
  if (deleteResult === "administrator") {
    response.status(400).json({ error: "Change this administrator to another role before deleting the account." });
    return;
  }
  await processPendingFileDeletions();
  response.sendStatus(204);
});

export default router;