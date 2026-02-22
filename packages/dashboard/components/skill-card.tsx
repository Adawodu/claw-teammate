"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { SkillMeta } from "@claw-teammate/shared";

interface SkillCardProps {
  skill: SkillMeta;
  enabled: boolean;
  cronOverride?: string;
  onToggle: (enabled: boolean) => void;
}

export function SkillCard({ skill, enabled, cronOverride, onToggle }: SkillCardProps) {
  const displayCron = cronOverride ?? skill.cron;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">{skill.name}</CardTitle>
          <CardDescription className="text-xs">{skill.description}</CardDescription>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {displayCron ? (
            <Badge variant="secondary" className="text-xs font-mono">
              {displayCron}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">On-demand</Badge>
          )}
          {skill.requiredPlugins.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Requires: {skill.requiredPlugins.join(", ")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
