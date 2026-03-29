"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PromptDetail {
  prompt: string;
  mentioned: boolean;
  snippet?: string | null;
  category?: string;
}

export default function AuditDetailClient({ promptDetails }: { promptDetails: PromptDetail[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? promptDetails : promptDetails.slice(0, 8);

  return (
    <div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 text-[12px]"
            >
              <span className={`mt-0.5 shrink-0 ${d.mentioned ? "text-[#2596be]" : "text-[#EF4444]"}`}>
                {d.mentioned ? "✓" : "✗"}
              </span>
              <div className="min-w-0">
                <p className="text-[#999]">
                  {d.category && <span className="text-[#555] capitalize">[{d.category.replace(/_/g, " ")}] </span>}
                  {d.prompt}
                </p>
                {d.snippet && <p className="text-[#555] mt-0.5 text-[11px] truncate">{d.snippet}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {promptDetails.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[12px] text-[#666] hover:text-white transition-colors"
        >
          {expanded ? "Show less ↑" : `Show all ${promptDetails.length} prompts ↓`}
        </button>
      )}
    </div>
  );
}
