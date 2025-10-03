"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { subscribeToRequestTimeline } from "@/lib/request-timeline";

type Props = {
  requestId: string;
  onChange?: () => void;
};

export function TimelineRealtimeBridge({ requestId, onChange }: Props) {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = subscribeToRequestTimeline(requestId, () => {
      if (onChange) {
        onChange();
      } else {
        router.refresh();
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [onChange, requestId, router]);

  return null;
}
