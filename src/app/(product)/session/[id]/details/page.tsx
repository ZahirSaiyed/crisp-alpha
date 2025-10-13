"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

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