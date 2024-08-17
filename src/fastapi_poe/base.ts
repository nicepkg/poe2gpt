import express, { Request, Response, NextFunction } from "express";
import argparse from "argparse";
import {
  IMAGE_VISION_ATTACHMENT_TEMPLATE,
  TEXT_ATTACHMENT_TEMPLATE,
  URL_ATTACHMENT_TEMPLATE,
} from "./templates";
import {
  BinaryIO,
  Optional,
  ResponseBody,
  ServerSentEvent,
  AttachmentUploadResponse,
  ContentType,
  ErrorResponse,
  Identifier,
  MetaResponse,
  PartialResponse,
  ProtocolMessage,
  QueryRequest,
  ReportErrorRequest,
  ReportFeedbackRequest,
  RequestContext,
  SettingsRequest,
  SettingsResponse,
} from "./types";
import { logger } from "./logger";

const isServerSentEvent = (event: any): event is ServerSentEvent => {
  return typeof event === "object" && "data" in event && "event" in event;
};

class InvalidParameterError extends Error {}

class AttachmentUploadError extends Error {}

export class LoggingMiddleware {
  async set_body(request: Request): Promise<void> {
    const receive_ = await request.body;

    async function receive(): Promise<any> {
      return receive_;
    }

    request.body = receive;
  }

  async dispatch(
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    logger.info(`Request: ${request.method} ${request.url}`);
    try {
      await this.set_body(request);
      const body = await request.body;
      logger.debug(`Request body: ${JSON.stringify(body)}`);
    } catch (error) {
      logger.error("Request body: Unable to parse JSON");
    }

    next();

    logger.info(`Response status: ${response.statusCode}`);
    const json = await response.json();

    try {
      if (json) {
        logger.debug(`Response body: ${JSON.stringify(json)}`);
      }
    } catch (error) {
      logger.error("Response body: Unable to parse JSON");
    }
  }
}

export async function http_exception_handler(
  error: Error,
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  logger.error(error);
  response.status(500).send("Internal server error");
}

export class PoeBot {
  path: string;
  access_key: Optional<string>;
  should_insert_attachment_messages: boolean;
  concat_attachments_to_message: boolean;
  _pending_file_attachment_tasks: Record<
    Identifier,
    Set<Promise<AttachmentUploadResponse>>
  >;

  constructor(
    path: string = "/",
    access_key: Optional<string> = null,
    should_insert_attachment_messages: boolean = true,
    concat_attachments_to_message: boolean = false
  ) {
    this.path = path;
    this.access_key = access_key;
    this.should_insert_attachment_messages = should_insert_attachment_messages;
    this.concat_attachments_to_message = concat_attachments_to_message;
    this._pending_file_attachment_tasks = {};
  }

  *get_response(
    request: QueryRequest
  ): Generator<PartialResponse | ServerSentEvent> {
    yield PoeBot.text_event("hello");
  }

  async *get_response_with_context(
    request: QueryRequest,
    context: RequestContext
  ): AsyncGenerator<PartialResponse | ServerSentEvent> {
    for await (const event of this.get_response(request)) {
      yield event;
    }
  }

  async get_settings(setting: SettingsRequest): Promise<SettingsResponse> {
    return new SettingsResponse();
  }

  async get_settings_with_context(
    setting: SettingsRequest,
    context: RequestContext
  ): Promise<SettingsResponse> {
    const settings = await this.get_settings(setting);
    return settings;
  }

  async on_feedback(feedback_request: ReportFeedbackRequest): Promise<void> {}

  async on_feedback_with_context(
    feedback_request: ReportFeedbackRequest,
    context: RequestContext
  ): Promise<void> {
    await this.on_feedback(feedback_request);
  }

  async on_error(error_request: ReportErrorRequest): Promise<void> {
    logger.error(`Error from Poe server: ${error_request}`);
  }

  async on_error_with_context(
    error_request: ReportErrorRequest,
    context: RequestContext
  ): Promise<void> {
    await this.on_error(error_request);
  }

  async post_message_attachment(
    message_id: Identifier,
    download_url?: string,
    file_data?: BinaryIO,
    filename?: string,
    content_type?: string,
    is_inline: boolean = false
  ): Promise<AttachmentUploadResponse> {
    if (message_id === null) {
      throw new InvalidParameterError("message_id parameter is required");
    }

    const task = this._make_file_attachment_request(
      message_id,
      download_url,
      file_data,
      filename,
      content_type,
      is_inline
    );

    let pending_tasks_for_message =
      this._pending_file_attachment_tasks[message_id];
    if (!pending_tasks_for_message) {
      pending_tasks_for_message = new Set();
      this._pending_file_attachment_tasks[message_id] =
        pending_tasks_for_message;
    }
    pending_tasks_for_message.add(task);

    try {
      return await task;
    } finally {
      pending_tasks_for_message.delete(task);
    }
  }

  async _make_file_attachment_request(
    message_id: Identifier,
    download_url?: string,
    file_data?: BinaryIO,
    filename?: string,
    content_type?: string,
    is_inline: boolean = false
  ): Promise<AttachmentUploadResponse> {
    let attachment_access_key: string;
    if (this.access_key) {
      attachment_access_key = this.access_key;
    } else {
      throw new InvalidParameterError(
        "access_key parameter is required if bot is not provided with an access_key when make_app is called."
      );
    }

    const url = "https://www.quora.com/poe_api/file_attachment_3RD_PARTY_POST";

    try {
      const headers = { Authorization: `${attachment_access_key}` };
      let request: RequestInit;

      if (download_url) {
        if (file_data || filename) {
          throw new InvalidParameterError(
            "Cannot provide filename or file_data if download_url is provided."
          );
        }
        const data = {
          message_id: message_id,
          is_inline: is_inline,
          download_url: download_url,
        };

        request = {
          method: "POST",
          body: JSON.stringify(data),
          headers: headers,
        };
      } else if (file_data && filename) {
        const data = { message_id: message_id, is_inline: is_inline };
        const formData = new FormData();
        formData.append("file", file_data, filename);
        for (const [key, value] of Object.entries(data)) {
          formData.append(key, value);
        }
        request = {
          method: "POST",
          body: formData,
          headers,
        };
      } else {
        throw new InvalidParameterError(
          "Must provide either download_url or file_data and filename."
        );
      }

      const response = await fetch(url, request);

      if (response.status !== 200) {
        const errorText = await response.text();
        throw new AttachmentUploadError(
          `${response.status} ${response.statusText}: ${errorText}`
        );
      }

      const responseData = (await response.json()) as AttachmentUploadResponse;
      return new AttachmentUploadResponse({
        inline_ref: responseData.inline_ref,
        attachment_url: responseData.attachment_url,
      });
    } catch (error) {
      logger.error("An HTTP error occurred when attempting to attach file");
      throw error;
    }
  }

  async _process_pending_attachment_requests(
    message_id: Identifier
  ): Promise<void> {
    try {
      await Promise.all(
        Array.from(this._pending_file_attachment_tasks[message_id] || [])
      );
    } catch (error) {
      logger.error("Error processing pending attachment requests");
      throw error;
    }
  }

  concat_attachment_content_to_message_body(
    query_request: QueryRequest
  ): QueryRequest {
    const last_message = query_request.query[query_request.query.length - 1];
    let concatenated_content = last_message?.content;
    const attachments = last_message?.attachments || [];

    for (const attachment of attachments) {
      if (attachment.parsed_content) {
        if (attachment.content_type === "text/html") {
          const url_attachment_content = URL_ATTACHMENT_TEMPLATE.replace(
            "{attachment_name}",
            attachment.name
          ).replace("{content}", attachment.parsed_content);
          concatenated_content = `${concatenated_content}\n\n${url_attachment_content}`;
        } else if (attachment.content_type.includes("text")) {
          const text_attachment_content = TEXT_ATTACHMENT_TEMPLATE.replace(
            "{attachment_name}",
            attachment.name
          ).replace("{attachment_parsed_content}", attachment.parsed_content);
          concatenated_content = `${concatenated_content}\n\n${text_attachment_content}`;
        } else if (attachment.content_type.includes("image")) {
          const [parsed_content_filename = "", parsed_content_text = ""] =
            attachment.parsed_content.split("***");
          const image_attachment_content =
            IMAGE_VISION_ATTACHMENT_TEMPLATE.replace(
              "{filename}",
              parsed_content_filename
            ).replace("{parsed_image_description}", parsed_content_text);
          concatenated_content = `${concatenated_content}\n\n${image_attachment_content}`;
        }
      }
    }

    const modified_last_message = {
      ...last_message,
      content: concatenated_content || "",
      role: last_message?.role || "user",
    };
    const modified_query = {
      ...query_request,
      query: [...query_request.query.slice(0, -1), modified_last_message],
    };

    return modified_query;
  }

  insert_attachment_messages(query_request: QueryRequest): QueryRequest {
    const last_message = query_request.query[query_request.query.length - 1];
    const text_attachment_messages: ProtocolMessage[] = [];
    const image_attachment_messages: ProtocolMessage[] = [];
    const attachments = last_message?.attachments || [];

    for (const attachment of attachments) {
      if (attachment.parsed_content) {
        if (attachment.content_type === "text/html") {
          const url_attachment_content = URL_ATTACHMENT_TEMPLATE.replace(
            "{attachment_name}",
            attachment.name
          ).replace("{content}", attachment.parsed_content);
          text_attachment_messages.push({
            role: "user",
            content: url_attachment_content,
          });
        } else if (attachment.content_type.includes("text")) {
          const text_attachment_content = TEXT_ATTACHMENT_TEMPLATE.replace(
            "{attachment_name}",
            attachment.name
          ).replace("{attachment_parsed_content}", attachment.parsed_content);
          text_attachment_messages.push({
            role: "user",
            content: text_attachment_content,
          });
        } else if (attachment.content_type.includes("image")) {
          const [parsed_content_filename = "", parsed_content_text = ""] =
            attachment.parsed_content.split("***");
          const image_attachment_content =
            IMAGE_VISION_ATTACHMENT_TEMPLATE.replace(
              "{filename}",
              parsed_content_filename
            ).replace("{parsed_image_description}", parsed_content_text);
          image_attachment_messages.push({
            role: "user",
            content: image_attachment_content,
          });
        }
      }
    }

    const modified_query = {
      ...query_request,
      query: [
        ...query_request.query.slice(0, -1),
        ...text_attachment_messages,
        ...image_attachment_messages,
      ].concat(last_message ? [last_message] : []),
    };

    return modified_query;
  }

  make_prompt_author_role_alternated(
    protocol_messages: Array<ProtocolMessage>
  ): Array<ProtocolMessage> {
    const new_messages: ProtocolMessage[] = [];

    for (const protocol_message of protocol_messages) {
      if (
        new_messages.length &&
        protocol_message.role === new_messages[new_messages.length - 1]?.role
      ) {
        const prev_message = new_messages.pop()!;
        const new_content = `${prev_message.content}\n\n${protocol_message.content}`;

        const new_attachments: any[] = [];
        const added_attachment_urls = new Set();
        for (const attachment of [
          ...(protocol_message.attachments || []),
          ...(prev_message.attachments || []),
        ]) {
          if (!added_attachment_urls.has(attachment.url)) {
            added_attachment_urls.add(attachment.url);
            new_attachments.push(attachment);
          }
        }

        new_messages.push({
          ...prev_message,
          content: new_content,
          attachments: new_attachments,
        });
      } else {
        new_messages.push(protocol_message);
      }
    }

    return new_messages;
  }

  static text_event(text: string): ServerSentEvent {
    return {
      data: JSON.stringify({ text: text }),
      event: "text",
    };
  }

  static replace_response_event(text: string): ServerSentEvent {
    return {
      data: JSON.stringify({ text: text }),
      event: "replace_response",
    };
  }

  static done_event(): ServerSentEvent {
    return {
      data: "{}",
      event: "done",
    };
  }

  static suggested_reply_event(text: string): ServerSentEvent {
    return {
      data: JSON.stringify({ text: text }),
      event: "suggested_reply",
    };
  }

  static meta_event(
    content_type: ContentType = "text/markdown",
    refetch_settings: boolean = false,
    linkify: boolean = true,
    suggested_replies: boolean = false
  ): ServerSentEvent {
    return {
      data: JSON.stringify({
        content_type: content_type,
        refetch_settings: refetch_settings,
        linkify: linkify,
        suggested_replies: suggested_replies,
      }),
      event: "meta",
    };
  }

  static error_event(
    text?: string,
    raw_response?: any,
    allow_retry: boolean = true,
    error_type?: string
  ): ServerSentEvent {
    const data: Record<string, string | boolean> = { allow_retry: allow_retry };
    if (text !== undefined) {
      data.text = text;
    }
    if (raw_response !== undefined) {
      data.raw_response = raw_response.toString();
    }
    if (error_type !== undefined) {
      data.error_type = error_type;
    }
    return {
      data: JSON.stringify(data),
      event: "error",
    };
  }

  async handle_report_feedback(
    feedback_request: ReportFeedbackRequest,
    context: RequestContext
  ): Promise<ResponseBody> {
    await this.on_feedback_with_context(feedback_request, context);
    return {};
  }

  async handle_report_error(
    error_request: ReportErrorRequest,
    context: RequestContext
  ): Promise<ResponseBody> {
    await this.on_error_with_context(error_request, context);
    return {};
  }

  async handle_settings(
    settings_request: SettingsRequest,
    context: RequestContext
  ): Promise<ResponseBody> {
    const settings = await this.get_settings_with_context(
      settings_request,
      context
    );
    return { settings };
  }

  async *handle_query(
    request: QueryRequest,
    context: RequestContext
  ): AsyncIterable<ServerSentEvent> {
    try {
      if (this.should_insert_attachment_messages) {
        request = this.insert_attachment_messages(request);
      } else if (this.concat_attachments_to_message) {
        console.warn(
          "concat_attachments_to_message is deprecated. " +
            "Use should_insert_attachment_messages instead."
        );
        request = this.concat_attachment_content_to_message_body(request);
      }

      for await (const event of this.get_response_with_context(
        request,
        context
      )) {
        if (isServerSentEvent(event)) {
          yield event;
        } else if (event instanceof ErrorResponse) {
          yield PoeBot.error_event(
            event.text,
            event.raw_response,
            event.allow_retry,
            event.error_type
          );
        } else if (event instanceof MetaResponse) {
          yield PoeBot.meta_event(
            event.content_type,
            event.refetch_settings,
            event.linkify,
            event.suggested_replies
          );
        } else if (event.is_suggested_reply) {
          yield PoeBot.suggested_reply_event(event.text);
        } else if (event.is_replace_response) {
          yield PoeBot.replace_response_event(event.text);
        } else {
          yield PoeBot.text_event(event.text);
        }
      }
    } catch (e) {
      logger.error("Error responding to query");
      yield PoeBot.error_event(
        "The bot encountered an unexpected issue.",
        e,
        false
      );
    }

    try {
      await this._process_pending_attachment_requests(request.message_id);
    } catch (e) {
      logger.error("Error processing pending attachment requests");
      yield PoeBot.error_event(
        "The bot encountered an unexpected issue.",
        e,
        false
      );
    }

    yield PoeBot.done_event();
  }
}

function _find_access_key(
  access_key: string,
  api_key: string
): Optional<string> {
  if (access_key) {
    return access_key;
  }

  const environ_poe_access_key = process.env.POE_ACCESS_KEY;
  if (environ_poe_access_key) {
    return environ_poe_access_key;
  }

  if (api_key) {
    console.warn(
      "usage of api_key is deprecated, pass your key using access_key instead"
    );
    return api_key;
  }

  const environ_poe_api_key = process.env.POE_API_KEY;
  if (environ_poe_api_key) {
    console.warn(
      "usage of POE_API_KEY is deprecated, pass your key using POE_ACCESS_KEY instead"
    );
    return environ_poe_api_key;
  }

  return null;
}

function _verify_access_key(
  access_key: string,
  api_key: string,
  allow_without_key: boolean = false
): Optional<string> {
  const _access_key = _find_access_key(access_key, api_key);
  if (!_access_key) {
    if (allow_without_key) {
      return null;
    }
    console.log(
      "Please provide an access key.\n" +
        "You can get a key from the create_bot page at: https://poe.com/create_bot?server=1\n" +
        "You can then pass the key using the access_key param to the run() or make_app() " +
        "functions, or by using the POE_ACCESS_KEY environment variable."
    );
    process.exit(1);
  }
  if (_access_key.length !== 32) {
    console.log("Invalid access key (should be 32 characters)");
    process.exit(1);
  }
  return _access_key;
}

function _add_routes_for_bot(app: express.Application, bot: PoeBot): void {
  async function index(req: Request, res: Response): Promise<void> {
    const url = "https://poe.com/create_bot?server=1";
    res.send(
      "<html><body><h1>Express Poe bot server</h1><p>Congratulations! Your server" +
        " is running. To connect it to Poe, create a bot at <a" +
        ` href="${url}">${url}</a>.</p></body></html>`
    );
  }

  function auth_user(req: Request, res: Response, next: NextFunction): void {
    if (bot.access_key === null) {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      authHeader.slice(7) !== bot.access_key
    ) {
      res.status(401).json({ detail: "Invalid access key" });
      return;
    }
    next();
  }

  async function poe_post(req: Request, res: Response): Promise<void> {
    const request_body = req.body;
    request_body.http_request = req;
    if (request_body.type === "query") {
      const eventStream = bot.handle_query(
        {
          ...request_body,
          access_key: bot.access_key || "<missing>",
          api_key: bot.access_key || "<missing>",
        },
        { http_request: req }
      );
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      for await (const event of eventStream) {
        res.write(`event: ${event.event}\ndata: ${event.data}\n\n`);
      }
      res.end();
    } else if (request_body.type === "settings") {
      const response = await bot.handle_settings(request_body, {
        http_request: req,
      });
      res.json(response);
    } else if (request_body.type === "report_feedback") {
      const response = await bot.handle_report_feedback(request_body, {
        http_request: req,
      });
      res.json(response);
    } else if (request_body.type === "report_error") {
      const response = await bot.handle_report_error(request_body, {
        http_request: req,
      });
      res.json(response);
    } else {
      res.status(501).json({ detail: "Unsupported request type" });
    }
  }

  app.get(bot.path, index);
  app.post(bot.path, auth_user, express.json(), poe_post);
}

export function make_app(
  bot: PoeBot | Array<PoeBot>,
  access_key: string = "",
  api_key: string = "",
  allow_without_key: boolean = false,
  app?: express.Application
): express.Application {
  if (!app) {
    app = express();
  }
  app.use(http_exception_handler);

  let bots: PoeBot[];
  if (bot instanceof PoeBot) {
    if (bot.access_key === null) {
      bot.access_key = _verify_access_key(
        access_key,
        api_key,
        allow_without_key
      );
    } else if (access_key) {
      throw new Error(
        "Cannot provide access_key if the bot object already has an access key"
      );
    } else if (api_key) {
      throw new Error(
        "Cannot provide api_key if the bot object already has an access key"
      );
    }
    bots = [bot];
  } else {
    if (access_key || api_key) {
      throw new Error(
        "When serving multiple bots, the access_key must be set on each bot"
      );
    }
    bots = bot;
  }

  // Ensure paths are unique
  const path_to_bots = new Map<string, PoeBot[]>();
  for (const bot of bots) {
    const existing = path_to_bots.get(bot.path) || [];
    path_to_bots.set(bot.path, [...existing, bot]);
  }
  for (const [path, bots_of_path] of path_to_bots.entries()) {
    if (bots_of_path.length > 1) {
      throw new Error(
        `Multiple bots are trying to use the same path: ${path}: ${bots_of_path}. ` +
          "Please use a different path for each bot."
      );
    }
  }

  for (const bot_obj of bots) {
    if (bot_obj.access_key === null && !allow_without_key) {
      throw new Error(`Missing access key on ${bot_obj}`);
    }
    _add_routes_for_bot(app, bot_obj);
  }

  // Uncomment this line to log requests and responses
  // app.use(new LoggingMiddleware().dispatch);

  return app;
}

export function run(
  bot: PoeBot | Array<PoeBot>,
  access_key: string = "",
  api_key: string = "",
  allow_without_key: boolean = false,
  app?: express.Application
): void {
  app = make_app(bot, access_key, api_key, allow_without_key, app);

  const parser = new argparse.ArgumentParser({
    description: "Express sample Poe bot server",
  });
  parser.add_argument("-p", "--port", { type: "int", default: 8080 });
  const args = parser.parse_args();
  const port = args.port;

  logger.info("Starting");
  app.listen(port, "0.0.0.0", () => {
    logger.info(`Server running on port ${port}`);
  });
}
