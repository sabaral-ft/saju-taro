'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceId, checkAccess } from '@/lib/device-service';

const TRIAL_KEY = 'saju_free_trial';
const TICKET_KEY = 'saju_ticket_expires';
const TRIAL_DURATION = 180;

export default function TrialTimer() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'trial' | 'blocked'>('loading');
  const [remaining, setRemaining] = useState(TRIAL_DURATION);

  useEffect(() => {
    async function check() {
      // 1) localStorage 이용권 체크
      const ticketExpires = localStorage.getItem(TICKET_KEY);
      if (ticketExpires && parseInt(ticketExpires) > Date.now()) {
        setStatus('ok');
        return;
      }

      // 2) Firebase 이용권 체크
      try {
        const deviceId = getDeviceId();
        const access = await checkAccess(deviceId);
        if (access === 'active') {
          localStorage.setItem(TICKET_KEY, (Date.now() + 3600000).toString());
          setStatus('ok');
          return;
        }
      } catch {}

      // 3) 무료 체험 체크
      const raw = localStorage.getItem(TRIAL_KEY);
      if (!raw) {
        localStorage.setItem(TRIAL_KEY, Date.now().toString());
        setRemaining(TRIAL_DURATION);
        setStatus('trial');
      } else {
        const startedAt = parseInt(raw, 10);
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const rem = Math.max(0, TRIAL_DURATION - elapsed);
        if (rem > 0) {
          setRemaining(rem);
          setStatus('trial');
        } else {
          setStatus('blocked');
        }
      }
    }
    check();
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

  if (status === 'loading' || status === 'ok') return null;

  if (status === 'blocked') {
    return (
      <div className="fixed inset-0 bg-gray-950/95 flex items-center justify-center z-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-white mb-2">무료 체험이 끝났습니다</h2>
          <p className="text-gray-400 text-sm mb-6">이용권을 구매하시면 무제한으로<br/>사주·타로 분석을 이용하실 수 있습니다.</p>
          <button onClick={() => router.push('/payment/')} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl text-sm">
            💎 이용권 구매하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-center py-1.5 text-xs font-bold">
      무료 체험 {remaining}초 남음
    </div>
  );
}
