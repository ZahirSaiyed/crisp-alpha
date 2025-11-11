"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MicPermissionModalProps {
  isOpen: boolean;
  permissionState: "prompt" | "denied" | null;
  onRequestPermission: () => void;
  onClose: () => void;
  onTryText?: () => void;
}

export default function MicPermissionModal({
  isOpen,
  permissionState,
  onRequestPermission,
  onClose,
  onTryText,
}: MicPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-modal-title"
          >
            <div
              className="bg-white rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.15)] max-w-md w-full p-6 sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {permissionState === "prompt" ? (
                <>
                  <h2
                    id="permission-modal-title"
                    className="text-2xl font-semibold text-[color:var(--ink)] mb-4"
                  >
                    Allow microphone access
                  </h2>
                  <p className="text-[color:rgba(11,11,12,0.75)] mb-6 leading-relaxed">
                    We only access the mic while you&apos;re recording. Your audio is processed securely and immediately discarded.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={onRequestPermission}
                      className="px-6 py-3 bg-[#E5484D] text-white rounded-xl font-medium hover:bg-[#D7373F] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5484D]"
                    >
                      Allow microphone
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-[color:var(--muted-1)] text-[color:var(--ink)] rounded-xl font-medium hover:bg-[color:var(--muted-2)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : permissionState === "denied" ? (
                <>
                  <h2
                    id="permission-modal-title"
                    className="text-2xl font-semibold text-[color:var(--ink)] mb-4"
                  >
                    Microphone access denied
                  </h2>
                  <p className="text-[color:rgba(11,11,12,0.75)] mb-4 leading-relaxed">
                    To record audio, please enable microphone access in your browser settings.
                  </p>
                  <div className="bg-[color:var(--muted-1)] rounded-lg p-4 mb-6">
                    <p className="text-sm text-[color:rgba(11,11,12,0.70)] mb-2 font-medium">
                      How to enable:
                    </p>
                    <ul className="text-sm text-[color:rgba(11,11,12,0.70)] space-y-1 list-disc list-inside">
                      <li>Click the lock icon in your browser&apos;s address bar</li>
                      <li>Find &quot;Microphone&quot; in the permissions list</li>
                      <li>Change it to &quot;Allow&quot;</li>
                      <li>Refresh this page</li>
                    </ul>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {onTryText && (
                      <button
                        onClick={onTryText}
                        className="px-6 py-3 bg-[color:var(--intent-primary)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        Try text instead
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-[color:var(--muted-1)] text-[color:var(--ink)] rounded-xl font-medium hover:bg-[color:var(--muted-2)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

