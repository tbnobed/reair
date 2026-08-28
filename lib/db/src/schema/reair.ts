import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "reair_users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("reair_users_email_idx").on(table.email)],
);

export const sessionsTable = pgTable(
  "reair_sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("reair_sessions_token_hash_idx").on(table.tokenHash)],
);

export const reportsTable = pgTable("reair_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clipsTable = pgTable("reair_clips", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => reportsTable.id, { onDelete: "cascade" }),
  clipKey: text("clip_key").notNull(),
  date: text("date"),
  revision: text("revision"),
  time: text("time"),
  originalAir: text("original_air"),
  lastAir: text("last_air"),
  source: text("source").notNull(),
  hosts: text("hosts").array().notNull().default([]),
  guests: text("guests").array().notNull().default([]),
  shortSynopsis: text("short_synopsis").notNull().default(""),
  longSynopsis: text("long_synopsis").notNull().default(""),
  duplicateLongSynopsis: text("duplicate_long_synopsis")
    .notNull()
    .default("false"),
  sensitiveNotes: jsonb("sensitive_notes").notNull().default([]),
  dateNotes: jsonb("date_notes").notNull().default([]),
  flagCount: integer("flag_count").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  uploadedAt: true,
});
export const insertClipSchema = createInsertSchema(clipsTable).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertClip = z.infer<typeof insertClipSchema>;
export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type Clip = typeof clipsTable.$inferSelect;