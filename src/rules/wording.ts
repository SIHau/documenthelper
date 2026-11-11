/**
 * 用字與用語對照。資料來源（皆在 .claude/skills/documenthelper/references/source/ 有 Markdown 版）：
 * - 文書處理手冊 附錄 2「法律統一用字表」
 * - 公文寫作「公文寫作常見問題」
 * - 公文書寫作實務「函／簽錯誤態樣及改進建議」
 */
export interface WordingRule {
  /** 要找的字詞 */
  find: string;
  /** 建議改成 */
  suggest: string;
  /** 說明與出處 */
  note: string;
  /** warn：用字錯誤；info：用語建議 */
  severity: 'warn' | 'info';
  /** 只在這些文種檢查（預設全部） */
  types?: string[];
}

export const WORDING: WordingRule[] = [
  // 用字（法律統一用字表、公文寫作常見問題）
  { find: '回覆', suggest: '回復', note: '公文用「回復」（公文寫作）', severity: 'warn' },
  { find: '公佈', suggest: '公布', note: '法律統一用字：布', severity: 'warn' },
  { find: '發佈', suggest: '發布', note: '法律統一用字：布', severity: 'warn' },
  { find: '頒佈', suggest: '頒布', note: '法律統一用字：布', severity: 'warn' },
  { find: '分佈', suggest: '分布', note: '法律統一用字：布', severity: 'warn' },
  { find: '部份', suggest: '部分', note: '法律統一用字：分', severity: 'warn' },
  { find: '身份', suggest: '身分', note: '法律統一用字：分', severity: 'warn' },
  { find: '含蓋', suggest: '涵蓋', note: '公文寫作常見問題', severity: 'warn' },
  { find: '穫得', suggest: '獲得', note: '公文寫作常見問題', severity: 'warn' },
  { find: '貫澈', suggest: '貫徹', note: '法律統一用字：貫徹', severity: 'warn' },
  { find: '徹底', suggest: '澈底', note: '法律統一用字：澈底', severity: 'warn' },
  { find: '莫明奇妙', suggest: '莫名奇妙', note: '公文寫作常見問題', severity: 'warn' },
  { find: '名符其實', suggest: '名副其實', note: '公文寫作常見問題', severity: 'warn' },
  { find: '抵觸', suggest: '牴觸', note: '法律統一用字：牴', severity: 'warn' },
  { find: '必須品', suggest: '必需品', note: '公文寫作常見問題', severity: 'warn' },
  { find: '須要', suggest: '需要', note: '公文寫作常見問題', severity: 'warn' },
  { find: '佔', suggest: '占', note: '法律統一用字：占（占有、獨占）', severity: 'warn' },
  { find: '盡量', suggest: '儘量', note: '法律統一用字：儘量、儘先', severity: 'warn' },
  { find: '搜集', suggest: '蒐集', note: '法律統一用字：蒐集', severity: 'warn' },
  { find: '粘貼', suggest: '黏貼', note: '法律統一用字：黏貼', severity: 'warn' },
  { find: '台端', suggest: '臺端', note: '「臺」乃觀四方而高者（公文書寫作實務）', severity: 'warn' },
  { find: '計劃', suggest: '計畫', note: '名詞用「計畫」，動詞才用「計劃」（公文寫作）', severity: 'info' },
  // 用語（公文書寫作實務）
  { find: '惠請', suggest: '請惠予', note: '「惠」是人給我、「請」是我求人，應寫「請惠予」（函錯誤態樣 2）', severity: 'warn' },
  { find: '簽呈', suggest: '簽陳', note: '公文書寫作實務（簽錯誤態樣 13）', severity: 'info' },
  { find: '簽告', suggest: '簽陳、簽報', note: '公文書寫作實務（簽錯誤態樣 15）', severity: 'info' },
  { find: '業已', suggest: '業經、已', note: '「業」即已經之意，不寫「業已」（簽錯誤態樣 12）', severity: 'info' },
  { find: '今年', suggest: '本年', note: '公文寫「本年」不寫「今年」，寫「日」不寫「天」，寫「時」不寫「點」（簽錯誤態樣 4）', severity: 'info' },
  { find: '是否允當', suggest: '（刪除，直接寫期望語）', note: '贅語，儘少使用（簽錯誤態樣 1）', severity: 'info', types: ['簽', '函', '書函'] },
  { find: '當否', suggest: '（刪除，直接寫期望語）', note: '贅語，儘少使用（簽錯誤態樣 1）', severity: 'info', types: ['簽', '函', '書函'] },
  { find: '似可', suggest: '擬', note: '「似」字少用為宜（簽錯誤態樣 16）', severity: 'info', types: ['簽'] },
  { find: '似宜', suggest: '擬', note: '「似」字少用為宜（簽錯誤態樣 16）', severity: 'info', types: ['簽'] },
];
