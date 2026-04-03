'use client';
import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

const DEVICE_KEY = 'saju_device_id';
const TRIAL_KEY = 'saju_free_trial';
const TRIAL_DURATION = 180; // 3분

// 기기 고유 ID 생성/조회
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// 무료 체험
export function getTrialState(): { started: boolean; remaining: number } {
  const raw = localStorage.getItem(TRIAL_KEY);
  if (!raw) return { started: false, remaining: TRIAL_DURATION };
  const startedAt = parseInt(raw, 10);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const remaining = Math.max(0, TRIAL_DURATION - elapsed);
  return { started: true, remaining };
}

export function startTrial() {
  localStorage.setItem(TRIAL_KEY, Date.now().toString());
}

// 이용권 가격
const TICKET_PRICES: Record<string, { label: string; amount: number; minutes: number }> = {
  '20min': { label: '20분 이용권', amount: 2000, minutes: 20 },
  '1hour': { label: '1시간 이용권', amount: 3000, minutes: 60 },
};
export function getTicketPrices() { return TICKET_PRICES; }

// 이용권 요청
export async function requestTicket(deviceId: string, type: '20min' | '1hour', nickname: string) {
  const price = TICKET_PRICES[type];
  const ticketId = deviceId + '_' + Date.now();
  await setDoc(doc(db, 'tickets', ticketId), {
    deviceId,
    nickname,
    type,
    amount: price.amount,
    status: 'pending',
    requestedAt: Date.now(),
  });
  // 텔레그램 알림
  sendTelegramAlert(nickname, type, price.amount);
  return ticketId;
}

const TG_BOT = '8727075138:AAEUD7BLQduTbAIS4TsrQcZ2eT33uGBFRrc';
const TG_CHAT = '8637298144';
function sendTelegramAlert(nickname: string, type: string, amount: number) {
  const prices: Record<string, string> = { '20min': '20분 이용권', '1hour': '1시간 이용권' };
  const text = `🔔 입금 확인 요청\n\n입금자: ${nickname}\n이용권: ${prices[type] || type}\n금액: ${amount.toLocaleString()}원\n시간: ${new Date().toLocaleString('ko')}\n\n👉 관리자 페이지에서 승인하세요`;
  fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text })
  }).catch(() => {});
}

// 활성 이용권 확인
export async function getActiveTicket(deviceId: string) {
  const q = query(
    collection(db, 'tickets'),
    where('deviceId', '==', deviceId),
    where('status', '==', 'approved')
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const t = d.data();
    if (t.expiresAt && t.expiresAt > Date.now()) return t;
    if (t.expiresAt && t.expiresAt <= Date.now()) {
      await updateDoc(d.ref, { status: 'expired' });
    }
  }
  return null;
}

// 대기 중인 결제 확인
export async function hasPendingTicket(deviceId: string) {
  const q = query(
    collection(db, 'tickets'),
    where('deviceId', '==', deviceId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// 관리자: 대기 목록
export async function getPendingTickets() {
  const q = query(collection(db, 'tickets'), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), docId: d.id }));
}

// 관리자: 승인
export async function approveTicket(docId: string) {
  const snap = await getDoc(doc(db, 'tickets', docId));
  if (!snap.exists()) return;
  const t = snap.data();
  const price = TICKET_PRICES[t.type];
  const expiresAt = Date.now() + price.minutes * 60 * 1000;
  await updateDoc(doc(db, 'tickets', docId), {
    status: 'approved',
    approvedAt: Date.now(),
    expiresAt
  });
}

// 관리자: 반려
export async function rejectTicket(docId: string) {
  await updateDoc(doc(db, 'tickets', docId), { status: 'rejected' });
}

// 접근 상태 확인
export async function checkAccess(deviceId: string): Promise<'active' | 'pending' | 'trial' | 'trial_expired' | 'free'> {
  const ticket = await getActiveTicket(deviceId);
  if (ticket) return 'active';
  const pending = await hasPendingTicket(deviceId);
  if (pending) return 'pending';
  const trial = getTrialState();
  if (!trial.started) return 'free';
  if (trial.remaining > 0) return 'trial';
  return 'trial_expired';
}
