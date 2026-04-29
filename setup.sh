#!/bin/bash
# Custom setup script - skip mise, use system pnpm
cd app && pnpm install
echo "Setup complete - using system pnpm"
