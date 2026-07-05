import { mysqlTable, serial, varchar, timestamp, boolean, mysqlEnum } from "drizzle-orm/mysql-core";

// Users table - for login/access control
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // bcrypt hashed
  name: varchar("name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["admin", "manager", "sales", "marketing", "surgical_assistant", "viewer"]).notNull().default("viewer"),
  division: varchar("division", { length: 100 }), // which division they belong to
  district: varchar("district", { length: 100 }), // which district they cover
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Login sessions
export const sessions = mysqlTable("sessions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
