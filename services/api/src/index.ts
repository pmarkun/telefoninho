import fastify from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMemberRoutes } from "./routes/members.js";
import { registerAllowedCallRoutes } from "./routes/allowed-calls.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { registerChildRoutes } from "./routes/child.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerFamilyRoutes } from "./routes/families.js";
import { registerContactInviteRoutes } from "./routes/contact-invites.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerAccessRoutes } from "./routes/access.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerWebSecurity, webOrigins } from "./web-security.js";
import { deliverOutbox } from "./email.js";
import { reconcileAsterisk } from "./asterisk-worker.js";

if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "change-me-dev")) throw new Error("JWT_SECRET de produção precisa ser configurado.");
const server = fastify({ logger: true, trustProxy: 1 });

await server.register(cors, { origin: webOrigins() });
registerWebSecurity(server);

registerHealthRoutes(server);
registerAuthRoutes(server);
registerFamilyRoutes(server);
registerMemberRoutes(server);
registerAllowedCallRoutes(server);
registerPairingRoutes(server);
registerContactInviteRoutes(server);
registerChildRoutes(server);
registerMessageRoutes(server);
registerAdminRoutes(server);
registerAccessRoutes(server);
registerOnboardingRoutes(server);

const mailTimer = setInterval(() => { void deliverOutbox().catch(() => server.log.error("Falha na fila de e-mails")); }, 30000);
const phoneTimer = setInterval(() => { void reconcileAsterisk().catch(() => server.log.error("Falha ao preparar telefonia")); }, 10000);
mailTimer.unref();
phoneTimer.unref();
server.addHook("onClose", async () => { clearInterval(mailTimer); clearInterval(phoneTimer); });

const port = Number(process.env.PORT ?? "3001");

server.listen({ port, host: "0.0.0.0" }).then(() => {
  server.log.info(`API listening on http://0.0.0.0:${port}`);
});
