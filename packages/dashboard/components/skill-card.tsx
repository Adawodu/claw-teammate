"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import type { SkillMeta } from "@dynoclaw/shared";

interface SkillCardProps {
  skill: SkillMeta;
  enabled: boolean;
  cronOverride?: string;
  onToggle: (enabled: boolean) => void;
  onCronChange?: (cron: string | undefined) => void;
}

export function SkillCard({ skill, enabled, cronOverride, onToggle, onCronChange }: SkillCardProps) {
  const displayCron = cronOverride ?? skill.cron;
  const [editingCron, setEditingCron] = useState(false);
  const [cronValue, setCronValue] = useState(displayCron ?? "");

  const saveCron = () => {
    const trimmed = cronValue.trim();
    onCronChange?.(trimmed || undefined);
    setEditingCron(false);
  };

  const cancelCron = () => {
    setCronValue(displayCron ?? "");
    setEditingCron(false);
  };

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
          {editingCron ? (
            <div className="flex items-center gap-1">
              <Input
                value={cronValue}
                onChange={(e) => setCronValue(e.target.value)}
                placeholder="e.g. 0 9 * * *"
                className="h-7 w-40 font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCron();
                  if (e.key === "Escape") cancelCron();
                }}
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={saveCron}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={cancelCron}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              {displayCron ? (
                <Badge variant="secondary" className="text-xs font-mono">
                  {displayCron}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">On-demand</Badge>
              )}
              {onCronChange && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setCronValue(displayCron ?? "");
                    setEditingCron(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
          {skill.requiredPlugins.length > 0 && !editingCron && (
            <span className="text-xs text-muted-foreground">
              Requires: {skill.requiredPlugins.join(", ")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
