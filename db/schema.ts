import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  json,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

// ==========================================
// MASTER CRM SCHEMA
// ==========================================

// Track data sources (where records came from)
export const dataSources = mysqlTable("data_sources", {
  id: serial("id").primaryKey(),
  sourceType: varchar("source_type", { length: 50 }).notNull(), // 'upload', 'scraper', 'manual', 'enrichment'
  sourceName: varchar("source_name", { length: 255 }), // 'justdial', 'practo', 'pdf_upload', 'excel_upload'
  sourceUrl: text("source_url"), // URL if scraped
  fileName: varchar("file_name", { length: 255 }), // filename if uploaded
  rawDataCount: int("raw_data_count").default(0),
  processedCount: int("processed_count").default(0),
  status: varchar("status", { length: 50 }).default("pending"), // pending, processing, completed, failed
  metadata: json("metadata"), // extra info
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Raw data imports - unprocessed data from files/scraping
export const rawImports = mysqlTable("raw_imports", {
  id: serial("id").primaryKey(),
  sourceId: bigint("source_id", { mode: "number", unsigned: true }),
  rawData: json("raw_data").notNull(), // original raw data as JSON
  parsedName: varchar("parsed_name", { length: 255 }),
  parsedPhone: varchar("parsed_phone", { length: 50 }),
  parsedEmail: varchar("parsed_email", { length: 255 }),
  parsedAddress: text("parsed_address"),
  parsedDistrict: varchar("parsed_district", { length: 100 }),
  parsedSpecialty: varchar("parsed_specialty", { length: 255 }),
  parsedHospital: varchar("parsed_hospital", { length: 255 }),
  matchConfidence: int("match_confidence").default(0), // 0-100
  matchedContactId: bigint("matched_contact_id", { mode: "number", unsigned: true }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, matched, new, duplicate
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Master contacts table - unified database of all doctors/hospitals
export const contacts = mysqlTable("contacts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["doctor", "hospital", "clinic", "distributor", "corporate"]).notNull().default("doctor"),
  specialty: varchar("specialty", { length: 255 }),
  designation: varchar("designation", { length: 255 }),
  hospital: varchar("hospital", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  phone2: varchar("phone2", { length: 50 }),
  email: varchar("email", { length: 255 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  address: text("address"),
  district: varchar("district", { length: 100 }),
  division: varchar("division", { length: 100 }),
  status: mysqlEnum("status", ["active", "inactive", "prospect", "blacklisted"]).notNull().default("active"),
  notes: text("notes"),
  lastContact: timestamp("last_contact"),
  nextFollowUp: timestamp("next_follow_up"),
  source: varchar("source", { length: 100 }), // where this contact was first found
  sourceUrl: text("source_url"),
  enrichmentData: json("enrichment_data"), // AI enriched data
  tags: json("tags").default("[]"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_contacts_phone").on(table.phone),
  index("idx_contacts_district").on(table.district),
  index("idx_contacts_division").on(table.division),
  index("idx_contacts_type").on(table.type),
  index("idx_contacts_status").on(table.status),
]);

// Leads / Sales Pipeline
export const leads = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  contactId: bigint("contact_id", { mode: "number", unsigned: true }),
  division: varchar("division", { length: 100 }),
  productInterest: json("product_interest").default("[]"),
  stage: mysqlEnum("stage", ["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]).notNull().default("new"),
  value: int("value").default(0),
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  source: varchar("source", { length: 100 }),
  assignedTo: varchar("assigned_to", { length: 100 }),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

// Activities / Interactions log
export const activities = mysqlTable("activities", {
  id: serial("id").primaryKey(),
  type: mysqlEnum("type", ["call", "visit", "meeting", "email", "whatsapp", "demo", "follow_up", "order", "note"]).notNull(),
  contactId: bigint("contact_id", { mode: "number", unsigned: true }),
  leadId: bigint("lead_id", { mode: "number", unsigned: true }),
  description: text("description").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  duration: int("duration"), // minutes
  outcome: varchar("outcome", { length: 255 }),
  nextAction: varchar("next_action", { length: 255 }),
  followUpDate: timestamp("follow_up_date"),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tasks / Follow-ups
export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assignedTo: varchar("assigned_to", { length: 100 }),
  dueDate: timestamp("due_date"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "overdue"]).notNull().default("pending"),
  relatedType: varchar("related_type", { length: 50 }), // 'contact' or 'lead'
  relatedId: bigint("related_id", { mode: "number", unsigned: true }),
  relatedName: varchar("related_name", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Product Catalog
export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }),
  division: varchar("division", { length: 100 }),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  specifications: text("specifications"),
  indications: json("indications").default("[]"),
  price: int("price").default(0),
  status: mysqlEnum("status", ["active", "discontinued", "coming_soon"]).default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Scraping jobs queue
export const scrapingJobs = mysqlTable("scraping_jobs", {
  id: serial("id").primaryKey(),
  target: varchar("target", { length: 100 }).notNull(), // 'justdial', 'practo', etc.
  city: varchar("city", { length: 100 }),
  specialty: varchar("specialty", { length: 100 }),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending"),
  recordsFound: int("records_found").default(0),
  recordsAdded: int("records_added").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
