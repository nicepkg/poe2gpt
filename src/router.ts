import express from "express";
import {
  CompletionRequest,
  CompletionResponse,
  CompletionSSEResponse,
  Message,
} from "./types";
import { config, models } from "./config.js";
import { Client, getClient } from "./poe";
import { logger, randStringRunes } from "./utils";

const router = express.Router();

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authorization = req.headers.authorization;
  const token = authorization?.replace("Bearer ", "");
  if (
    config.accessTokens.length &&
    !config.accessTokens.includes(token || "")
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function setCORS(res: express.Response) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Max-Age", "86400");
  res.header("Content-Type", "application/json");
}

router.get(["/models", "/v1/models"], authMiddleware, (req, res) => {
  setCORS(res);
  res.json(models);
});

router.post(
  ["/chat/completions", "/v1/chat/completions"],
  authMiddleware,
  async (req, res) => {
    const completionRequest: CompletionRequest = req.body;

    for (const msg of completionRequest.messages) {
      if (
        msg.role !== "system" &&
        msg.role !== "user" &&
        msg.role !== "assistant"
      ) {
        res.status(400).json(`role of message validation failed: ${msg.role}`);
        return;
      }
    }

    try {
      const client = await getClient();
      if (completionRequest.stream) {
        logger.info("stream using client: " + client.token);
        await stream(res, completionRequest, client);
      } else {
        logger.info("ask using client: " + client.token);
        await ask(res, completionRequest, client);
      }
      client.release();
    } catch (err) {
      res.status(500).json((err as Error).message);
    }
  }
);

router.options(["/chat/completions", "/v1/chat/completions"], (req, res) => {
  setCORS(res);
  res.status(200).json("");
});

async function stream(
  res: express.Response,
  req: CompletionRequest,
  client: Client
) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const conversationID = "chatcmpl-" + randStringRunes(29);

  const createSSEResponse = (content: string, haveRole: boolean) => {
    const done = content === "[DONE]";
    let finishReason: string | null = null;
    const delta: { [key: string]: string } = {};
    if (done) {
      finishReason = "stop";
    } else if (haveRole) {
      delta["role"] = "assistant";
    } else {
      delta["content"] = content;
    }
    const data: CompletionSSEResponse = {
      choices: [
        {
          index: 0,
          delta: delta,
          finish_reason: finishReason,
        },
      ],
      created: Math.floor(Date.now() / 1000),
      id: conversationID,
      model: req.model,
      object: "chat.completion.chunk",
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (done) {
      res.write("data: [DONE]\n\n");
    }
  };

  createSSEResponse("", true);

  const timeout = setTimeout(() => {
    res.write(`event: error\ndata: timeout\n\n`);
    res.end();
  }, config.timeout * 1000);

  try {
    for await (const chunk of await client.stream(req.messages, req.model)) {
      clearTimeout(timeout);
      createSSEResponse(chunk, false);
      if (chunk === "[DONE]") break;
    }
  } catch (err) {
    logger.error(err);
    res.write(`event: error\ndata: ${(err as Error).message}\n\n`);
  } finally {
    clearTimeout(timeout);
    res.end();
  }
}

async function ask(
  res: express.Response,
  req: CompletionRequest,
  client: Client
) {
  try {
    const message = await client.ask(req.messages, req.model);
    const response: CompletionResponse = {
      id: "chatcmpl-" + randStringRunes(29),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      choices: [
        {
          index: 0,
          message: message,
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
    res.json(response);
  } catch (err) {
    res.status(500).json((err as Error).message);
  }
}

export { router };
