"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Cpu, Plug } from "lucide-react";

interface CostExplainerProps {
  primaryModel?: string;
  fallbackModels?: string[];
}

export function CostExplainer({
  primaryModel,
  fallbackModels,
}: CostExplainerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          How costs work
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-0 text-sm">
          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium">Skills use the AI model chain</p>
              <p className="text-muted-foreground">
                Daily posts, content engine, newsletter writer, job hunter,
                daily briefing, and engagement monitor all send prompts to
                your model chain. These are your LLM costs.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Plug className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <div>
              <p className="font-medium">Plugins do NOT use the model chain</p>
              <p className="text-muted-foreground">
                Image gen (Imagen/DALL-E), video gen (Veo/Sora), Postiz,
                Beehiiv, and GitHub are direct API calls&mdash;they don&apos;t
                go through the fallback chain and aren&apos;t reflected here.
              </p>
            </div>
          </div>

          {primaryModel && (
            <div className="rounded-md border p-3">
              <p className="mb-1 font-medium">Your model chain</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded bg-blue-100 px-2 py-0.5 dark:bg-blue-900">
                  {primaryModel}
                </span>
                {fallbackModels?.map((m) => (
                  <span key={m}>
                    <span className="text-muted-foreground">&rarr;</span>{" "}
                    <span className="rounded bg-muted px-2 py-0.5">{m}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
