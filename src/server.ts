import express from "express";
import { router } from "./router";
import { setupClient } from "./poe";
import { logger } from "./utils";
import { Config, config, setupConfig } from "./config";

export async function startServer(initConfig?: Partial<Config>) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  setupConfig(initConfig);
  await setupClient();

  app.use("/", router);

  const port = config.port || 3700;

  app.listen(port, () => {
    const modelNames = Object.keys(config.bot || {});
    logger.info(`
✨ Server is successfully running! ✨

OpenAI Base URL: http://localhost:${port}
OpenAI API Key: ${config.accessTokens || "sk-nicepkg"}
OpenAI Model: ${modelNames[0]}

ALL Models: ${modelNames.join(", ")}
`);
  });
}
