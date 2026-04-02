'use client';
import { useState, useEffect } from 'react';
import { getSavedProfiles, saveProfile, deleteProfile, SavedProfile } from '@/lib/storage';

export function ProfileSelector({ onSelect, currentFormData }: {
  onSelect: (p: SavedProfile) => void;
  currentFormData: Omit<SavedProfile, 'id' | 'createdAt' | 'name'>;
}) {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    setProfiles(getSavedProfiles());
  }, []);

  const handleSave = () => {
    if (!newProfileName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    if (!currentFormData.year || !currentFormData.month || !currentFormData.day) {
      alert('생년월일을 먼저 채워주세요.');
      return;
    }

    const result = saveProfile({
      name: newProfileName.trim(),
      ...currentFormData
    });
    if (!result) return; // 저장 실패 시 (중복, 용량 초과 등) - alert는 storage.ts에서 처리
    setProfiles(getSavedProfiles());
    setNewProfileName('');
    setShowSaveInput(false);
    alert('프로필이 성공적으로 저장되었습니다.');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('정말 삭제하시겠습니까?')) {
      deleteProfile(id);
      setProfiles(getSavedProfiles());
    }
  };

  return (
    <div className="bg-[#1e1e3f] p-5 rounded-2xl border border-purple-900/30 mb-6 shadow-inner">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-purple-300 font-bold flex items-center gap-2">
          <span>👥</span> 나의 사람들
        </h3>
        <button onClick={() => setShowSaveInput(!showSaveInput)} className="text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2 rounded-lg text-white transition-all transform hover:scale-105 shadow-md">
          현재 정보 새 프로필로 저장
        </button>
      </div>

      {showSaveInput && (
        <div className="flex gap-2 mb-4 bg-black/30 p-3 rounded-lg border border-purple-900/50">
          <input 
            type="text" 
            placeholder="이름 (예: 사랑하는 어머니)" 
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 bg-[#0a0a1a] rounded px-3 py-2 border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-500"
            autoFocus
          />
          <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 font-bold rounded shadow-md transition-colors">저장</button>
        </div>
      )}

      {profiles.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-3 bg-black/20 rounded-lg">저장된 지인 프로필이 없습니다. 소중한 사람들의 명식을 저장해 보세요!</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {profiles.map(p => (
            <div key={p.id} className="relative group cursor-pointer bg-purple-900/40 hover:bg-purple-700 border border-purple-500/40 rounded-full px-4 py-1.5 transition-all flex items-center gap-2 shadow-sm" onClick={() => onSelect(p)}>
              <span className="text-purple-100 text-sm font-medium">{p.name}</span>
              <button 
                onClick={(e) => handleDelete(p.id, e)} 
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-1 transition-opacity"
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
