FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    jq \
    vim \
    python3 \
    python3-pip \
    build-essential \
    python3-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --upgrade pipx --break-system-packages && \
    pipx ensurepath && \
    pipx install uv

RUN curl -fsSL https://claude.ai/install.sh | bash

RUN npm i -g \
    @openai/codex@latest \
    @google/gemini-cli

WORKDIR /openai-mcp-server
ENTRYPOINT ["/openai-mcp-server/scripts/entrypoint.sh"]
CMD ["bash"]