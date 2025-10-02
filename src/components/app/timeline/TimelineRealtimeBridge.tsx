"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { subscribeToRequestTimeline } from "@/lib/request-timeline";

type Props = {
  requestId: string;
};

export function TimelineRealtimeBridge({ requestId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = subscribeToRequestTimeline(requestId, () => {
      router.refresh();
    });
    return () => {
      unsubscribe?.();
    };
  }, [requestId, router]);

  return null;
}

