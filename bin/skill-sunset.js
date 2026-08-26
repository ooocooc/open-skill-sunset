#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`skill-sunset: ${error.message}`);
  process.exitCode = 1;
});
