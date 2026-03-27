import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const COMMAND = "npx nightfang scan --target https://api.example.com/chat";

export default function TerminalHero() {
  const [typed, setTyped] = useState("");
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < COMMAND.length) {
        setTyped(COMMAND.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowOutput(true), 500);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden shadow-2xl shadow-red-900/10"
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-xs text-white/30 font-mono">terminal</span>
        </div>

        {/* Content */}
        <div className="p-4 font-mono text-sm leading-relaxed">
          <div className="text-white/50">
            <span className="text-green-400">$ </span>
            <span className="text-white">{typed}</span>
            {!showOutput && <span className="animate-pulse text-blue-400">▌</span>}
          </div>

          {showOutput && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-4 space-y-2"
            >
              <div className="text-white/60">
                <span className="text-white font-bold">◆ nightfang</span> v0.1.0
              </div>
              <div className="text-white/40 text-xs mt-2">
                Target: https://api.example.com/chat<br/>
                Depth: default (~50 probes)
              </div>
              <div className="mt-3 space-y-1">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="text-green-400">✓ Discovery — 3 endpoints, system prompt extracted</motion.div>
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="text-green-400">✓ Attack — 47 probes across 6 categories</motion.div>
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }} className="text-green-400">✓ Verify — 4 confirmed, 3 false positives killed</motion.div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="mt-4 pt-3 border-t border-white/10">
                <div className="flex gap-4 text-xs">
                  <span><span className="text-red-500 font-bold">● 2</span> <span className="text-white/40">Critical</span></span>
                  <span><span className="text-orange-400 font-bold">● 1</span> <span className="text-white/40">High</span></span>
                  <span><span className="text-yellow-400 font-bold">● 1</span> <span className="text-white/40">Medium</span></span>
                </div>
                <div className="text-white/30 text-xs mt-2">4 findings │ 47 probes │ 12.4s │ $0.18</div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
