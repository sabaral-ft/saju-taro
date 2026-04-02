'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuth, getUserProfile, logoutUser } from '@/lib/auth-service';
import { getPendingTickets, approveTicket, rejectTicket, getAllUsers, getTicketPrices } from '@/lib/ticket-service';

interface PendingItem {
  docId: string;
  uid: string;
  type: string;
  amount: number;
  requestedAt: number;
  userName?: string;
  userEmail?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<'pending' | 'users'>('pending');
  const [loading, setLoading] = useState(true);
  const prices = getTicketPrices();

  useEffect(() => {
    const unsub = onAuth(async (user) => {
      if (!user) { router.push('/login'); return; }
      const profile = await getUserProfile(user.uid);
      if (!profile || profile.role !== 'admin') { router.push('/reading'); return; }
      setIsAdmin(true);
      await refresh();
      setLoading(false);
    });
    return unsub;
  }, [router]);

  async function refresh() {
    const [p, u] = await Promise.all([getPendingTickets(), getAllUsers()]);
    const enriched = p.map(t => {
      const usr = u.find((x: any) => x.uid === t.uid);
      return { ...t, userName: usr?.name || '?', userEmail: usr?.email || '?' };
    });
    setPending(enriched);
    setUsers(u);
  }

  async function handleApprove(docId: string) {
    await approveTicket(docId);
    await refresh();
  }

  async function handleReject(docId: string) {
    await rejectTicket(docId);
    await refresh();
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">로딩 중...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">👑 관리자</h1>
            <p className="text-gray-400 text-xs">결제 승인 · 사용자 관리</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/reading')} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-xs">← 앱</button>
            <button onClick={() => { logoutUser(); router.push('/login'); }} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 text-xs">🚪</button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'pending' ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
            승인 대기 {pending.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
          </button>
          <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'users' ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
            전체 사용자 ({users.length})
          </button>
        </div>

        {/* 승인 대기 */}
        {tab === 'pending' && (
          <div className="space-y-3">
            {pending.length === 0 && <div className="text-center text-gray-500 py-8">승인 대기 없음</div>}
            {pending.map(p => (
              <div key={p.docId} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-white font-bold">{p.userName}</span>
                    <span className="text-gray-500 text-xs ml-2">{p.userEmail}</span>
                  </div>
                  <span className="text-amber-400 font-bold">{p.amount.toLocaleString()}원</span>
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

        {/* 사용자 목록 */}
        {tab === 'users' && (
          <div className="space-y-2">
            {users.map((u: any) => (
              <div key={u.uid} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-sm">{u.name}</div>
                  <div className="text-gray-500 text-xs">{u.email}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {u.role === 'admin' ? '관리자' : '사용자'}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={refresh} className="w-full mt-6 py-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-sm">
          ↻ 새로고침
        </button>
      </div>
    </div>
  );
}
