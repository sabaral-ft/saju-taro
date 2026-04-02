'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser, loginUser } from '@/lib/auth-service';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (password !== password2) { setError('비밀번호가 일치하지 않습니다'); setLoading(false); return; }
        if (!name.trim()) { setError('이름을 입력해주세요'); setLoading(false); return; }
        await registerUser(email, password, name);
      } else {
        await loginUser(email, password);
      }
      router.push('/reading');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') setError('이미 등록된 이메일입니다');
      else if (code === 'auth/invalid-email') setError('올바른 이메일 형식이 아닙니다');
      else if (code === 'auth/weak-password') setError('비밀번호는 6자 이상 입력해주세요');
      else if (code === 'auth/invalid-credential') setError('이메일 또는 비밀번호가 틀립니다');
      else setError('오류가 발생했습니다: ' + (err?.message || ''));
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔮</div>
          <h1 className="text-2xl font-bold text-white">사주타로</h1>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? '로그인하여 시작하세요' : '새 계정을 만드세요'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">이름</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                placeholder="홍길동" required
              />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 mb-1 block">이메일</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="example@email.com" required
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="6자 이상" required minLength={6}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">비밀번호 확인</label>
              <input
                type="password" value={password2} onChange={e => setPassword2(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                placeholder="비밀번호 재입력" required minLength={6}
              />
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-lg text-sm disabled:opacity-50 transition"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>

          <div className="text-center text-sm">
            {mode === 'login' ? (
              <span className="text-gray-400">계정이 없으신가요? <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-amber-400 underline">회원가입</button></span>
            ) : (
              <span className="text-gray-400">이미 계정이 있으신가요? <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-amber-400 underline">로그인</button></span>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-gray-600 mt-4">무료 1분 체험 후 이용권 구매</p>
      </div>
    </div>
  );
}
