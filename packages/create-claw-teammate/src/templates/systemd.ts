import type { DeployConfig } from "../config/types.js";

export function generateSystemdUnit(config: DeployConfig): string {
  return `[Unit]
Description=OpenClaw Gateway — ${config.branding.botName}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/openclaw.env
ExecStartPre=/usr/bin/env openclaw security audit --fix
ExecStart=/usr/bin/env openclaw gateway run --bind loopback
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
`;
}
