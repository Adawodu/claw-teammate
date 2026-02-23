"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { getRequiredApiKeys } from "@claw-teammate/shared";
import { useState } from "react";
import type { WizardState } from "@/app/(dashboard)/deploy/page";

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function StepApiKeys({ state, update }: Props) {
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const enabledPlugins = Object.entries(state.plugins)
    .filter(([, v]) => v)
    .map(([k]) => k);

  // Always need telegram token
  const keys = [
    {
      key: "telegramBotToken",
      secretName: "telegram-bot-token",
      description: "Telegram Bot Token",
      signupUrl: "https://t.me/BotFather",
      required: true,
    },
    {
      key: "openrouterApiKey",
      secretName: "openrouter-api-key",
      description: "OpenRouter API key",
      signupUrl: "https://openrouter.ai/keys",
      required: true,
    },
    {
      key: "braveApiKey",
      secretName: "brave-api-key",
      description: "Brave Search API key (for web search)",
      signupUrl: "https://brave.com/search/api/",
      required: true,
    },
    ...getRequiredApiKeys(enabledPlugins),
  ];

  function toggleVisibility(secretName: string) {
    setVisibleKeys((prev) => ({ ...prev, [secretName]: !prev[secretName] }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Keys</CardTitle>
        <CardDescription>
          Enter your API keys. They will be stored in GCP Secret Manager.
          Values are saved as you type and persist across deploy attempts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {keys.map((k) => {
          const isVisible = visibleKeys[k.secretName] ?? false;
          const hasValue = !!state.apiKeys[k.secretName];

          return (
            <div key={k.secretName} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={k.secretName}>{k.description}</Label>
                {k.required ? (
                  <Badge variant="destructive" className="text-[10px]">
                    Required
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Optional
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Input
                  id={k.secretName}
                  type={isVisible ? "text" : "password"}
                  placeholder={k.secretName}
                  value={state.apiKeys[k.secretName] ?? ""}
                  onChange={(e) =>
                    update({
                      apiKeys: {
                        ...state.apiKeys,
                        [k.secretName]: e.target.value,
                      },
                    })
                  }
                />
                {hasValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                    onClick={() => toggleVisibility(k.secretName)}
                  >
                    {isVisible ? (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                )}
              </div>
              <a
                href={k.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Get key
              </a>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
