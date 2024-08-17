import { ProtocolMessage, QueryRequest } from "./fastapi_poe/types";
import { get_bot_response, get_final_response } from "./fastapi_poe/client";
import { logger } from "./utils";
import { Message } from "./types";
import { config } from "./config.js";

const client_dict: { [key: string]: string } = {};

const bot_names = new Set([
  "Assistant",
  "ChatGPT-16k",
  "GPT-4",
  "GPT-4o",
  "GPT-4o-Mini",
  "GPT-4-128k",
  "Claude-3-Opus",
  "Claude-3.5-Sonnet",
  "Claude-3-Sonnet",
  "Claude-3-Haiku",
  "Llama-3.1-405B-T",
  "Llama-3.1-405B-FW-128k",
  "Llama-3.1-70B-T",
  "Llama-3.1-70B-FW-128k",
  "Llama-3-70b-Groq",
  "Gemini-1.5-Pro",
  "Gemini-1.5-Pro-128k",
  "Gemini-1.5-Pro-1M",
  "DALL-E-3",
  "StableDiffusionXL",
]);

async function get_responses(
  api_key: string,
  prompt: string,
  bot: string
): Promise<string> {
  if (bot_names.has(bot)) {
    const message: ProtocolMessage = { role: "user", content: prompt };

    const query: QueryRequest = {
      query: [message],
      user_id: "",
      conversation_id: "",
      message_id: "",
      version: "1.0",
      type: "query",
      temperature: 0.7,
      skip_system_prompt: false,
      logit_bias: {},
      stop_sequences: [],
    };
    return await get_final_response(query, bot, api_key);
  } else {
    return "Not supported by this Model";
  }
}

async function* stream_get_responses(
  api_key: string,
  prompt: string,
  bot: string
): AsyncGenerator<string> {
  if (bot_names.has(bot)) {
    const message: ProtocolMessage = { role: "user", content: prompt };
    try {
      for await (const partial of get_bot_response([message], bot, api_key)) {
        yield partial.text;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "GeneratorExit") {
        return;
      }
      throw error;
    }
  } else {
    yield "Not supported by this Model";
  }
}

export async function add_token(token: string): Promise<string> {
  if (!(token in client_dict)) {
    try {
      const ret = await get_responses(token, 'Please return "OK"', "Assistant");
      if (ret === "OK") {
        client_dict[token] = token;
        return "ok";
      } else {
        return "failed";
      }
    } catch (exception) {
      logger.info("Failed to connect to poe due to " + String(exception));
      return "failed: " + String(exception);
    }
  } else {
    return "exist";
  }
}

export async function ask(
  token: string,
  bot: string,
  content: string
): Promise<string> {
  await add_token(token);
  try {
    return await get_responses(token, content, bot);
  } catch (e) {
    const errmsg = `An exception of type ${
      e instanceof Error ? e.name : "Unknown"
    } occurred. Arguments: ${e instanceof Error ? e.message : String(e)}`;
    logger.info(errmsg);
    return JSON.stringify({ status: 400, content: { message: errmsg } });
  }
}

export async function* stream(
  token: string,
  bot: string,
  content: string
): AsyncGenerator<string> {
  await add_token(token);
  try {
    yield* stream_get_responses(token, content, bot);
  } catch (e) {
    const errmsg = `An exception of type ${
      e instanceof Error ? e.name : "Unknown"
    } occurred. Arguments: ${e instanceof Error ? e.message : String(e)}`;
    logger.info(errmsg);
    yield errmsg;
  }
}

export class Client {
  token: string;
  usage: Date[];
  lock: boolean;

  constructor(token: string) {
    this.token = token;
    this.usage = [];
    this.lock = false;
  }

  getContentToSend(messages: Message[]): string {
    const leadingMap: { [key: string]: string } = {
      system: "Instructions",
      user: "User",
      assistant: "Assistant",
    };
    let content = "";
    let simulateRoles: boolean;
    switch (config.simulateRoles) {
      case 0:
        simulateRoles = false;
        break;
      case 1:
        simulateRoles = true;
        break;
      case 2:
        if (
          (messages.length === 1 && messages[0]?.role === "user") ||
          (messages.length === 1 && messages[0]?.role === "system") ||
          (messages.length === 2 &&
            messages[0]?.role === "system" &&
            messages[1]?.role === "user")
        ) {
          simulateRoles = false;
        } else {
          simulateRoles = true;
        }
        break;
      default:
        simulateRoles = false;
    }
    for (const message of messages) {
      if (simulateRoles) {
        content += `||>${leadingMap[message.role]}:\n${message.content}\n`;
      } else {
        content += `${message.content}\n`;
      }
    }
    if (simulateRoles) {
      content += "||>Assistant:\n";
    }
    logger.debug("Generated content to send: " + content);
    return content;
  }

  async *stream(messages: Message[], model: string): AsyncGenerator<string> {
    const content = this.getContentToSend(messages);

    const bot = config.bot[model] || "capybara";
    logger.info("Stream using bot", bot);

    return yield* stream(this.token, bot, content);
  }

  async ask(messages: Message[], model: string): Promise<Message> {
    const content = this.getContentToSend(messages);
    const bot = config.bot[model] || "capybara";
    logger.info("Ask using bot", bot);
    const answer = await ask(this.token, bot, content);

    return {
      role: "assistant",
      content: answer,
      name: "",
    };
  }

  release(): void {
    this.lock = false;
  }
}

const clients: Client[] = [];
let clientIx = 0;

export async function setupClient(): Promise<void> {
  for (const token of config.tokens) {
    try {
      const client = await registerClient(token);
      clients.push(client);
    } catch (err) {
      logger.error(err);
    }
  }
}

async function registerClient(token: string): Promise<Client> {
  // logger.info("registering client: " + token);
  return new Client(token);
}

export async function getClient(): Promise<Client> {
  if (clients.length === 0) {
    throw new Error("no client is available");
  }
  for (let i = 0; i < clients.length; i++) {
    const client = clients[clientIx % clients.length];
    clientIx++;

    if (!client) continue;

    if (client.lock) {
      continue;
    }
    if (client.usage.length > 0) {
      const lastUsage = client.usage[client.usage.length - 1];
      if (
        lastUsage &&
        Date.now() - lastUsage.getTime() < config.coolDown * 1000
      ) {
        continue;
      }
    }
    if (client.usage.length < config.rateLimit) {
      client.usage.push(new Date());
      client.lock = true;
      return client;
    } else {
      const usage = client.usage[client.usage.length - config.rateLimit];
      if (usage && Date.now() - usage.getTime() <= 60 * 1000) {
        continue;
      }
      client.usage.push(new Date());
      client.lock = true;
      return client;
    }
  }
  throw new Error("no available client");
}
