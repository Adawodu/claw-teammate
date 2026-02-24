"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { PluginMeta } from "@dynoclaw/shared";

interface PluginCardProps {
  plugin: PluginMeta;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function PluginCard({ plugin, enabled, onToggle }: PluginCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">{plugin.name}</CardTitle>
          <CardDescription className="text-xs">{plugin.description}</CardDescription>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {plugin.requiredKeys.map((k) => (
            <Badge key={k.secretName} variant="outline" className="text-xs">
              {k.secretName}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
