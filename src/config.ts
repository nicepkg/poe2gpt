import fs from "fs";
import toml from "toml";

// robot name mapping interface
export interface BotNameMap {
  [key: string]: string;
}

// env config
export interface Config {
  port: number;
  // poe api key https://poe.com/api_key
  tokens: string[];
  accessTokens: string[];
  bot: { [key: string]: string };
  simulateRoles: number;
  rateLimit: number;
  coolDown: number;
  timeout: number;
}

interface ModelDef {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface Models {
  object: string;
  data: ModelDef[];
}

export let config: Config;
export let models: Models;

export function setupConfig(initConfig?: Partial<Config>): void {
  const configFile = fs.readFileSync("config.toml", "utf-8");
  config = toml.parse(configFile) as Config;

  if (initConfig) {
    config = { ...config, ...initConfig };
  }

  config.port ??= 3700;
  config.rateLimit ??= 60;
  config.coolDown ??= 3;
  config.timeout ??= 180;
  config.simulateRoles ??= 2;

  if (!config?.accessTokens?.length) {
    config.accessTokens = [];
  }

  if (!config.bot) {
    config.bot = {
      "gpt-3.5-turbo-16k": "ChatGPT-16k",
      "gpt-3.5-turbo": "ChatGPT-16k",
      "gpt-4": "GPT-4",
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o-Mini",
      "gpt-4-vision-preview": "GPT-4-128k",
      "gpt-4-turbo-preview": "Claude-3-Opus",
      "Llama-3.1-405B-T": "Llama-3.1-405B-T",
      "Llama-3.1-405B-FW-128k": "Llama-3.1-405B-FW-128k",
      "Llama-3.1-70B-T": "Llama-3.1-70B-T",
      "Llama-3.1-70B-FW-128k": "Llama-3.1-70B-FW-128k",
      "Claude-3.5-Sonnet": "Claude-3.5-Sonnet",
      "Claude-3-Sonnet": "Claude-3-Sonnet",
      "Claude-3-Haiku": "Claude-3-Haiku",
      "Llama-3-70b-Groq": "Llama-3-70b-Groq",
      "Gemini-1.5-Pro": "Gemini-1.5-Pro",
      "Gemini-1.5-Pro-128k": "Gemini-1.5-Pro-128k",
      "Gemini-1.5-Pro-1M": "Gemini-1.5-Pro-1M",
      "DALL-E-3": "DALL-E-3",
      StableDiffusionXL: "StableDiffusionXL",
    };
  }

  models = {
    object: "",
    data: Object.keys(config.bot).map((key) => ({
      id: key,
      object: "",
      created: 0,
      owned_by: "",
    })),
  };
}
