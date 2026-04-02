// src/lib/storage.ts
'use client';

import { safeGetItem, safeSetItem } from '@/lib/date-validator';

export interface SavedProfile {
  id: string; // 고유 ID (시간 기반 UUID)
  name: string; // 저장할 이름 (예: 어머니, 내 친구 아무개)
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  calendarType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  gender: 'male' | 'female';
  relationship: 'single' | 'dating' | 'married';
  hasChildren: boolean;
  birthCity: string;
  useYajasi?: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'saju_profiles';
const MAX_PROFILES = 50; // 프로필 최대 개수 제한

export function getSavedProfiles(): SavedProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = safeGetItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    // 배열인지 유효성 체크
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('프로필 데이터 파싱 실패:', e);
    return [];
  }
}

export function saveProfile(profile: Omit<SavedProfile, 'id' | 'createdAt'>): SavedProfile | null {
  const profiles = getSavedProfiles();

  // 최대 개수 체크
  if (profiles.length >= MAX_PROFILES) {
    alert(`프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있습니다.`);
    return null;
  }

  // 중복 이름 체크
  if (profiles.some(p => p.name === profile.name)) {
    alert(`'${profile.name}' 이름의 프로필이 이미 존재합니다. 다른 이름을 사용해주세요.`);
    return null;
  }

  const newProfile: SavedProfile = {
    ...profile,
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
  };
  profiles.push(newProfile);

  const success = safeSetItem(STORAGE_KEY, JSON.stringify(profiles));
  if (!success) {
    alert('저장 공간이 부족합니다. 사용하지 않는 프로필을 삭제해주세요.');
    return null;
  }
  return newProfile;
}

export function updateProfile(id: string, updates: Partial<SavedProfile>): SavedProfile[] {
  const profiles = getSavedProfiles();
  const index = profiles.findIndex(p => p.id === id);
  if (index !== -1) {
    profiles[index] = { ...profiles[index], ...updates };
    safeSetItem(STORAGE_KEY, JSON.stringify(profiles));
  }
  return profiles;
}

export function deleteProfile(id: string): SavedProfile[] {
  const profiles = getSavedProfiles().filter(p => p.id !== id);
  safeSetItem(STORAGE_KEY, JSON.stringify(profiles));
  return profiles;
}

// ========== 마지막 분석 데이터 자동 저장/불러오기 ==========

export interface LastAnalysisData {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: 'male' | 'female';
  relationship: 'single' | 'dating' | 'married';
  hasChildren: boolean;
  birthCity: string;
  useYajasi: boolean;
  calendarType: 'solar' | 'lunar';
  isLeapMonth: boolean;
  savedAt: number;
}

declare global {
  interface Window { __btx_lastAnalysis?: LastAnalysisData; }
}

export function saveLastAnalysis(data: Omit<LastAnalysisData, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const full = { ...data, savedAt: Date.now() };
  window.__btx_lastAnalysis = full;
  // localStorage도 시도 (가능한 환경에서는 새로고침 후에도 유지)
  try { safeSetItem('saju_last_analysis', JSON.stringify(full)); } catch {}
}

export function getLastAnalysis(): LastAnalysisData | null {
  if (typeof window === 'undefined') return null;
  // 먼저 메모리에서 확인 (확실)
  if (window.__btx_lastAnalysis) return window.__btx_lastAnalysis;
  // 메모리에 없으면 localStorage 시도
  try {
    const raw = safeGetItem('saju_last_analysis');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    window.__btx_lastAnalysis = parsed;
    return parsed;
  } catch {
    return null;
  }
}
