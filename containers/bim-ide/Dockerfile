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
    # PDF tools (pdftotext, pdftoppm, pdfinfo, etc.)
    poppler-utils \
    # LibreOffice Calc (for Excel formula recalculation)
    libreoffice-calc \
    # For entrypoint user switching
    gosu \
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

# Create non-root user with configurable UID/GID for volume mount compatibility
# Pass --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) to match host user
ARG USER_ID=1000
ARG GROUP_ID=1000
RUN groupadd -g ${GROUP_ID} bimuser \
    && useradd -m -u ${USER_ID} -g ${GROUP_ID} -s /bin/bash bimuser

# Configure bash prompt and aliases system-wide
RUN echo 'PS1="\[\033[36m\]\w\[\033[0m\] $ "' >> /etc/bash.bashrc \
    && echo 'alias ll="ls -la"' >> /etc/bash.bashrc

# Set up workspace directory with correct ownership for non-root user
RUN mkdir -p /workspace && chown ${USER_ID}:${GROUP_ID} /workspace

# Set up skills directory (bundled skills are copied here at runtime)
RUN mkdir -p /opt/skills && chown ${USER_ID}:${GROUP_ID} /opt/skills

WORKDIR /workspace

# Configure bimuser's bashrc
RUN echo 'PS1="\[\033[36m\]\w\[\033[0m\] $ "' >> /home/bimuser/.bashrc \
    && echo 'alias ll="ls -la"' >> /home/bimuser/.bashrc

# Copy and configure entrypoint script
# Entrypoint runs as root to fix file ownership, then switches to bimuser
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Use entrypoint to ensure workspace files are owned by bimuser
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Keep container running (for exec-based interaction)
CMD ["tail", "-f", "/dev/null"]
