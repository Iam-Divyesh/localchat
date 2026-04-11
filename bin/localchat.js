#!/usr/bin/env node
"use strict";

// Entry point for global npm install.
// Resolves to dist/cli.js relative to this package root.
const path = require("path");
const cli = path.join(__dirname, "..", "lib", "cli.js");
require(cli);
