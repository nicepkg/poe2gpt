export interface Message {
  role: string;
  content: string;
  name: string;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  stream: boolean;
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  choices: Choice[];
  usage: Usage;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason: string;
}

export interface CompletionSSEResponse {
  choices: SSEChoice[];
  created: number;
  id: string;
  model: string;
  object: string;
}

export interface SSEChoice {
  delta: { [key: string]: string };
  finish_reason: string | null;
  index: number;
}

export interface Delta {
  role: string;
  content: string;
}
