import { motion } from "framer-motion";

export default function FluidBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main crimson orb — clearly visible, slow moving */}
      <motion.div
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[10%] left-[20%] w-[700px] h-[700px] rounded-full bg-[#DC2626]/[0.12] blur-[150px]"
      />
      {/* Secondary orb — offset timing */}
      <motion.div
        animate={{
          x: [0, -60, 30, 0],
          y: [0, 30, -50, 0],
          scale: [1, 0.85, 1.1, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[10%] right-[15%] w-[500px] h-[500px] rounded-full bg-[#DC2626]/[0.08] blur-[130px]"
      />
      {/* Subtle white orb for depth */}
      <motion.div
        animate={{
          x: [0, 20, -20, 0],
          y: [0, -20, 20, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[40%] right-[30%] w-[400px] h-[400px] rounded-full bg-white/[0.02] blur-[100px]"
      />
    </div>
  );
}
