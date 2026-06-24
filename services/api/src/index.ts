import fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMemberRoutes } from "./routes/members.js";
import { registerAllowedCallRoutes } from "./routes/allowed-calls.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { registerChildRoutes } from "./routes/child.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerFamilyRoutes } from "./routes/families.js";

const server = fastify({ logger: true });

registerHealthRoutes(server);
registerAuthRoutes(server);
registerFamilyRoutes(server);
registerMemberRoutes(server);
registerAllowedCallRoutes(server);
registerPairingRoutes(server);
registerChildRoutes(server);
registerAdminRoutes(server);

const port = Number(process.env.PORT ?? "3001");

server.listen({ port, host: "0.0.0.0" }).then(() => {
  server.log.info(`API listening on http://0.0.0.0:${port}`);
});
