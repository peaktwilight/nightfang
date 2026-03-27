import { motion } from "framer-motion";

const stages = [
  { name: "Discover", desc: "Map attack surface", color: "#3b82f6" },
  { name: "Attack", desc: "Execute 47+ probes", color: "#dc2626" },
  { name: "Verify", desc: "Kill false positives", color: "#f59e0b" },
  { name: "Report", desc: "SARIF + markdown", color: "#22c55e" },
];

export default function PipelineViz() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0">
      {stages.map((stage, i) => (
        <div key={stage.name} className="flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            className="flex flex-col items-center px-6 py-4 rounded-lg border border-white/10 bg-white/[0.02] min-w-[140px]"
          >
            <div className="w-2 h-2 rounded-full mb-2" style={{ backgroundColor: stage.color }} />
            <div className="text-white font-semibold text-sm">{stage.name}</div>
            <div className="text-white/40 text-xs mt-1">{stage.desc}</div>
          </motion.div>
          {i < stages.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 + 0.1 }}
              className="text-white/20 mx-2 hidden sm:block"
            >→</motion.div>
          )}
        </div>
      ))}
    </div>
  );
}
