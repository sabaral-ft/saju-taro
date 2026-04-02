'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuth } from '@/lib/auth-service';
import { requestTicket, getTicketPrices, checkAccess } from '@/lib/ticket-service';

export default function PaymentPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [selected, setSelected] = useState<'20min' | '1hour'>('20min');
  const [status, setStatus] = useState<'select' | 'requested' | 'active'>('select');
  const [loading, setLoading] = useState(false);
  const prices = getTicketPrices();

  useEffect(() => {
    const unsub = onAuth(async (user) => {
      if (!user) { router.push('/login'); return; }
      setUid(user.uid);
      const access = await checkAccess(user.uid);
      if (access === 'active') setStatus('active');
      else if (access === 'pending') setStatus('requested');
    });
    return unsub;
  }, [router]);

  async function handleRequest() {
    if (!uid) return;
    setLoading(true);
    await requestTicket(uid, selected);
    setStatus('requested');
    setLoading(false);
  }

  if (!uid) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-8">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💎</div>
          <h1 className="text-xl font-bold text-white">이용권 구매</h1>
          <p className="text-gray-400 text-sm mt-1">계좌이체 후 결제 완료 요청을 해주세요</p>
        </div>

        {status === 'active' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center mb-6">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-green-400 font-bold">이용권이 활성화되어 있습니다</p>
            <button onClick={() => router.push('/reading')} className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg font-bold text-sm">사주타로 시작</button>
          </div>
        )}

        {status === 'requested' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center mb-6">
            <div className="text-2xl mb-2">⏳</div>
            <p className="text-amber-400 font-bold">결제 승인 대기 중</p>
            <p className="text-gray-400 text-sm mt-2">관리자가 확인 후 승인합니다.<br/>잠시만 기다려주세요.</p>
            <button onClick={() => router.push('/reading')} className="mt-4 px-6 py-2 bg-gray-700 text-white rounded-lg text-sm">돌아가기</button>
          </div>
        )}

        {status === 'select' && (
          <>
            {/* 이용권 선택 */}
            <div className="space-y-3 mb-6">
              {Object.entries(prices).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setSelected(key as any)}
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    selected === key
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white font-bold">{p.label}</div>
                      <div className="text-gray-400 text-xs mt-1">무제한 사주 + 타로 분석</div>
                    </div>
                    <div className="text-amber-400 font-bold text-lg">{p.amount.toLocaleString()}원</div>
                  </div>
                </button>
              ))}
            </div>

            {/* 계좌 정보 */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-6">
              <div className="text-xs text-gray-400 mb-3 font-bold">입금 계좌</div>
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <div className="text-white font-bold text-lg">카카오뱅크 3333-12-3456789</div>
                <div className="text-gray-400 text-sm mt-1">손동호</div>
              </div>
              <div className="text-xs text-gray-500 mt-3 leading-relaxed">
                * 선택한 이용권 금액을 입금해주세요<br/>
                * 입금자명은 가입 시 이름과 동일하게<br/>
                * 입금 후 아래 버튼을 눌러주세요
              </div>
            </div>

            <button
              onClick={handleRequest}
              disabled={loading}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl text-sm disabled:opacity-50 transition"
            >
              {loading ? '요청 중...' : `${prices[selected].label} 결제 완료 요청 (${prices[selected].amount.toLocaleString()}원)`}
            </button>

            <button onClick={() => router.push('/reading')} className="w-full mt-3 py-3 text-gray-400 text-sm">
              돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
