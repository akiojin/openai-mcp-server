# OpenAI MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to interact
with OpenAI's ChatGPT API.

## Features

- **Chat Completion**: Generate text using OpenAI's latest language models
  (GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, GPT-4o, o1, o1-pro, o3, o4-mini)
- **List Models**: Retrieve available OpenAI models
- **Configurable Parameters**: Control temperature, max tokens, and other
  generation settings

## Prerequisites

- Node.js 18 or higher
- OpenAI API key

## Installation

```bash
# Clone the repository
git clone https://github.com/akiojin/openai-mcp-server.git
cd openai-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

1. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

1. Add your OpenAI API key to the `.env` file:

```bash
OPENAI_API_KEY=your_api_key_here
```

## Usage

### 使用例

このMCPサーバーは、Claude CodeなどのAIアシスタントから呼び出して使用することを想定しています：

- **出力結果の検証**: Claude Codeの出力結果をChatGPTに検証させることができます
- **画像生成**: Claude Codeでは直接画像生成ができませんが、このMCPサーバー経由でChatGPTのgpt-image-1モデルを使用した画像生成が可能です
- **異なるモデルの活用**: 用途に応じて様々なOpenAIモデル（GPT-4.1、o1、o3など）を使い分けることができます

### As an MCP Server

Add the server to your MCP client configuration:

```json
{
  "servers": {
    "openai": {
      "command": "node",
      "args": ["path/to/openai-mcp-server/dist/index.js"]
    }
  }
}
```

### Available Tools

#### chat_completion

Generate text using ChatGPT.

Parameters:

- `model` (string, optional): Model to use (default: "gpt-4.1")
- `messages` (array, required): Chat history with role and content
- `temperature` (number, optional): Sampling temperature 0-2 (default: 0.7)
- `max_tokens` (number, optional): Maximum tokens to generate (default: 1000)

#### list_models

List all available OpenAI models.

#### generate_image

Generate images using gpt-image-1 model. Returns file paths for generated images saved in temporary directory.

Parameters:
- `prompt` (string, required): Text description of the desired image(s). Maximum 1000 characters.
- `model` (string, optional): Model to use (default: "gpt-image-1")
- `n` (number, optional): Number of images to generate 1-10 (default: 1)
- `size` (string, optional): Size of images - "1024x1024", "1024x1536", "1536x1024", or "auto" (default: "1024x1024")
- `quality` (string, optional): Quality - "low", "medium", "high", or "auto" (default: "auto")
- `background` (string, optional): Background type - "opaque" or "transparent" (default: "opaque")

Note: Generated images are saved as temporary files to minimize token usage. The response includes file paths instead of base64 data.

Example:
```json
{
  "prompt": "A beautiful sunset over mountains",
  "size": "1024x1024",
  "quality": "high",
  "background": "opaque"
}
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Watch mode for development
npm run watch
```

## Project Structure

```text
openai-mcp-server/
├── src/
│   └── index.ts       # Main server implementation
├── dist/              # Compiled JavaScript (generated)
├── .env               # Environment variables (create from .env.example)
├── .env.example       # Example environment configuration
├── package.json       # Project dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

## License

MIT License - see LICENSE file for details

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release)
for automated versioning and publishing.

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Commit Types

- `feat:` new feature (minor version bump)
- `fix:` bug fix (patch version bump)
- `BREAKING CHANGE:` breaking change (major version bump)
- `docs:` documentation changes (patch version bump)
- `style:` formatting changes (patch version bump)
- `refactor:` code refactoring (patch version bump)
- `test:` adding tests (patch version bump)
- `chore:` maintenance tasks (patch version bump)

#### Examples

```bash
# New feature (0.1.0 → 0.2.0)
feat: add streaming support for chat completion

# Bug fix (0.1.0 → 0.1.1)
fix: handle connection timeout properly

# Breaking change (0.1.0 → 1.0.0)
feat: redesign API interface

BREAKING CHANGE: The chat_completion tool now requires a different parameter structure
```

### Helper Scripts

```bash
# Interactive commit with commitizen
npm run commit

# Test release without publishing
npm run release:dry-run

# Manual release (usually handled by CI)
npm run release
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Follow conventional commit format for your commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/akiojin/openai-mcp-server/issues).
