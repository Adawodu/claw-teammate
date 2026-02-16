FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg && \
    # Install gcloud CLI (for Secret Manager access)
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
      gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
      > /etc/apt/sources.list.d/google-cloud-sdk.list && \
    apt-get update && apt-get install -y --no-install-recommends google-cloud-cli && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

WORKDIR /opt/openclaw

COPY openclaw-config.jsonc /opt/openclaw/config-template.jsonc
COPY startup.sh /opt/openclaw/startup.sh
RUN chmod +x /opt/openclaw/startup.sh

ENTRYPOINT ["/opt/openclaw/startup.sh"]
