
import { SIPSEONG_EASY } from '@/lib/reading-formatters';

export function SipseongBadge({ sip, size = 'sm' }: { sip: string; size?: 'sm' | 'lg' }) {
    const info = SIPSEONG_EASY[sip];
    if (!info) return <span>{sip}</span>;
    if (size === 'lg') {
      return (
        <div className="text-center">
          <div className="text-lg font-bold text-cyan-300">{info.emoji} {sip}</div>
          <div className="text-sm text-gray-400">{info.name}</div>
        </div>
      );
    }
    return (
      <span title={info.desc} className="cursor-help">
        {info.emoji} {sip}<span className="text-gray-500 text-sm ml-0.5">({info.name})</span>
      </span>
    );
}
