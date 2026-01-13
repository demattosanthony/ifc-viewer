#!/bin/bash
# Entrypoint script for BIM IDE container
# Ensures workspace files are owned by bimuser before starting

# Change ownership of all workspace files to bimuser
# This handles files uploaded via docker cp / putArchive which come in as root
chown -R bimuser:bimuser /workspace 2>/dev/null || true

# Execute the main command as bimuser
exec gosu bimuser "$@"
