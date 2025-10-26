// components/AnimatedNumber.jsx
'use client';
import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration=700, startAt=0 }) {
  const [display, setDisplay] = useState(startAt);
  const fromRef = useRef(startAt);
  const toRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = (typeof value === 'number' ? value : startAt);
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, startAt]);

  return <span className="tabular-nums">{display}</span>;
}
