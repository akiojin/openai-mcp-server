# OpenAI MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to interact with OpenAI's ChatGPT API.

## Features

- **Chat Completion**: Generate text using OpenAI's language models (GPT-4o, GPT-4, GPT-3.5-turbo)
- **List Models**: Retrieve available OpenAI models
- **Configurable Parameters**: Control temperature, max tokens, and other generation settings

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

- `model` (string, optional): Model to use (default: "gpt-4o")
- `messages` (array, required): Chat history with role and content
- `temperature` (number, optional): Sampling temperature 0-2 (default: 0.7)
- `max_tokens` (number, optional): Maximum tokens to generate (default: 1000)

#### list_models

List all available OpenAI models.

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/akiojin/openai-mcp-server/issues).
