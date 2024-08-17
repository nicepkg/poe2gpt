#!/usr/bin/env node

import { program } from "commander";
import { startServer } from "./server";
import { version } from "../package.json";

program
  .version(
    version,
    "-v, --version",
    "Output the current version / 输出当前版本"
  )
  .option(
    "-t, --tokens <tokens>",
    "Comma-separated list of tokens, see: https://poe.com/api_key / POE令牌列表, 多个用逗号分隔"
  )
  .option("-p, --port <port>", "Port number / 端口号")
  .option(
    "-sk, --access-tokens <accessTokens>",
    "Comma-separated white list of custom API Key / 自定义API访问令牌白名单, 用逗号分隔"
  )
  //   .option("-x, --proxy <proxy>", "Proxy URL / 代理服务器URL")
  //   .option(
  //     "-s, --simulate-roles <simulateRoles>",
  //     "Simulate roles (0: disable, 1: enable, 2: auto detect) / 模拟角色(0:禁用, 1:启用, 2:自动检测)"
  //   )
  .option(
    "-r, --rate-limit <rateLimit>",
    "Rate limit per minute / 每分钟请求限制"
  )
  .option(
    "-c, --cool-down <coolDown>",
    "Cool down period in seconds / 冷却时间（秒）"
  )
  .option(
    "-o, --timeout <timeout>",
    "Timeout in seconds per response chunk / 每个响应块的超时时间（秒）"
  )
  .option(
    "-b, --bot <bot>",
    "JSON string of bot name mappings / 机器人名称映射的JSON字符串"
  )
  .parse(process.argv);

const options = program.opts();

startServer({
  tokens: options.tokens ? options.tokens.split(",") : undefined,
  port: options.port ? parseInt(options.port, 10) : undefined,
  accessTokens: options.accessTokens
    ? options.accessTokens.split(",")
    : undefined,
  //   proxy: options.proxy,
  //   simulateRoles: options.simulateRoles
  //     ? parseInt(options.simulateRoles, 10)
  //     : undefined,
  rateLimit: options.rateLimit ? parseInt(options.rateLimit, 10) : undefined,
  coolDown: options.coolDown ? parseInt(options.coolDown, 10) : undefined,
  timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
  bot: options.bot ? JSON.parse(options.bot) : undefined,
});

program.addHelpText(
  "after",
  `
使用说明:
  -v, --version: 输出当前版本
  -t, --tokens: POE令牌列表，用逗号分隔, 请参考: https://poe.com/api_key
  -p, --port: 端口号
  -at, --access-tokens: 自定义API访问令牌列表，用逗号分隔
  -x, --proxy: 代理服务器URL
  -s, --simulate-roles: 模拟角色(0:禁用, 1:启用, 2:自动检测)
  -r, --rate-limit: 每分钟请求限制
  -c, --cool-down: 冷却时间（秒）
  -o, --timeout: 每个响应块的超时时间（秒）
  -i, --api-timeout: POE API的超时时间（秒）
  -b, --bot: 机器人名称映射的JSON字符串

示例:
  poe2gpt -t token1,token2 -p 3700 -a sk-xxxxx -b '{"gpt-4o":"GPT-4o"}'
`
);
