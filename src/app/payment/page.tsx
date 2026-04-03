'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceId, requestTicket, getTicketPrices, checkAccess } from '@/lib/device-service';

export default function PaymentPage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');
  const [step, setStep] = useState<'loading' | 'select' | 'account' | 'confirm' | 'waiting' | 'active'>('loading');
  const [selected, setSelected] = useState<'20min' | '1hour'>('20min');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const prices = getTicketPrices();

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    checkAccess(id).then(access => {
      console.log('access:', access);
      if (access === 'active') {
        // TrialTimer가 인식하도록 localStorage에도 저장 (1시간)
        localStorage.setItem('saju_ticket_expires', (Date.now() + 3600000).toString());
        setStep('active');
      }
      else if (access === 'pending') setStep('waiting');
      else setStep('select');
    }).catch(() => setStep('select'));
  }, []);

  function handleCopyAccount() {
    const text = '카카오뱅크 3333-06-2793057 손동호';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('계좌번호가 복사되었습니다')).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); alert('계좌번호가 복사되었습니다');
  }

  async function handleConfirm() {
    if (!nickname.trim()) { alert('입금자명을 입력해주세요'); return; }
    setLoading(true);
    await requestTicket(deviceId, selected, nickname.trim());
    setStep('waiting');
    setLoading(false);
  }

  if (step === 'loading') {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-4xl animate-pulse">💎</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-8">
      <div className="max-w-sm mx-auto">

        {/* ── 이용권 활성화 상태 ── */}
        {step === 'active' && (
          <div className="text-center pt-12">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">이용권이 활성화되어 있습니다</h2>
            <p className="text-gray-400 text-sm mb-6">사주·타로 분석을 무제한으로 이용하세요</p>
            <button onClick={() => router.push('/reading/?step=result')} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl">사주타로 시작하기</button>
          </div>
        )}

        {/* ── 승인 대기 중 ── */}
        {step === 'waiting' && (
          <div className="text-center pt-12">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-white mb-2">입금 확인 대기 중</h2>
            <p className="text-gray-400 text-sm mb-2">관리자가 입금을 확인하면 이용권이 활성화됩니다.</p>
            <p className="text-gray-500 text-xs mb-6">보통 몇 분 이내에 처리됩니다.</p>
            <button onClick={async () => {
              const access = await checkAccess(deviceId);
              if (access === 'active') {
                localStorage.setItem('saju_ticket_expires', (Date.now() + 3600000).toString());
                setStep('active');
              }
              else { alert('아직 승인 대기 중입니다. 잠시 후 다시 시도해주세요.'); }
            }} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl text-sm mb-3">↻ 승인 확인하기</button>
            <button onClick={() => router.push('/reading/')} className="text-gray-500 text-sm underline">돌아가기</button>
          </div>
        )}

        {/* ── 1단계: 이용권 선택 ── */}
        {step === 'select' && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">💎</div>
              <h1 className="text-xl font-bold text-white">이용권 선택</h1>
              <p className="text-gray-400 text-sm mt-1">원하는 이용권을 선택하세요</p>
            </div>

            <div className="space-y-3 mb-6">
              {Object.entries(prices).map(([key, p]) => (
                <button key={key} onClick={() => setSelected(key as any)}
                  className={`w-full p-5 rounded-xl border text-left transition ${selected === key ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 bg-gray-800/50'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white font-bold text-base">{p.label}</div>
                      <div className="text-gray-400 text-xs mt-1">사주 + 타로 분석 이용</div>
                    </div>
                    <div className="text-amber-400 font-bold text-xl">{p.amount.toLocaleString()}<span className="text-sm">원</span></div>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => setStep('account')}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl">
              다음 →
            </button>
            <button onClick={() => router.push('/reading/')} className="w-full mt-3 py-3 text-gray-500 text-sm">돌아가기</button>
          </>
        )}

        {/* ── 2단계: 계좌번호 안내 ── */}
        {step === 'account' && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🏦</div>
              <h1 className="text-xl font-bold text-white">입금 안내</h1>
              <p className="text-gray-400 text-sm mt-1">아래 계좌로 <span className="text-amber-400 font-bold">{prices[selected].amount.toLocaleString()}원</span>을 이체해주세요</p>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-4">
              <div className="text-center">
                <div className="text-gray-400 text-xs mb-2">입금 계좌</div>
                <div className="text-white font-bold text-lg mb-1">카카오뱅크</div>
                <div className="text-amber-400 font-bold text-2xl tracking-wider mb-1">3333-06-2793057</div>
                <div className="text-gray-400 text-sm">손동호</div>
              </div>
              <button onClick={handleCopyAccount}
                className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-bold">
                📋 계좌번호 복사
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <div className="text-amber-400 text-xs font-bold mb-1">선택한 이용권</div>
              <div className="text-white font-bold">{prices[selected].label} — {prices[selected].amount.toLocaleString()}원</div>
            </div>

            <button onClick={() => setStep('confirm')}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl">
              입금했습니다 →
            </button>
            <button onClick={() => setStep('select')} className="w-full mt-3 py-3 text-gray-500 text-sm">← 이전</button>
          </>
        )}

        {/* ── 3단계: 입금자명 확인 ── */}
        {step === 'confirm' && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✍️</div>
              <h1 className="text-xl font-bold text-white">입금 확인 요청</h1>
              <p className="text-gray-400 text-sm mt-1">입금하신 분의 이름을 정확히 입력해주세요</p>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-2 block">입금자명 <span className="text-red-400">*필수</span></label>
              <input
                type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                className="w-full px-4 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white text-base focus:border-amber-500 focus:outline-none"
                placeholder="실제 입금하신 분의 이름"
                autoFocus
              />
              {!nickname.trim() && <p className="text-red-400 text-xs mt-2">입금자명을 입력해야 승인이 가능합니다</p>}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 text-sm">
              <div className="flex justify-between text-gray-400 mb-1">
                <span>이용권</span><span className="text-white font-bold">{prices[selected].label}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>금액</span><span className="text-amber-400 font-bold">{prices[selected].amount.toLocaleString()}원</span>
              </div>
            </div>

            <button onClick={handleConfirm} disabled={loading || !nickname.trim()}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-xl disabled:opacity-50">
              {loading ? '처리 중...' : '입금 확인 요청하기'}
            </button>
            <button onClick={() => setStep('account')} className="w-full mt-3 py-3 text-gray-500 text-sm">← 이전</button>
          </>
        )}

      </div>
    </div>
  );
}
