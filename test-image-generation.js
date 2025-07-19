#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MCPサーバーを起動
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  env: { ...process.env },
  stdio: 'pipe'
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Server response:', JSON.stringify(message, null, 2));
      } catch (e) {
        console.log('Server output:', line);
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// MCPプロトコルで画像生成をテスト
const testImageGeneration = async () => {
  // Initialize
  const initRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {}
    },
    id: 1
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Wait a bit for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Call generate_image tool
  const toolRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'generate_image',
      arguments: {
        prompt: 'A beautiful sunset over mountains',
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      }
    },
    id: 2
  };
  
  server.stdin.write(JSON.stringify(toolRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Close server
  server.stdin.end();
};

testImageGeneration().catch(console.error);