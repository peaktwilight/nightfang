import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SubTask {
  text: string;
}

interface Phase {
  id: string;
  number: string;
  label: string;
  color: string;
  colorDim: string;
  subtasks: SubTask[];
}

const phases: Phase[] = [
  {
    id: 'discover',
    number: '01',
    label: 'DISCOVER',
    color: '#10b981',
    colorDim: 'rgba(16, 185, 129, 0.3)',
    subtasks: [
      { text: 'Probing target...' },
      { text: 'System prompt extracted' },
      { text: '3 endpoints mapped' },
    ],
  },
  {
    id: 'attack',
    number: '02',
    label: 'ATTACK',
    color: '#f59e0b',
    colorDim: 'rgba(245, 158, 11, 0.3)',
    subtasks: [
      { text: 'Reading source code...' },
      { text: 'Crafting injection payload...' },
      { text: 'Response analyzed' },
    ],
  },
  {
    id: 'verify',
    number: '03',
    label: 'VERIFY',
    color: '#3b82f6',
    colorDim: 'rgba(59, 130, 246, 0.3)',
    subtasks: [
      { text: 'Re-exploiting finding...' },
      { text: 'Confirmed: exploitable' },
      { text: 'False positive killed' },
    ],
  },
  {
    id: 'report',
    number: '04',
    label: 'REPORT',
    color: '#a855f7',
    colorDim: 'rgba(168, 85, 247, 0.3)',
    subtasks: [
      { text: 'SARIF generated' },
      { text: 'Markdown report ready' },
    ],
  },
];

// Each phase gets 2s. Within that 2s, subtasks appear staggered.
const PHASE_DURATION = 2000;
const TOTAL_DURATION = PHASE_DURATION * phases.length;

type TaskStatus = 'pending' | 'active' | 'done';

function StatusIcon({ status, color }: { status: TaskStatus; color: string }) {
  if (status === 'pending') {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: 'rgba(107, 114, 128, 0.5)' }}
      />
    );
  }
  if (status === 'active') {
    return (
      <motion.span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    );
  }
  // done
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M2 5.5L4 7.5L8 3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhaseStatusIcon({ status, color }: { status: TaskStatus; color: string }) {
  if (status === 'pending') {
    return (
      <div
        className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: 'rgba(107, 114, 128, 0.3)' }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: 'rgba(107, 114, 128, 0.4)' }}
        />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: color }}
      >
        <motion.div
          className="w-3 h-3 rounded-full"
          style={{ border: `2px solid ${color}`, borderTopColor: 'transparent' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }
  // done
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{ backgroundColor: color }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 7.5L5.5 10L11 4"
          stroke="#0a0a0a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function AgentPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intersection observer to start animation on scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  // Animation timer — loops every TOTAL_DURATION
  useEffect(() => {
    if (!isVisible) return;

    const start = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed((Date.now() - start) % TOTAL_DURATION);
    }, 80);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible]);

  function getPhaseStatus(phaseIndex: number): TaskStatus {
    const phaseStart = phaseIndex * PHASE_DURATION;
    const phaseEnd = phaseStart + PHASE_DURATION;
    if (elapsed < phaseStart) return 'pending';
    if (elapsed < phaseEnd) return 'active';
    return 'done';
  }

  function getSubtaskStatus(phaseIndex: number, subtaskIndex: number, totalSubtasks: number): TaskStatus {
    const phaseStart = phaseIndex * PHASE_DURATION;
    const subtaskInterval = PHASE_DURATION / (totalSubtasks + 1);
    const subtaskStart = phaseStart + subtaskInterval * (subtaskIndex + 0.5);
    const subtaskDone = phaseStart + subtaskInterval * (subtaskIndex + 1.5);

    if (elapsed < subtaskStart) return 'pending';
    if (elapsed < subtaskDone) return 'active';
    return 'done';
  }

  return (
    <div ref={containerRef} className="max-w-xl mx-auto py-8">
      <div className="relative">
        {/* Vertical timeline line */}
        <div
          className="absolute left-[15px] top-0 bottom-0 w-px"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        />

        {phases.map((phase, phaseIdx) => {
          const phaseStatus = getPhaseStatus(phaseIdx);
          const isActive = phaseStatus === 'active';
          const isDone = phaseStatus === 'done';

          return (
            <div key={phase.id} className="relative mb-8 last:mb-0">
              {/* Phase header */}
              <div className="flex items-center gap-4 mb-3">
                <div className="relative z-10">
                  <PhaseStatusIcon status={phaseStatus} color={phase.color} />
                </div>
                <div>
                  <span
                    className="text-[10px] uppercase tracking-widest block"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      color: isActive || isDone ? phase.color : '#6b7280',
                    }}
                  >
                    {phase.number}
                  </span>
                  <span
                    className="text-sm font-bold tracking-wide"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      color: isActive || isDone ? '#ffffff' : '#6b7280',
                    }}
                  >
                    {phase.label}
                  </span>
                </div>

                {/* Active glow */}
                {isActive && (
                  <motion.div
                    className="h-px flex-1"
                    style={{ backgroundColor: phase.color }}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 0.3, scaleX: 1 }}
                    transition={{ duration: 0.4 }}
                  />
                )}
              </div>

              {/* Subtasks */}
              <div className="ml-[47px] space-y-1.5">
                <AnimatePresence>
                  {phase.subtasks.map((task, taskIdx) => {
                    const taskStatus = getSubtaskStatus(phaseIdx, taskIdx, phase.subtasks.length);
                    if (taskStatus === 'pending' && !isDone) return null;

                    return (
                      <motion.div
                        key={task.text}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-2.5"
                      >
                        <StatusIcon status={taskStatus} color={phase.color} />
                        <span
                          className="text-xs"
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            color:
                              taskStatus === 'active'
                                ? '#ffffff'
                                : taskStatus === 'done'
                                  ? phase.color
                                  : '#6b7280',
                          }}
                        >
                          {task.text}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Connector line overlay for active phase */}
              {isActive && (
                <motion.div
                  className="absolute left-[15px] top-0 w-px"
                  style={{ backgroundColor: phase.color }}
                  initial={{ height: 0 }}
                  animate={{ height: '100%' }}
                  transition={{ duration: PHASE_DURATION / 1000, ease: 'linear' }}
                />
              )}
              {isDone && (
                <div
                  className="absolute left-[15px] top-0 w-px h-full"
                  style={{ backgroundColor: phase.color }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
