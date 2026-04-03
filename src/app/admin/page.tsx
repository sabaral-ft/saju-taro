'use client';
import { useState } from 'react';
import { getPendingTickets, approveTicket, rejectTicket, getTicketPrices } from '@/lib/device-service';

const ADMIN_PW = '7122';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const prices = getTicketPrices();

  async function refresh() {
    setLoading(true);
    const p = await getPendingTickets();
    setPending(p);
    setLoading(false);
  }

  function handleLogin() {
    if (pw === ADMIN_PW) { setAuthed(true); refresh(); }
    else alert('비밀번호 오류');
  }

  async function handleApprove(docId: string) {
    await approveTicket(docId);
    await refresh();
  }

  async function handleReject(docId: string) {
    await rejectTicket(docId);
    await refresh();
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-xs text-center">
          <div className="text-4xl mb-4">👑</div>
          <h2 className="text-lg font-bold text-white mb-4">관리자 인증</h2>
          <input
            type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm mb-3 focus:border-amber-500 focus:outline-none"
            placeholder="관리자 비밀번호"
          />
          <button onClick={handleLogin} className="w-full py-3 bg-amber-500 text-gray-900 font-bold rounded-lg text-sm">확인</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">👑 결제 승인 관리</h1>
          <button onClick={refresh} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-xs">
            {loading ? '...' : '↻ 새로고침'}
          </button>
        </div>

        {pending.length === 0 ? (
          <div className="text-center text-gray-500 py-12">승인 대기 없음</div>
        ) : (
          <div className="space-y-3">
            {pending.map((p: any) => (
              <div key={p.docId} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-white font-bold">{p.nickname || '미입력'}</span>
                    <span className="text-gray-500 text-xs ml-2">{p.deviceId?.slice(0, 15)}...</span>
                  </div>
                  <span className="text-amber-400 font-bold">{p.amount?.toLocaleString()}원</span>
                </div>
                <div className="text-gray-400 text-xs mb-3">
                  {prices[p.type]?.label || p.type} · {new Date(p.requestedAt).toLocaleString('ko')}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(p.docId)} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold">승인</button>
                  <button onClick={() => handleReject(p.docId)} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-bold">반려</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
