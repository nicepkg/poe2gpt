<div align="center">

<h1>poe2gpt</h1>

[English](https://github.com/nicepkg/poe2gpt/tree/master/README.md) / 简体中文

🔑 畅通无阻: 将 Poe.com 转换为 OpenAI 接口兼容格式!

[![Version](https://img.shields.io/npm/v/poe2gpt)](https://www.npmjs.com/package/poe2gpt)
[![Downloads](https://img.shields.io/npm/dm/poe2gpt)](https://www.npmjs.com/package/poe2gpt)
[![License](https://img.shields.io/github/license/nicepkg/poe2gpt)](https://github.com/nicepkg/poe2gpt/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nicepkg/poe2gpt)](https://github.com/nicepkg/poe2gpt)

</div>

## 为什么 📚

[Poe](https://poe.com) 的订阅积分往往用不完，但是使用其它工具又需要额外为 OpenAI 付费，这简直是浪费。所以我想能不能将 Poe 转发成为兼容 OpenAI 的接口。

我查找了一下 Github，发现已经有类似的项目了，但它们要么不再维护，要么使用不是特别便捷。所以我决定自己移植优化一下。

poe2gpt 移植于 [poe-to-gpt](https://github.com/formzs/poe-to-gpt) 和 [fastapi_poe](https://github.com/poe-platform/fastapi_poe) 两个项目，感谢它们。

poe2gpt 只需要你有 nodejs 环境，就可以通过一行命令启动，非常方便。

> \[!IMPORTANT]\
> 目前**仅限 Poe 订阅者访问 API 密钥**。
> Poe 订阅者获取 API key 地址：[https://poe.com/api_key](https://poe.com/api_key)

## 使用 📦

### 命令方式使用

首先，你需要在你的系统上安装 [Node.js](https://nodejs.org/)。安装完成后，可以用以下两种方式启动 `poe2gpt`。

#### 方式一：使用 npx

可以使用 `nodejs` 自带的 `npx` 直接运行：

```sh
npx poe2gpt -t <tokens> -p <port> -sk <accessTokens> -r <rateLimit> -c <coolDown> -o <timeout> -b <bot>

# 示例
npx poe2gpt -t "你的 poe key"
```

#### 方式二：使用本地安装

如果你想以后更快启动，可以使用本地全局安装：

```sh
npm i -g poe2gpt
```

然后你可以使用以下命令启动：

```sh
poe2gpt -t <tokens> -p <port> -sk <accessTokens> -r <rateLimit> -c <coolDown> -o <timeout> -b <bot>

# 示例
poe2gpt -t "你的 poe key"
```

#### 参数解释

| 参数                 | 描述                                                              | 默认值 |
| -------------------- | ----------------------------------------------------------------- | ------ |
| -t, --tokens         | POE 令牌列表，多个可以用逗号分隔。请参考: https://poe.com/api_key |        |
| -p, --port           | 端口号                                                            | 3700   |
| -sk, --access-tokens | 自定义 API 访问令牌白名单，用逗号分隔                             |        |
| -r, --rate-limit     | 每分钟请求限制                                                    | 60     |
| -c, --cool-down      | 冷却时间（秒）                                                    | 3      |
| -o, --timeout        | 每个响应块的超时时间（秒）                                        | 180    |
| -b, --bot            | 机器人名称映射的 JSON 字符串                                      |        |
| -v, --version        | 显示版本号                                                        |        |
| --help               | 显示帮助信息                                                      |        |

多参数示例：

```sh
poe2gpt -t "你的 poe key" -p 3700 -sk "你的自定义 API 访问令牌白名单" -r 60 -c 3 -o 180 -b '{"gpt-4o": "GPT-4o"}'
```

### 源码方式使用

<details>
<summary>点击查看源码方式使用</summary>

将此存储库克隆到本地机器：

```sh
git clone https://github.com/nicepkg/poe2gpt.git
cd poe2gpt/
```

安装依赖项：

```sh
npm install
```

在项目的根目录中创建配置文件。指令已写在注释中：

```sh
cp config.example.toml config.toml
# 然后配置 config.toml
```

启动 Node.js 后端：

```sh
npm run dev
```

</details>

## 配置 🛠

请查看 [OpenAI 文档](https://platform.openai.com/docs/api-reference/chat/create) 以获取有关如何使用 ChatGPT API 的更多详细信息。

只需在您的代码中将 `https://api.openai.com` 替换为 `http://localhost:3700` 即可开始使用。

> \[!NOTE]
>
> 你设置的 `accessTokens` 将会成为 OpenAI Key 用来鉴权，不设置则不鉴权。

支持的路由：

- /models
- /chat/completions
- /v1/models
- /v1/chat/completions

支持的参数：

| 参数     | 注意                                                                         |
| -------- | ---------------------------------------------------------------------------- |
| model    | 请参阅 `config.example.toml` 中的 `[bot]` 部分。将模型名称映射到机器人昵称。 |
| messages | 您可以像在官方 API 中一样使用此参数，除了 `name`。                           |
| stream   | 您可以像在官方 API 中一样使用此参数。                                        |

其他参数将被忽略。

**在 [Aide](https://github.com/nicepkg/aide) / [Chatbox](https://github.com/Bin-Huang/chatbox) / [Lobe-chat](https://github.com/lobehub/lobe-chat) 中已成功测试。**

> \[!NOTE]
>
> 本转发不支持 `tools_call` 或者 `function_call`，所以只能用于聊天或基础功能。

### 配置示例

<details>
<summary> config.toml 示例 </summary>

```toml
# 代理服务的端口号。代理的 OpenAI API 端点将是: http://localhost:3700/v1/chat/completions
port = 3700

# 如果你是 Poe 订阅者，你可以在 Poe 官网找到 API key。你必须是 Poe 订阅者。
tokens = [""]

# 自定义 API 访问密钥
accessTokens = ["sk-R6phF8lDbv4oFHdaEN8UFeD5569d4b248aBb87F16b597479"]

# 启用时使用前导提示来指示角色。如果你在使用类似 https://github.com/TheR1D/shell_gpt 的工具，最好禁用它。
# 0:禁用, 1:启用, 2:自动检测
# 示例:
# ||>User:
# 你好！
# ||Assistant:
# 你好！今天怎么帮您？
simulateRoles = 2

# 速率限制。默认为每分钟每个 token 60 次 API 调用
rateLimit = 60

# 冷却时间（秒）。相同的 token 在 n 秒内不能被多次使用
coolDown = 3

# 每个响应块的超时时间（秒）
# 此超时将在每次接收到一个块时重置，
# 因此不需要非常大的值来补偿非常长的回复
timeout = 180

# 从 Poe 使用的机器人名称映射
[bot]
"gpt-3.5-turbo-16k" = "ChatGPT-16k"
"gpt-3.5-turbo" = "ChatGPT-16k"
"gpt-4" = "GPT-4"
"gpt-4o" = "GPT-4o"
"gpt-4o-mini" = "GPT-4o-Mini"
"gpt-4-vision-preview" = "GPT-4-128k"
"gpt-4-turbo-preview" = "Claude-3-Opus"
"Llama-3.1-405B-T" = "Llama-3.1-405B-T"
"Llama-3.1-405B-FW-128k" = "Llama-3.1-405B-FW-128k"
"Llama-3.1-70B-T" = "Llama-3.1-70B-T"
"Llama-3.1-70B-FW-128k" = "Llama-3.1-70B-FW-128k"
"Claude-3.5-Sonnet" = "Claude-3.5-Sonnet"
"Claude-3-Sonnet" = "Claude-3-Sonnet"
"Claude-3-Haiku" = "Claude-3-Haiku"
"Llama-3-70b-Groq" = "Llama-3-70b-Groq"
"Gemini-1.5-Pro"="Gemini-1.5-Pro"
"Gemini-1.5-Pro-128k"="Gemini-1.5-Pro-128k"
"Gemini-1.5-Pro-1M"="Gemini-1.5-Pro-1M"
"DALL-E-3"="DALL-E-3"
"StableDiffusionXL"="StableDiffusionXL"
```

</details>

## 更新日志 📅

查看最新的更新和功能：[更新日志](https://github.com/nicepkg/poe2gpt/blob/master/CHANGELOG.md)

## 贡献 🤝

欢迎贡献！请随时提交拉取请求。有关详细信息，请参阅 [贡献指南](https://github.com/nicepkg/poe2gpt/blob/master/CONTRIBUTING.md)。

这个项目的存在感谢所有贡献者：

<a href="https://github.com/nicepkg/poe2gpt/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nicepkg/poe2gpt" />
</a>

## 许可证 📄

此项目根据 MIT 许可证授权 - 有关详细信息，请参阅 [LICENSE](https://github.com/nicepkg/poe2gpt/blob/master/LICENSE) 文件。

## 支持 💖

如果你觉得这个项目有帮助，请考虑在 [GitHub](https://github.com/nicepkg/poe2gpt) 上给它一个 ⭐️！

## Star 历史 ⭐

<div align="center">

<img src="https://api.star-history.com/svg?repos=nicepkg/poe2gpt&type=Date" width="600" height="400" alt="Star History Chart" valign="middle">

</div>
