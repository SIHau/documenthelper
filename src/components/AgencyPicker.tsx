import type { Agency } from '../db/types';

/** 從通訊錄挑選，附加到以「、」分隔的欄位 */
export function AgencyPicker({ agencies, value, onChange }: {
  agencies: Agency[];
  value: string;
  onChange: (next: string) => void;
}) {
  if (!agencies.length) return null;
  return (
    <select className="picker" value="" aria-label="從通訊錄加入"
      onChange={(e) => {
        const name = e.target.value;
        if (!name) return;
        const list = value.split('、').map((s) => s.trim()).filter(Boolean);
        if (!list.includes(name)) list.push(name);
        onChange(list.join('、'));
      }}>
      <option value="">＋通訊錄</option>
      {agencies.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
    </select>
  );
}
