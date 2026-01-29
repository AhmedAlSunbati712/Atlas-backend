import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import http from "http";


export const app = buildApp();
export const server = http.createServer(app);

server.listen(env.PORT, env.HOST, () => {
  console.log(`Server running at http://${env.HOST}:${env.PORT}`);
});


