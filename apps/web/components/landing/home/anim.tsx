"use client";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ children, className, delay = 0, y = 28 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Text that rises into place from behind a mask the first time it's seen.
 * The outer span watches the viewport; the inner one starts clipped below it.
 */
export function Rise({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="-mb-[0.2em] inline-block overflow-hidden pb-[0.2em] pr-[0.08em] align-bottom"
      initial={reduce ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      <motion.span className="inline-block" variants={{ hidden: { y: "115%" }, shown: { y: 0 } }} transition={{ duration: 1, delay, ease: EASE_OUT }}>
        {children}
      </motion.span>
    </motion.span>
  );
}

/** A hairline that draws itself from left to right when it scrolls into view. */
export function DrawLine({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`h-px origin-left bg-white/10 ${className}`}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.4, delay, ease: EASE_OUT }}
    />
  );
}

/** A ref plus whether that element has (once) scrolled into view. */
export function useSeen<T extends Element>(amount = 0.35) {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, amount });
  return [ref, seen] as const;
}

/**
 * Steps from 0 up to `count`, one step per `interval` ms while `active`.
 * With `loop`, it holds on the last step for `rest` extra ticks, then starts over.
 * Visitors who prefer reduced motion get the finished state straight away.
 */
export function useStepper(active: boolean, count: number, { interval = 900, loop = false, rest = 4 } = {}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active || reduce) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s < count + (loop ? rest : 0)) return s + 1;
        return loop ? 0 : s;
      });
    }, interval);
    return () => clearInterval(id);
  }, [active, reduce, count, interval, loop, rest]);

  return reduce ? count : Math.min(step, count);
}

/** Counts up from 0 to `to` once `start` is true. */
export function CountUp({ to, start, format = (n: number) => n.toLocaleString("en-IN") }: { to: number; start: boolean; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start || reduce) return;
    const controls = animate(0, to, { duration: 1.8, ease: EASE_OUT, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [start, reduce, to]);

  return <>{format(reduce ? to : value)}</>;
}
