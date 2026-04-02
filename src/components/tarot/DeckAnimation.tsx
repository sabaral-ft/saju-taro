'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useMemo, useCallback } from 'react';

export function DeckAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'shuffling' | 'drawing'>('shuffling');
  const prefersReducedMotion = useReducedMotion();

  // onComplete를 안정적으로 참조 (stale closure 방지)
  const stableOnComplete = useCallback(onComplete, [onComplete]);

  useEffect(() => {
    // 모션 축소 모드: 즉시 완료
    if (prefersReducedMotion) {
      stableOnComplete();
      return;
    }

    // 2.5초간 셔플, 2초간 뽑기 연출 후 완료
    const timer1 = setTimeout(() => setPhase('drawing'), 2500);
    const timer2 = setTimeout(() => {
      stableOnComplete();
    }, 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [stableOnComplete, prefersReducedMotion]);

  // 카드 위치를 메모이제이션 (렌더링마다 랜덤 변경 방지)
  const cardPositions = useMemo(() =>
    Array.from({ length: 15 }, () => ({
      x: (Math.random() - 0.5) * 250,
      y: (Math.random() - 0.5) * 60,
      rotate: (Math.random() - 0.5) * 45,
    })),
    []
  );

  // 모션 축소 모드: 정적 표시
  if (prefersReducedMotion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] w-full bg-[#050510] rounded-2xl border border-purple-900/30 shadow-2xl p-8">
        <div className="text-5xl mb-4" aria-hidden="true">🔮</div>
        <h3 className="text-xl text-purple-300 font-bold text-center">
          카드를 선택하고 있습니다...
        </h3>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[400px] w-full relative overflow-hidden bg-[#050510] rounded-2xl border border-purple-900/30 shadow-2xl"
      role="status"
      aria-label="타로 카드 셔플 중"
    >
      <h3 className="absolute top-8 text-xl text-purple-300 font-bold mb-8 animate-pulse text-center px-4">
        {phase === 'shuffling'
          ? '우주의 에너지를 카드에 담아 섞는 중입니다...'
          : '당신의 운명을 보여줄 카드가 선택되었습니다...'}
      </h3>

      <div className="relative w-full h-[300px] flex items-center justify-center mt-12">
        {cardPositions.map((pos, i) => {
          const isDrawing = phase === 'drawing';
          const drawCard = i === 7;

          return (
            <motion.div
              key={i}
              className={`absolute w-24 md:w-32 h-36 md:h-48 rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-indigo-900 via-purple-900 to-black ${drawCard && isDrawing ? 'z-50 shadow-[0_0_40px_rgba(217,119,6,0.8)]' : 'z-10'}`}
              initial={{ x: 0, y: 0, rotate: 0, scale: 1 }}
              animate={
                phase === 'shuffling'
                  ? {
                      x: [0, pos.x, 0],
                      y: [0, pos.y, 0],
                      rotate: [0, pos.rotate, 0],
                      transition: { duration: 0.4, repeat: 5, repeatType: 'reverse' as const, ease: 'easeInOut' }
                    }
                  : drawCard
                  ? {
                      x: 0,
                      y: -50,
                      scale: 1.6,
                      rotate: 180,
                      transition: { duration: 1.2, ease: 'easeOut', delay: 0.2 }
                    }
                  : {
                      x: (i - 7) * 45,
                      y: 80,
                      opacity: 0.1,
                      rotate: (i - 7) * 3,
                      transition: { duration: 0.8, ease: 'easeOut' }
                    }
              }
              aria-hidden="true"
            >
              <div className="w-full h-full flex items-center justify-center border-[3px] border-amber-900/30 rounded-lg inset-1 absolute pointer-events-none">
                <div className="text-amber-500/30 text-5xl">✧</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
