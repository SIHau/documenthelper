import type { Direction } from '../model/types';

export interface PhraseGroup {
  id: string;
  title: string;
  phrases: string[];
}

/** 期望語依行文方向分類（主旨結尾用） */
export const EXPECTATIONS: Record<Direction, string[]> = {
  上行: ['請鑒核。', '請核示。', '請鑒察。', '請核備。', '請核定。', '請准予備查。'],
  平行: ['請查照。', '請查照轉知。', '請查照辦理。', '請惠予協助。', '請惠復。', '請同意。'],
  下行: ['請查照。', '請照辦。', '請查照轉知。', '請依限辦理。', '請辦理見復。', '請確實辦理。'],
};

/** 各方向不宜使用的期望語（用語檢查使用） */
export const UPWARD_ONLY = ['請鑒核', '請核示', '請鑒察', '請核備', '請准予備查', '敬請核示'];
export const DOWNWARD_ONLY = ['請照辦', '請辦理見復', '請確實辦理', '請依限辦理', '請轉知所屬', '請遵照'];
export const NOT_UPWARD = ['請查照', '請察照', '請照辦', '請惠允'];

export const PHRASE_GROUPS: PhraseGroup[] = [
  {
    id: 'subject',
    title: '主旨句型',
    phrases: [
      '檢送○○○一案，',
      '有關○○○一案，',
      '為辦理○○○，',
      '函請貴單位協助○○○，',
      '茲訂於○年○月○日召開○○○會議，',
      '檢陳○○○，',
    ],
  },
  {
    id: 'cite',
    title: '引敘（說明起首）',
    phrases: [
      '依據貴單位○年○月○日○○字第○○○號函辦理。',
      '復貴單位○年○月○日○○字第○○○號函。',
      '依○○○法第○條規定辦理。',
      '奉○○○○年○月○日○○字第○○○號指示辦理。',
      '茲因○○○，',
    ],
  },
  {
    id: 'transition',
    title: '敘述與過渡',
    phrases: [
      '案內○○○，',
      '查○○○，',
      '為利○○○，',
      '請於○年○月○日前回復。',
      '檢附○○○各○份。',
      '如有疑義，請洽承辦人。',
    ],
  },
  {
    id: 'closing',
    title: '結尾',
    phrases: [
      '敬請惠予配合。',
      '本案業已辦理完竣，特此函復。',
      '特此公告。',
      '以上，敬請鑒核。',
      '併請查照。',
    ],
  },
];
