"use client";

import React, { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "../../../../../lib/sessionStore";
import TimelineStrip from "../../../../../components/TimelineStrip";
import TranscriptPanel from "../../../../../components/TranscriptPanel";
import { detectPauses } from "../../../../../lib/analysis";

export default function DetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  useEffect(() => {
    // Redirect to new results route
    router.replace(`/results/${id}`);
  }, [id, router]);
  return null;
} 