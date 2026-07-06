import { createRouter, publicQuery } from "./middleware";
import { contactRouter } from "./routers/contact";
import { leadRouter } from "./routers/lead";
import { activityRouter } from "./routers/activity";
import { taskRouter } from "./routers/task";
import { productRouter } from "./routers/product";
import { scraperRouter } from "./routers/scraper";
import { importRouter } from "./routers/import";
import { enrichmentRouter } from "./routers/enrichment";
import { dashboardRouter } from "./routers/dashboard";
import { campaignRouter } from "./routers/campaign";
import { smartEnrichmentRouter } from "./routers/smart-enrichment";
import { authRouter } from "./routers/auth";
import { onlineEnrichmentRouter } from "./routers/online-enrichment";
import { autoEnrichmentRouter } from "./routers/auto-enrichment";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  
  // Master CRM routers
  contact: contactRouter,
  lead: leadRouter,
  activity: activityRouter,
  task: taskRouter,
  product: productRouter,
  scraper: scraperRouter,
  import: importRouter,
  enrichment: enrichmentRouter,
  dashboard: dashboardRouter,
  campaign: campaignRouter,
  smartEnrichment: smartEnrichmentRouter,
  auth: authRouter,
  onlineEnrichment: onlineEnrichmentRouter,
  autoEnrichment: autoEnrichmentRouter,
});

export type AppRouter = typeof appRouter;
