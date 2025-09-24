"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { StatusBadge } from "@/components/ui/status-badge";

type Props = { requestId: string; initial: string };

export function RealtimeBadge({ requestId, initial }: Props) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    setStatus(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClientComponentClient();
    const channelName = `rq-updates-${requestId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "funding_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: string })?.status;
          if (typeof next === "string") {
            setStatus(next);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  return <StatusBadge kind="request" status={status} />;
}
