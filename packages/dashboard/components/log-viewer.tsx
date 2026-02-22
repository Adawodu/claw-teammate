"use client";

import { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, Search } from "lucide-react";

export function LogViewer({ logs }: { logs: string }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [followTail, setFollowTail] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (followTail && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logs, followTail]);

  const filteredLogs = filter
    ? logs
        .split("\n")
        .filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
        .join("\n")
    : logs;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">
          Serial Port Output
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-7 w-48 pl-7 text-xs"
            />
          </div>
          <Button
            variant={followTail ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setFollowTail(!followTail)}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre
          ref={preRef}
          className="max-h-[600px] overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed"
        >
          {filteredLogs || "No logs available. Deploy a VM to see output."}
        </pre>
      </CardContent>
    </Card>
  );
}
