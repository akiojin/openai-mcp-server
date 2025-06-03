# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive test suite for error handling (errors.test.ts)
- Comprehensive test suite for environment validation (env-validator.test.ts)
- Unit tests for input validation logic (index.test.ts)
- Integration tests for OpenAI API operations (tests/integration/openai-api.test.ts)
  - Mocked OpenAI client for safe testing
  - End-to-end flow testing from MCP tool invocation to API response
  - Comprehensive error handling scenarios
- Dependency injection pattern implementation
  - Interface definitions for all major components (src/interfaces.ts)
  - Dependency injection container with singleton pattern (src/container/dependency-container.ts)
  - Adapter pattern for OpenAI client, logger, and config manager
  - Tool handlers extracted to separate classes for better separation of concerns
  - Environment provider for abstracted environment variable access
  - Comprehensive test mocks for all dependencies
  - Improved testability and maintainability
- Semantic versioning automation with semantic-release
  - Automatic version bumping based on conventional commits
  - Automated CHANGELOG.md generation
  - Automated npm package publishing
  - GitHub releases creation
  - Commitlint for enforcing conventional commit format
  - Commitizen integration for interactive commit creation
  - Japanese commit message support
- Request/response caching system implementation
  - In-memory cache with configurable TTL and size limits
  - Multiple eviction strategies (LRU, LFU, FIFO)
  - Cache key generation based on request parameters
  - Integration with chat completion and model listing tools
  - Cache statistics and monitoring
  - Automatic cleanup of expired entries
- Test coverage increased from 36.45% to 81.68%
- GitHub Actions CI/CD workflows
  - Continuous Integration workflow (ci.yml)
  - Automated release workflow (release.yml)
  - Code coverage reporting workflow (coverage.yml)
- Dependabot configuration for automated dependency updates

- ESLint configuration for code quality and consistency
- Prettier configuration for code formatting
- Husky pre-commit hooks for automated quality checks
- Jest testing framework with comprehensive test suite
- Structured logging system with pino logger
- Configuration management system with JSON file support
- Environment variable overrides for configuration
- Input validation and sanitization
- Enhanced error handling for OpenAI API operations
- TypeScript strict mode compliance
- OpenAI SDK type definitions for better type safety
- Comprehensive error classification system (src/errors.ts)
- Environment variable validation at startup (src/env-validator.ts)
- API key format validation with sanitized logging

### Changed

- Migrated ESLint configuration from .js to .cjs format for better compatibility
- Improved tool descriptions with detailed information
- Enhanced error messages with structured error objects
- Refactored error handling to use custom error classes
- Updated type definitions to use OpenAI SDK types directly
- Improved startup validation with detailed error messages
- Major architectural refactoring with dependency injection pattern
  - Decoupled components for better testability
  - Extracted tool logic into separate handler classes
  - Improved separation of concerns throughout the codebase

### Security

- Added API key validation
- Implemented input sanitization options
- Enhanced error handling to prevent information leakage
- API key format validation with proper error messages
- Sanitized API key logging to prevent credential exposure
- Environment variable validation to ensure secure configuration

## [0.1.0] - 2025-06-03

### Initial Release

- Initial release of OpenAI MCP Server
- Chat completion tool with support for GPT-4o, GPT-4, and GPT-3.5-turbo models
- List models tool to retrieve available OpenAI models
- TypeScript implementation with full type safety
- Environment variable configuration for OpenAI API key
- Comprehensive documentation and setup instructions
