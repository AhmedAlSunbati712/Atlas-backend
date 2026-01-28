import { buildApp } from "./app.js";
import { env } from "./config/env.js";

function main() {
  const app = buildApp();

  app.listen(env.PORT, env.HOST, () => {
    console.log(`Server running at http://${env.HOST}:${env.PORT}`);
  });
}

main();
