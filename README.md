<div align="center">

<h1>poe2gpt</h1>

English / [简体中文](https://github.com/nicepkg/poe2gpt/tree/master/README_CN.md)

🔑 Unimpeded: Convert Poe.com to OpenAI Interface-Compatible Format!
🔑 畅通无阻: 将 Poe.com 转换为 OpenAI 接口兼容格式!

[![Version](https://img.shields.io/npm/v/poe2gpt)](https://www.npmjs.com/package/poe2gpt)
[![Downloads](https://img.shields.io/npm/dm/poe2gpt)](https://www.npmjs.com/package/poe2gpt)
[![License](https://img.shields.io/github/license/nicepkg/poe2gpt)](https://github.com/nicepkg/poe2gpt/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nicepkg/poe2gpt)](https://github.com/nicepkg/poe2gpt)

</div>

## Why 📚

Poe's subscription credits often go unused, but using other tools requires additional payments to OpenAI, which feels like a waste. So, I wondered if Poe could be forwarded to an OpenAI-compatible API.

I searched on GitHub and found some similar projects, but they were either no longer maintained or not very user-friendly. So, I decided to optimize and port it myself.

poe2gpt is ported from the [poe-to-gpt](https://github.com/formzs/poe-to-gpt) and [fastapi_poe](https://github.com/poe-platform/fastapi_poe) projects. Thanks to them.

With poe2gpt, all you need is a nodejs environment, and you can start it with a single command—very convenient.

> \[!IMPORTANT]\
> Currently, **only Poe subscribers can access the API key**.
> Poe subscribers can obtain the API key at: [https://poe.com/api_key](https://poe.com/api_key)

## Usage 📦

### Command-line Usage

First, you need to install [Node.js](https://nodejs.org/) on your system. Once installed, you can start `poe2gpt` in two ways.

#### Method 1: Using npx

You can run it directly using `npx`, which comes with nodejs:

```sh
npx poe2gpt -t <tokens> -p <port> -sk <accessTokens> -r <rateLimit> -c <coolDown> -o <timeout> -b <bot>

# Example
npx poe2gpt -t "your poe key"
```

#### Method 2: Using Local Installation

If you want a faster startup in the future, you can install it globally:

```sh
npm i -g poe2gpt
```

Then you can start it with the following command:

```sh
poe2gpt -t <tokens> -p <port> -sk <accessTokens> -r <rateLimit> -c <coolDown> -o <timeout> -b <bot>

# Example
poe2gpt -t "your poe key"
```

#### Parameter Explanation

| Parameter            | Description                                                                                 | Default |
| -------------------- | ------------------------------------------------------------------------------------------- | ------- |
| -t, --tokens         | List of POE tokens, multiple can be separated by commas. Reference: https://poe.com/api_key |         |
| -p, --port           | Port number                                                                                 | 3700    |
| -sk, --access-tokens | Custom API access token whitelist, separated by commas                                      |         |
| -r, --rate-limit     | Request limit per minute                                                                    | 60      |
| -c, --cool-down      | Cooldown time (seconds)                                                                     | 3       |
| -o, --timeout        | Timeout for each response block (seconds)                                                   | 180     |
| -b, --bot            | JSON string mapping bot names                                                               |         |
| -v, --version        | Show version number                                                                         |         |
| --help               | Show help information                                                                       |         |

Multi-parameter example:

```sh
poe2gpt -t "your poe key" -p 3700 -sk "your custom API access token whitelist" -r 60 -c 3 -o 180 -b '{"gpt-4o": "GPT-4o"}'
```

### Using Source Code

<details>
<summary>Click to see how to use the source code</summary>

Clone this repository to your local machine:

```sh
git clone https://github.com/nicepkg/poe2gpt.git
cd poe2gpt/
```

Install dependencies:

```sh
npm install
```

Create a configuration file in the project’s root directory. Instructions are written in the comments:

```sh
cp config.example.toml config.toml
# Then configure config.toml
```

Start the Node.js backend:

```sh
npm run dev
```

</details>

## Configuration 🛠

Please refer to the [OpenAI documentation](https://platform.openai.com/docs/api-reference/chat/create) for more details on how to use the ChatGPT API.

Simply replace `https://api.openai.com` with `http://localhost:3700` in your code to start using it.

> \[!NOTE]
>
> The `accessTokens` you set will be used as the OpenAI Key for authentication. If not set, no authentication is required.

Supported routes:

- /models
- /chat/completions
- /v1/models
- /v1/chat/completions

Supported parameters:

| Parameter | Note                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------- |
| model     | Refer to the `[bot]` section in `config.example.toml` for model name mappings to bot nicknames. |
| messages  | You can use this parameter as in the official API, except for `name`.                           |
| stream    | You can use this parameter as in the official API.                                              |

Other parameters will be ignored.

**Successfully tested in [Aide](https://github.com/nicepkg/aide) / [Chatbox](https://github.com/Bin-Huang/chatbox) / [Lobe-chat](https://github.com/lobehub/lobe-chat).**

> \[!NOTE]
>
> This forwarding does not support `tools_call` or `function_call`, so it can only be used for chatting or basic functions.

### Configuration Example

<details>
<summary> config.toml Example </summary>

```toml
# Port number for the proxy service. The proxied OpenAI API endpoint will be: http://localhost:3700/v1/chat/completions
port = 3700

# If you are a Poe subscriber, you can find the API key on the Poe website. You must be a Poe subscriber.
tokens = [""]

# Custom API access keys
accessTokens = ["sk-R6phF8lDbv4oFHdaEN8UFeD5569d4b248aBb87F16b597479"]

# Enable or disable role simulation prompts. If you are using tools like https://github.com/TheR1D/shell_gpt, it is best to disable it.
# 0: Disable, 1: Enable, 2: Auto-detect
# Example:
# ||>User:
# Hello!
# ||Assistant:
# Hello! How can I assist you today?
simulateRoles = 2

# Rate limit. Default is 60 API calls per minute per token
rateLimit = 60

# Cooldown time (seconds). The same token cannot be used multiple times within n seconds
coolDown = 3

# Timeout for each response block (seconds)
# This timeout resets with each received block,
# so there is no need to compensate for very long replies with a very large value
timeout = 180

# Bot name mappings from Poe
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
"Gemini-1

.5-Pro-1M"="Gemini-1.5-Pro-1M"
"DALL-E-3"="DALL-E-3"
"StableDiffusionXL"="StableDiffusionXL"
```

</details>

## Changelog 📅

See the latest updates and features: [Changelog](https://github.com/nicepkg/poe2gpt/blob/master/CHANGELOG.md)

## Contribution 🤝

Contributions are welcome! Feel free to submit a pull request. For more details, see the [Contributing Guide](https://github.com/nicepkg/poe2gpt/blob/master/CONTRIBUTING.md).

This project exists thanks to all the contributors:

<a href="https://github.com/nicepkg/poe2gpt/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nicepkg/poe2gpt" />
</a>

## License 📄

This project is licensed under the MIT License—see the [LICENSE](https://github.com/nicepkg/poe2gpt/blob/master/LICENSE) file for details.

## Support 💖

If you find this project helpful, please consider giving it a ⭐️ on [GitHub](https://github.com/nicepkg/poe2gpt)!

## Star History ⭐

<div align="center">

<img src="https://api.star-history.com/svg?repos=nicepkg/poe2gpt&type=Date" width="600" height="400" alt="Star History Chart" valign="middle">

</div>
