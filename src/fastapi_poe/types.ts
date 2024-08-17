import { Request } from "express";

export type Optional<T> = T | null | undefined;
export type BinaryIO = Buffer | Uint8Array;
export type Identifier = string;
export type FeedbackType = "like" | "dislike";
export type ContentType = "text/markdown" | "text/plain";
export type ErrorType = "user_message_too_long";

export interface ServerSentEvent {
  data: string;
  event: string;
}

export type ResponseBody = Record<string, any>;

/**
 * Feedback for a message as used in the Poe protocol.
 */
export class MessageFeedback {
  type!: FeedbackType;
  reason?: string;
}

/**
 * Attachment included in a protocol message.
 */
export class Attachment {
  url!: string;
  content_type!: string;
  name!: string;
  parsed_content?: string;
}

/**
 * A message as used in the Poe protocol.
 */
export class ProtocolMessage {
  role!: "system" | "user" | "bot";
  sender_id?: string;
  content!: string;
  content_type?: ContentType = "text/markdown";
  timestamp?: number = 0;
  message_id?: string = "";
  feedback?: MessageFeedback[] = [];
  attachments?: Attachment[] = [];
}

export class RequestContext {
  http_request!: Request;
}

/**
 * Common data for all requests.
 */
export class BaseRequest {
  version!: string;
  type!: "query" | "settings" | "report_feedback" | "report_error";
}

/**
 * Request parameters for a query request.
 */
export class QueryRequest extends BaseRequest {
  query!: ProtocolMessage[];
  user_id!: Identifier;
  conversation_id!: Identifier;
  message_id!: Identifier;
  metadata?: Identifier = "";
  api_key?: string = "<missing>";
  access_key?: string = "<missing>";
  temperature: number = 0.7;
  skip_system_prompt: boolean = false;
  logit_bias: Record<string, number> = {};
  stop_sequences: string[] = [];
  language_code?: string = "en";
  bot_query_id?: Identifier = "";
}

/**
 * Request parameters for a settings request. Currently, this contains no fields but this
 * might get updated in the future.
 */
export class SettingsRequest extends BaseRequest {}

/**
 * Request parameters for a report_feedback request.
 */
export class ReportFeedbackRequest extends BaseRequest {
  message_id!: Identifier;
  user_id!: Identifier;
  conversation_id!: Identifier;
  feedback_type!: FeedbackType;
}

/**
 * Request parameters for a report_error request.
 */
export class ReportErrorRequest extends BaseRequest {
  message!: string;
  metadata!: Record<string, any>;
}

/**
 * An object representing your bot's response to a settings object.
 */
export class SettingsResponse {
  context_clear_window_secs?: number; // deprecated
  allow_user_context_clear?: boolean; // deprecated
  server_bot_dependencies: Record<string, number> = {};
  allow_attachments?: boolean;
  introduction_message?: string;
  expand_text_attachments?: boolean;
  enable_image_comprehension?: boolean;
  enforce_author_role_alternation?: boolean;
  enable_multi_bot_chat_prompting?: boolean;
}

export class AttachmentUploadResponse {
  inline_ref?: string;
  attachment_url?: string;

  constructor(options: AttachmentUploadResponse) {
    Object.assign(this, options);
  }
}

/**
 * Representation of a (possibly partial) response from a bot. Yield this in
 * `PoeBot.get_response` or `PoeBot.get_response_with_context` to communicate your response to Poe.
 */
export class PartialResponse {
  text!: string;
  data?: Record<string, any>;
  raw_response?: any;
  full_prompt?: string;
  request_id?: string;
  is_suggested_reply: boolean = false;
  is_replace_response: boolean = false;
}

/**
 * Similar to `PartialResponse`. Yield this to communicate errors from your bot.
 */
export class ErrorResponse extends PartialResponse {
  allow_retry: boolean = false;
  error_type?: ErrorType;
}

/**
 * Similar to `Partial Response`. Yield this to communicate `meta` events from server bots.
 */
export class MetaResponse extends PartialResponse {
  linkify: boolean = true; // deprecated
  suggested_replies: boolean = true;
  content_type: ContentType = "text/markdown";
  refetch_settings: boolean = false;
}

/**
 * An object representing a tool definition used for OpenAI function calling.
 */
export class ToolDefinition {
  type!: string;
  function!: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * An object representing a tool call. This is returned as a response by the model when using
 * OpenAI function calling.
 */
export class ToolCallDefinition {
  id!: string;
  type!: string;
  function!: {
    name: string;
    arguments: string;
  };
}

/**
 * An object representing a function result. This is passed to the model in the last step
 * when using OpenAI function calling.
 */
export class ToolResultDefinition {
  role!: string;
  name!: string;
  tool_call_id!: string;
  content!: string;
}
