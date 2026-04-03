'use client';
import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceId, getTrialState, startTrial, checkAccess } from '@/lib/device-service';

const TRIAL_DURATION = 90;

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'landing' | 'ok' | 'trial' | 'blocked' | 'pending'>('loading');
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
        // 첫 방문: 랜딩 페이지 보여주기
        setStatus('landing');
      }
    }
    init();
  }, []);

  function handleStartTrial() {
    startTrial();
    setRemaining(TRIAL_DURATION);
    setStatus('trial');
  }

  // 타이머
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

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
        <div className="text-4xl animate-pulse">🔮</div>
      </div>
    );
  }

  if (status === 'landing') {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0d0d2b] to-gray-950 flex items-center justify-center z-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🔮</div>
          <h1 className="text-2xl font-bold text-white mb-2">BT-<span className="italic font-serif">𝑥</span> 사주타로</h1>
          <p className="text-gray-400 text-sm mb-2">만세력 기반 정밀 사주 분석 + 78장 타로 카드 오행 맞춤 해석</p>
          <p className="text-purple-400 text-xs mb-8">오늘보다 나은 내일을 위한 사주 + 타로 통합 분석</p>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="text-amber-400 font-bold text-sm mb-2">✨ 무료 체험</div>
            <p className="text-gray-300 text-sm">1분 30초 동안 모든 기능을 무료로 체험해보세요</p>
            <p className="text-gray-500 text-xs mt-1">사주 분석 · 타로 리딩 · 궁합 · 오늘의 운세</p>
          </div>

          <button
            onClick={handleStartTrial}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-amber-500 text-white font-bold rounded-xl text-base mb-3 hover:opacity-90 transition"
          >
            무료 체험 시작하기
          </button>

          <div className="flex gap-2">
            <button onClick={() => router.push('/payment')}
              className="flex-1 py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">
              💎 이용권 구매
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-white mb-2">무료 체험이 끝났습니다</h2>
          <p className="text-gray-400 text-sm mb-6">이용권을 구매하시면 무제한으로<br/>사주·타로 분석을 이용하실 수 있습니다.</p>
          <button onClick={() => router.push('/payment')} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl text-sm mb-3">
            💎 이용권 구매하기
          </button>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-white mb-2">결제 승인 대기 중</h2>
          <p className="text-gray-400 text-sm mb-6">관리자가 입금 확인 후 승인합니다.<br/>잠시만 기다려주세요.</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">↻ 새로고침</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === 'trial' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-center py-1 text-xs font-bold">
          무료 체험 {remaining}초 남음
        </div>
      )}
      <div className={status === 'trial' ? 'pt-6' : ''}>
        {children}
      </div>
    </>
  );
}
