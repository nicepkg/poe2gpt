const PROTOCOL_VERSION = "1.0";
const MESSAGE_LENGTH_LIMIT = 10000;

const IDENTIFIER_LENGTH = 32;
const MAX_EVENT_COUNT = 1000;

type ErrorHandler = (error: Error, message: string) => void;

export class BotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotError";
  }
}

export class BotErrorNoRetry extends BotError {
  constructor(message: string) {
    super(message);
    this.name = "BotErrorNoRetry";
  }
}

export class InvalidBotSettings extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBotSettings";
  }
}

function safe_ellipsis(obj: any, limit: number): string {
  if (typeof obj !== "string") {
    obj = JSON.stringify(obj);
  }
  if (obj.length > limit) {
    obj = obj.slice(0, limit - 3) + "...";
  }
  return obj;
}

interface BotContext {
  endpoint: string;
  api_key: string | null;
  on_error: ErrorHandler | null;
}

class _BotContext implements BotContext {
  endpoint: string;
  api_key: string | null;
  on_error: ErrorHandler | null;

  constructor(
    endpoint: string,
    api_key: string | null = null,
    on_error: ErrorHandler | null = null
  ) {
    this.endpoint = endpoint;
    this.api_key = api_key;
    this.on_error = on_error;
  }

  get headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.api_key !== null) {
      headers["Authorization"] = `Bearer ${this.api_key}`;
    }
    return headers;
  }

  async report_error(
    message: string,
    metadata: Record<string, any> | null = null
  ): Promise<void> {
    if (this.on_error !== null) {
      const long_message = `Protocol bot error: ${message} with metadata ${metadata} for endpoint ${this.endpoint}`;
      this.on_error(new BotError(message), long_message);
    }
    await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        version: PROTOCOL_VERSION,
        type: "report_error",
        message: message,
        metadata: metadata || {},
      }),
    });
  }

  async report_feedback(
    message_id: string,
    user_id: string,
    conversation_id: string,
    feedback_type: string
  ): Promise<void> {
    await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        version: PROTOCOL_VERSION,
        type: "report_feedback",
        message_id: message_id,
        user_id: user_id,
        conversation_id: conversation_id,
        feedback_type: feedback_type,
      }),
    });
  }

  async fetch_settings(): Promise<any> {
    const resp = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ version: PROTOCOL_VERSION, type: "settings" }),
    });
    return resp.json();
  }

  async *perform_query_request(
    request: any,
    tools: any[] | null = null,
    tool_calls: any[] | null = null,
    tool_results: any[] | null = null
  ): AsyncGenerator<any, void, unknown> {
    let chunks: string[] = [];
    const message_id = request.message_id;
    let event_count = 0;
    let error_reported = false;
    const payload = { ...request };
    if (tools !== null) {
      payload.tools = tools.map((tool) => ({ ...tool }));
    }
    if (tool_calls !== null) {
      payload.tool_calls = tool_calls.map((tool_call) => ({ ...tool_call }));
    }
    if (tool_results !== null) {
      payload.tool_results = tool_results.map((tool_result) => ({
        ...tool_result,
      }));
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new BotError(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new BotError("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          event_count++;

          if (data === "[DONE]") {
            if (!chunks.length && !error_reported && !tools) {
              await this.report_error("Bot returned no text in response", {
                message_id: message_id,
              });
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const eventType = parsed.type || "text";

            switch (eventType) {
              case "text":
                chunks.push(parsed.text);
                yield {
                  text: parsed.text,
                  raw_response: { type: eventType, text: data },
                  full_prompt: JSON.stringify(request),
                };
                break;
              case "replace_response":
                chunks = [parsed.text];
                yield {
                  text: parsed.text,
                  raw_response: { type: eventType, text: data },
                  full_prompt: JSON.stringify(request),
                  is_replace_response: true,
                };
                break;
              case "suggested_reply":
                yield {
                  text: parsed.text,
                  raw_response: { type: eventType, text: data },
                  full_prompt: JSON.stringify(request),
                  is_suggested_reply: true,
                };
                break;
              case "error":
                if (parsed.allow_retry !== false) {
                  throw new BotError(data);
                } else {
                  throw new BotErrorNoRetry(data);
                }
              default:
                await this.report_error(
                  `Unknown event type: ${safe_ellipsis(eventType, 100)}`,
                  {
                    event_data: safe_ellipsis(data, 500),
                    message_id: message_id,
                  }
                );
                error_reported = true;
            }
          } catch (error) {
            if (error instanceof BotError || error instanceof BotErrorNoRetry) {
              throw error;
            }
            await this.report_error(`Error parsing event data: ${error}`, {
              event_data: safe_ellipsis(data, 500),
              message_id: message_id,
            });
            error_reported = true;
          }
        }
      }
    }

    if (!chunks.length && !error_reported && !tools) {
      await this.report_error("Bot returned no text in response", {
        message_id: message_id,
      });
    }
  }

  async _get_single_json_field(
    data: string,
    context: string,
    message_id: string,
    field: string = "text"
  ): Promise<string> {
    const data_dict = await this._load_json_dict(data, context, message_id);
    const text = data_dict[field];
    if (typeof text !== "string") {
      await this.report_error(
        `Expected string in '${field}' field for '${context}' event`,
        { data: data_dict, message_id: message_id }
      );
      throw new BotErrorNoRetry(`Expected string in '${context}' event`);
    }
    return text;
  }

  async _load_json_dict(
    data: string,
    context: string,
    message_id: string
  ): Promise<Record<string, any>> {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed !== "object" || parsed === null) {
        await this.report_error(`Expected JSON dict in ${context} event`, {
          data: data,
          message_id: message_id,
        });
        throw new BotError(`Expected JSON dict in ${context} event`);
      }
      return parsed;
    } catch (error) {
      await this.report_error(`Invalid JSON in ${context} event`, {
        data: data,
        message_id: message_id,
      });
      throw new BotErrorNoRetry(`Invalid JSON in ${context} event`);
    }
  }
}

function default_error_handler(error: Error, message: string): void {
  console.error("Error in Poe bot:", message, "\n", error);
}

export async function* stream_request(
  request: any,
  bot_name: string,
  api_key: string = "",
  tools: any[] | null = null,
  tool_executables: Function[] | null = null,
  access_key: string = "",
  access_key_deprecation_warning_stacklevel: number = 2,
  on_error: ErrorHandler = default_error_handler,
  num_tries: number = 2,
  retry_sleep_time: number = 0.5,
  base_url: string = "https://api.poe.com/bot/"
): AsyncGenerator<any, void, unknown> {
  let tool_calls = null;
  let tool_results = null;
  if (tools !== null) {
    tool_calls = await _get_tool_calls(
      request,
      bot_name,
      api_key,
      tools,
      access_key,
      access_key_deprecation_warning_stacklevel,
      on_error,
      num_tries,
      retry_sleep_time,
      base_url
    );
    tool_results = await _get_tool_results(tool_executables!, tool_calls);
  }

  yield* stream_request_base(
    request,
    bot_name,
    api_key,
    tools,
    tool_calls,
    tool_results,
    access_key,
    access_key_deprecation_warning_stacklevel,
    on_error,
    num_tries,
    retry_sleep_time,
    base_url
  );
}

async function _get_tool_results(
  tool_executables: Function[],
  tool_calls: any[]
): Promise<any[]> {
  const tool_executables_dict: Record<string, Function> = {};
  tool_executables.forEach((executable) => {
    tool_executables_dict[executable.name] = executable;
  });

  const tool_results = [];
  for (const tool_call of tool_calls) {
    const tool_call_id = tool_call.id;
    const name = tool_call.function.name;
    const arguments_ = JSON.parse(tool_call.function.arguments);
    const _func = tool_executables_dict[name]!;
    let content;
    if (_func.constructor.name === "AsyncFunction") {
      content = await _func(...arguments_);
    } else {
      content = _func(...arguments_);
    }
    tool_results.push({
      role: "tool",
      tool_call_id: tool_call_id,
      name: name,
      content: JSON.stringify(content),
    });
  }
  return tool_results;
}

async function _get_tool_calls(
  request: any,
  bot_name: string,
  api_key: string = "",
  tools: any[],
  access_key: string = "",
  access_key_deprecation_warning_stacklevel: number = 2,
  on_error: ErrorHandler = default_error_handler,
  num_tries: number = 2,
  retry_sleep_time: number = 0.5,
  base_url: string = "https://api.poe.com/bot/"
): Promise<any[]> {
  const tool_call_object_dict: Record<number, any> = {};
  for await (const message of stream_request_base(
    request,
    bot_name,
    api_key,
    tools,
    null,
    null,
    access_key,
    access_key_deprecation_warning_stacklevel,
    on_error,
    num_tries,
    retry_sleep_time,
    base_url
  )) {
    if (message.data !== null) {
      const finish_reason = message.data.choices[0].finish_reason;
      if (finish_reason === null) {
        try {
          const tool_call_object = message.data.choices[0].delta.tool_calls[0];
          const index = tool_call_object.index;
          delete tool_call_object.index;
          if (!(index in tool_call_object_dict)) {
            tool_call_object_dict[index] = tool_call_object;
          } else {
            const function_info = tool_call_object.function;
            tool_call_object_dict[index].function.arguments +=
              function_info.arguments;
          }
        } catch (error) {
          continue;
        }
      }
    }
  }
  const tool_call_object_list = Object.entries(tool_call_object_dict)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => value);
  return tool_call_object_list.map((tool_call_object) => ({
    ...tool_call_object,
  }));
}

export async function* stream_request_base(
  request: any,
  bot_name: string,
  api_key: string = "",
  tools: any[] | null = null,
  tool_calls: any[] | null = null,
  tool_results: any[] | null = null,
  access_key: string = "",
  access_key_deprecation_warning_stacklevel: number = 2,
  on_error: ErrorHandler = default_error_handler,
  num_tries: number = 2,
  retry_sleep_time: number = 0.5,
  base_url: string = "https://api.poe.com/bot/"
): AsyncGenerator<any, void, unknown> {
  if (access_key !== "") {
    console.warn(
      "the access_key param is no longer necessary when using this function."
    );
  }

  const url = `${base_url}${bot_name}`;
  const ctx = new _BotContext(url, api_key, on_error);
  let got_response = false;

  for (let i = 0; i < num_tries; i++) {
    try {
      for await (const message of ctx.perform_query_request(
        request,
        tools,
        tool_calls,
        tool_results
      )) {
        got_response = true;
        yield message;
      }
      break;
    } catch (error) {
      if (error instanceof BotErrorNoRetry) {
        throw error;
      }
      on_error(error as Error, `Bot request to ${bot_name} failed on try ${i}`);
      const allow_retry_after_response =
        error instanceof Error &&
        error.message.includes(
          "peer closed connection without sending complete message body"
        );
      if (
        (got_response && !allow_retry_after_response) ||
        i === num_tries - 1
      ) {
        if (error instanceof BotError) {
          throw error;
        }
        throw new BotError(`Error communicating with bot ${bot_name}`);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retry_sleep_time * 1000)
      );
    }
  }
}

export async function* get_bot_response(
  messages: any[],
  bot_name: string,
  api_key: string,
  tools: any[] | null = null,
  tool_executables: Function[] | null = null,
  temperature: number | null = null,
  skip_system_prompt: boolean | null = null,
  logit_bias: Record<string, number> | null = null,
  stop_sequences: string[] | null = null,
  base_url: string = "https://api.poe.com/bot/"
): AsyncGenerator<any, void, unknown> {
  const additional_params: Record<string, any> = {};
  if (temperature !== null) additional_params.temperature = temperature;
  if (skip_system_prompt !== null)
    additional_params.skip_system_prompt = skip_system_prompt;
  if (logit_bias !== null) additional_params.logit_bias = logit_bias;
  if (stop_sequences !== null)
    additional_params.stop_sequences = stop_sequences;

  const query = {
    query: messages,
    user_id: "",
    conversation_id: "",
    message_id: "",
    version: PROTOCOL_VERSION,
    type: "query",
    ...additional_params,
  };

  yield* stream_request(
    query,
    bot_name,
    api_key,
    tools,
    tool_executables,
    "",
    3,
    default_error_handler,
    2,
    0.5,
    base_url
  );
}

export async function get_final_response(
  request: any,
  bot_name: string,
  api_key: string = "",
  access_key: string = "",
  on_error: ErrorHandler = default_error_handler,
  num_tries: number = 2,
  retry_sleep_time: number = 0.5,
  base_url: string = "https://api.poe.com/bot/"
): Promise<string> {
  const chunks: string[] = [];
  for await (const message of stream_request(
    request,
    bot_name,
    api_key,
    null,
    null,
    access_key,
    3,
    on_error,
    num_tries,
    retry_sleep_time,
    base_url
  )) {
    if ("content_type" in message) continue;
    if (message.is_suggested_reply) continue;
    if (message.is_replace_response) chunks.length = 0;
    chunks.push(message.text);
  }
  if (!chunks.length) {
    throw new BotError(`Bot ${bot_name} sent no response`);
  }
  return chunks.join("");
}

export async function sync_bot_settings(
  bot_name: string,
  access_key: string = "",
  base_url: string = "https://api.poe.com/bot/fetch_settings/"
): Promise<void> {
  const response = await fetch(
    `${base_url}${bot_name}/${access_key}/${PROTOCOL_VERSION}`,
    {
      method: "POST",
    }
  );
  console.log(await response.text());
}
