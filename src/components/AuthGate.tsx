'use client';
import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { onAuth, getUserProfile, logoutUser } from '@/lib/auth-service';
import { checkAccess } from '@/lib/ticket-service';

const TRIAL_KEY = 'saju_free_trial';
const TRIAL_DURATION = 90; // 90초 = 1분 30초

function getTrialState(): { started: boolean; remaining: number } {
  const raw = localStorage.getItem(TRIAL_KEY);
  if (!raw) return { started: false, remaining: TRIAL_DURATION };
  const startedAt = parseInt(raw, 10);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const remaining = Math.max(0, TRIAL_DURATION - elapsed);
  return { started: true, remaining };
}

function startTrial() {
  localStorage.setItem(TRIAL_KEY, Date.now().toString());
}

interface Props {
  children: ReactNode;
}

export default function AuthGate({ children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'trial' | 'blocked'>('loading');
  const [remaining, setRemaining] = useState(TRIAL_DURATION);
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 먼저 로그인 상태 확인
    const unsub = onAuth(async (user) => {
      if (user) {
        // 로그인된 사용자
        setIsLoggedIn(true);
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setUserName(profile.name);
          setIsAdmin(profile.role === 'admin');
          if (profile.role === 'admin') { setStatus('ok'); return; }
        }
        const access = await checkAccess(user.uid);
        if (access === 'active') { setStatus('ok'); return; }
        if (access === 'pending') { setStatus('blocked'); return; }
      }

      // 비로그인 또는 이용권 없는 사용자 → 무료 체험 체크
      const trial = getTrialState();
      if (!trial.started) {
        // 첫 방문: 체험 시작
        startTrial();
        setRemaining(TRIAL_DURATION);
        setStatus('trial');
      } else if (trial.remaining > 0) {
        // 체험 중
        setRemaining(trial.remaining);
        setStatus('trial');
      } else {
        // 체험 만료
        setStatus('blocked');
      }
    });
    return unsub;
  }, [router]);

  // 타이머
  useEffect(() => {
    if (status !== 'trial') return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('blocked');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🔮</div>
          <div className="text-gray-400 text-sm">로딩 중...</div>
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
          <p className="text-gray-400 text-sm mb-6">
            이용권을 구매하시면 무제한으로<br/>사주·타로 분석을 이용하실 수 있습니다.
          </p>
          <button
            onClick={() => router.push('/payment')}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl text-sm mb-3"
          >
            💎 이용권 구매하기
          </button>
          {!isLoggedIn && (
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm mb-3"
            >
              이미 이용권이 있다면 로그인
            </button>
          )}
          {isLoggedIn && (
            <button
              onClick={() => { logoutUser(); window.location.reload(); }}
              className="text-gray-500 text-sm underline"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <span className="text-sm font-bold text-white">{userName || '사용자'}</span>
              {isAdmin && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">관리자</span>}
            </>
          ) : (
            <span className="text-sm text-gray-400">무료 체험 중</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {status === 'trial' && (
            <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-lg">
              <span className="text-red-400 text-xs font-bold">체험 {remaining}초</span>
            </div>
          )}
          {isAdmin && (
            <button onClick={() => router.push('/admin')} className="text-amber-400 text-xs font-bold">👑 관리</button>
          )}
          {isLoggedIn ? (
            <button onClick={() => { logoutUser(); window.location.reload(); }} className="text-gray-400 text-xs">로그아웃</button>
          ) : (
            <button onClick={() => router.push('/login')} className="text-amber-400 text-xs font-bold">로그인</button>
          )}
        </div>
      </div>
      <div className="pt-10">
        {children}
      </div>
    </>
  );
}
