# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive test suite for error handling (errors.test.ts)
- Comprehensive test suite for environment validation (env-validator.test.ts)
- Unit tests for input validation logic (index.test.ts)
- Test coverage increased from 36.45% to 81.68%

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

### Security

- Added API key validation
- Implemented input sanitization options
- Enhanced error handling to prevent information leakage
- API key format validation with proper error messages
- Sanitized API key logging to prevent credential exposure
- Environment variable validation to ensure secure configuration

## [0.1.0] - 2025-06-03

### Added

- Initial release of OpenAI MCP Server
- Chat completion tool with support for GPT-4o, GPT-4, and GPT-3.5-turbo models
- List models tool to retrieve available OpenAI models
- TypeScript implementation with full type safety
- Environment variable configuration for OpenAI API key
- Comprehensive documentation and setup instructions