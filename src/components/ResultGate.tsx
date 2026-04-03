'use client';
import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceId, getTrialState, startTrial, checkAccess } from '@/lib/device-service';

const TRIAL_DURATION = 90;

export default function ResultGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'trial' | 'blocked' | 'pending'>('loading');
  const [remaining, setRemaining] = useState(TRIAL_DURATION);

  useEffect(() => {
    async function init() {
      const deviceId = getDeviceId();
      const access = await checkAccess(deviceId);
      if (access === 'active') setStatus('ok');
      else if (access === 'pending') setStatus('pending');
      else if (access === 'trial') {
        const trial = getTrialState();
        setRemaining(trial.remaining);
        setStatus('trial');
      } else if (access === 'trial_expired') {
        setStatus('blocked');
      } else {
        // 결과 보는 시점에 체험 시작
        startTrial();
        setRemaining(TRIAL_DURATION);
        setStatus('trial');
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (status !== 'trial') return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(timer); setStatus('blocked'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  if (status === 'loading') return null;

  if (status === 'blocked') {
    return (
      <div className="fixed inset-0 bg-gray-950/95 flex items-center justify-center z-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-white mb-2">무료 체험이 끝났습니다</h2>
          <p className="text-gray-400 text-sm mb-6">이용권을 구매하시면 무제한으로<br/>사주·타로 분석을 이용하실 수 있습니다.</p>
          <button onClick={() => router.push('/payment')} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl text-sm">
            💎 이용권 구매하기
          </button>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="fixed inset-0 bg-gray-950/95 flex items-center justify-center z-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-white mb-2">결제 승인 대기 중</h2>
          <p className="text-gray-400 text-sm mb-6">관리자가 입금 확인 후 승인합니다.</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">↻ 새로고침</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === 'trial' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-center py-1.5 text-xs font-bold">
          무료 체험 {remaining}초 남음 · 이용권 구매 시 무제한 이용
        </div>
      )}
      {children}
    </>
  );
}
