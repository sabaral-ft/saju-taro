'use client';
import { db } from './firebase';
import {
  doc, setDoc, getDoc, updateDoc,
  collection, query, where, getDocs, orderBy, Timestamp
} from 'firebase/firestore';

export interface Ticket {
  uid: string;
  type: '30min' | '1hour' | '1day';
  status: 'pending' | 'approved' | 'expired' | 'rejected';
  requestedAt: number;
  approvedAt?: number;
  expiresAt?: number;
  amount: number;
}

export interface FreeTrialInfo {
  uid: string;
  usedAt: number;        // 맛보기 시작 시간
  expired: boolean;      // 1분 경과 여부
}

const TICKET_PRICES: Record<string, { label: string; amount: number; minutes: number }> = {
  '30min': { label: '30분 이용권', amount: 2000, minutes: 30 },
  '1hour': { label: '1시간 이용권', amount: 3000, minutes: 60 },
  '1day':  { label: '1일 이용권', amount: 5000, minutes: 1440 },
};

export function getTicketPrices() { return TICKET_PRICES; }

// 맛보기 체크 (1분)
export async function getFreeTrial(uid: string): Promise<FreeTrialInfo | null> {
  const snap = await getDoc(doc(db, 'freeTrials', uid));
  return snap.exists() ? snap.data() as FreeTrialInfo : null;
}

export async function startFreeTrial(uid: string) {
  const info: FreeTrialInfo = { uid, usedAt: Date.now(), expired: false };
  await setDoc(doc(db, 'freeTrials', uid), info);
  return info;
}

export async function expireFreeTrial(uid: string) {
  await updateDoc(doc(db, 'freeTrials', uid), { expired: true });
}

// 이용권
export async function requestTicket(uid: string, type: '30min' | '1hour' | '1day') {
  const price = TICKET_PRICES[type];
  const ticket: Ticket = {
    uid, type, status: 'pending',
    requestedAt: Date.now(),
    amount: price.amount
  };
  const id = uid + '_' + Date.now();
  await setDoc(doc(db, 'tickets', id), ticket);
  return id;
}

export async function getActiveTicket(uid: string): Promise<Ticket | null> {
  const q = query(
    collection(db, 'tickets'),
    where('uid', '==', uid),
    where('status', '==', 'approved')
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const t = d.data() as Ticket;
    if (t.expiresAt && t.expiresAt > Date.now()) return t;
    // 만료된 티켓 상태 업데이트
    if (t.expiresAt && t.expiresAt <= Date.now()) {
      await updateDoc(d.ref, { status: 'expired' });
    }
  }
  return null;
}

export async function getPendingTickets(): Promise<(Ticket & { docId: string })[]> {
  const q = query(
    collection(db, 'tickets'),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data() as Ticket, docId: d.id }));
}

export async function approveTicket(docId: string) {
  const snap = await getDoc(doc(db, 'tickets', docId));
  if (!snap.exists()) return;
  const t = snap.data() as Ticket;
  const price = TICKET_PRICES[t.type];
  const expiresAt = Date.now() + price.minutes * 60 * 1000;
  await updateDoc(doc(db, 'tickets', docId), {
    status: 'approved',
    approvedAt: Date.now(),
    expiresAt
  });
}

export async function rejectTicket(docId: string) {
  await updateDoc(doc(db, 'tickets', docId), { status: 'rejected' });
}

// 전체 사용자 목록 (관리자용)
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data());
}

// 접근 가능 여부 체크
export async function checkAccess(uid: string): Promise<'free' | 'trial' | 'trial_expired' | 'active' | 'pending' | 'none'> {
  // 활성 이용권 있는지
  const ticket = await getActiveTicket(uid);
  if (ticket) return 'active';

  // 대기 중인 결제 있는지
  const pendingQ = query(
    collection(db, 'tickets'),
    where('uid', '==', uid),
    where('status', '==', 'pending')
  );
  const pendingSnap = await getDocs(pendingQ);
  if (!pendingSnap.empty) return 'pending';

  // 무료 체험 상태
  const trial = await getFreeTrial(uid);
  if (!trial) return 'free'; // 아직 안 씀
  if (!trial.expired && (Date.now() - trial.usedAt) < 60000) return 'trial'; // 1분 이내
  return 'trial_expired'; // 1분 지남
}
