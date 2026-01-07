# BIM IDE Container
# Linux-based environment with Python, ifcopenshell, Node.js, Bun, and common utilities

FROM python:3.11-slim-bookworm

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    BUN_INSTALL=/usr/local/bun \
    PATH="/usr/local/bun/bin:$PATH"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    bash \
    git \
    curl \
    wget \
    ca-certificates \
    gnupg \
    # Build tools (needed for some Python packages)
    build-essential \
    # Useful CLI tools
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.1.0" \
    && ln -s /usr/local/bun/bin/bun /usr/local/bin/bun \
    && ln -s /usr/local/bun/bin/bunx /usr/local/bin/bunx

# Install Python packages
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

# Configure bash prompt and aliases
RUN echo 'PS1="\[\033[36m\]\w\[\033[0m\] $ "' >> /etc/bash.bashrc \
    && echo 'alias ll="ls -la"' >> /etc/bash.bashrc

# Set up workspace directory
WORKDIR /workspace

# Keep container running (for exec-based interaction)
# NOTE: Running as root to avoid permission issues with mounted volumes
# In production, consider using user namespaces or fixing permissions at runtime
CMD ["tail", "-f", "/dev/null"]
