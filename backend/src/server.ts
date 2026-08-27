import { buildApp } from "./app.js";
import { getConfig } from "./config.js";

const config = getConfig();
const app = buildApp(config);

await app.listen({ host: config.host, port: config.port });

