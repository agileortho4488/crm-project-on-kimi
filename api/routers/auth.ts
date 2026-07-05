import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.APP_SECRET || "agile-crm-secret-key-2024"
);

async function createToken(userId: number, username: string, role: string): Promise<string> {
  return new SignJWT({ userId, username, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload as { userId: number; username: string; role: string };
  } catch {
    return null;
  }
}

export const authRouter = createRouter({
  // Login - username/password
  login: publicQuery
    .input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const [user] = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      
      if (!user || !user.isActive) {
        return { success: false, error: "Invalid username or password" };
      }
      
      const validPassword = await bcrypt.compare(input.password, user.password);
      if (!validPassword) {
        return { success: false, error: "Invalid username or password" };
      }
      
      // Update last login
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));
      
      const token = await createToken(user.id, user.username, user.role);
      
      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          division: user.division,
          district: user.district,
        },
      };
    }),

  // Verify token (called on app load)
  me: publicQuery
    .input(z.object({ token: z.string() }).optional())
    .query(async ({ input }) => {
      if (!input?.token) return { user: null };
      
      const payload = await verifyToken(input.token);
      if (!payload) return { user: null };
      
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      
      if (!user || !user.isActive) return { user: null };
      
      return {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          division: user.division,
          district: user.district,
        },
      };
    }),

  // Admin: Create user
  createUser: publicQuery
    .input(z.object({
      adminToken: z.string(),
      username: z.string().min(3).max(50),
      password: z.string().min(4),
      name: z.string().min(1),
      role: z.enum(["admin", "manager", "sales", "marketing", "surgical_assistant", "viewer"]),
      division: z.string().optional(),
      district: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Verify admin token
      const payload = await verifyToken(input.adminToken);
      if (!payload || payload.role !== "admin") {
        return { success: false, error: "Admin access required" };
      }
      
      const db = getDb();
      
      // Check if username exists
      const [existing] = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (existing) {
        return { success: false, error: "Username already exists" };
      }
      
      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      const result = await db.insert(users).values({
        username: input.username,
        password: hashedPassword,
        name: input.name,
        role: input.role,
        division: input.division || null,
        district: input.district || null,
        phone: input.phone || null,
        email: input.email || null,
        isActive: true,
      });
      
      const userId = Number((result as any)[0]?.insertId || 0);
      
      return { success: true, userId, message: `User ${input.username} created` };
    }),

  // Admin: List all users
  listUsers: publicQuery
    .input(z.object({ adminToken: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyToken(input.adminToken);
      if (!payload || payload.role !== "admin") {
        return { success: false, error: "Admin access required", users: [] };
      }
      
      const db = getDb();
      const allUsers = await db.select().from(users);
      
      return {
        success: true,
        users: allUsers.map(u => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          division: u.division,
          district: u.district,
          isActive: u.isActive,
          lastLogin: u.lastLogin,
          createdAt: u.createdAt,
        })),
      };
    }),

  // Admin: Toggle user active status
  toggleUser: publicQuery
    .input(z.object({
      adminToken: z.string(),
      userId: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const payload = await verifyToken(input.adminToken);
      if (!payload || payload.role !== "admin") {
        return { success: false, error: "Admin access required" };
      }
      
      const db = getDb();
      await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
      
      return { success: true, message: `User ${input.isActive ? "activated" : "deactivated"}` };
    }),

  // Seed admin user (creates default admin if no users exist)
  seedAdmin: publicQuery.mutation(async () => {
    const db = getDb();
    
    const [existingAdmin] = await db.select().from(users).limit(1);
    if (existingAdmin) {
      return { success: false, message: "Users already exist, seeding skipped" };
    }
    
    const hashedPassword = await bcrypt.hash("Agile1", 10);
    
    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      name: "Admin User",
      role: "admin",
      isActive: true,
    });
    
    // Create some default users
    const defaultUsers = [
      { username: "sales1", password: await bcrypt.hash("Agile1", 10), name: "Sales Person 1", role: "sales" as const },
      { username: "marketing1", password: await bcrypt.hash("Agile1", 10), name: "Marketing Person 1", role: "marketing" as const },
      { username: "surgical1", password: await bcrypt.hash("Agile1", 10), name: "Surgical Assistant 1", role: "surgical_assistant" as const },
      { username: "manager1", password: await bcrypt.hash("Agile1", 10), name: "Manager 1", role: "manager" as const },
    ];
    
    for (const u of defaultUsers) {
      await db.insert(users).values({ ...u, isActive: true });
    }
    
    return {
      success: true,
      message: "Default users created",
      credentials: [
        { username: "admin", password: "Agile1", role: "admin" },
        { username: "sales1", password: "Agile1", role: "sales" },
        { username: "marketing1", password: "Agile1", role: "marketing" },
        { username: "surgical1", password: "Agile1", role: "surgical_assistant" },
        { username: "manager1", password: "Agile1", role: "manager" },
      ],
    };
  }),
});
