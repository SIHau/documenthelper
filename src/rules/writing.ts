import type { OfficialDocument } from '../model/types';
import type { DocTypeConfig } from '../model/docTypes';
import { toMinguoText } from '../model/date';
import { ATTACH_WORDS } from '../data/phrases';
import { WORDING } from './wording';
import type { Issue, Severity } from './index';

/**
 * 依「文書處理手冊」「公文書寫作實務」「公文寫作」「函的概念與範例」整理的寫作規則。
 * 每則提醒的訊息都標明出處；原文的 Markdown 版在 .claude/skills/documenthelper/references/source/。
 */

export interface Section {
  where: string;
  text: string;
}

/** 常見機關、單位名稱的結尾字：「貴」「鈞」後面接這些才視為稱謂（避免誤判「寶貴」「貴重」） */
const ORG = '(?:機關|單位|局|部|院|府|會|校|處|室|組|署|所|司|廳|中心|公司|系|館|辦公室|校長|首長|主管)';
const CHINESE_NUM = '[一二三四五六七八九十〇零]';

const hasText = (s: string) => s.trim().length > 0;

/** 把西元日期轉成內文寫法：115年11月20日（不加「中華民國」、月日不補 0） */
export function minguoBody(iso: string): string {
  return toMinguoText(iso).replace('中華民國', '');
}

export function writingIssues(doc: OfficialDocument, cfg: DocTypeConfig, sections: Section[]): Issue[] {
  const out: Issue[] = [];
  const add = (id: string, severity: Severity, where: string, message: string) => out.push({ id, severity, where, message });
  const body = sections.map((s) => s.text).join('\n');
  const dir = doc.direction;

  // ---- 稱謂語：上行「鈞」、平行與下行「貴」、斜行「大」（手冊第十八點）
  const gui = new RegExp(`貴${ORG}`);
  const jun = new RegExp(`鈞${ORG}|鈞長|鈞座`);
  if (dir === '上行' && gui.test(body)) {
    add('address-gui', 'warn', '稱謂語', '上行文對上級機關稱「鈞」，不稱「貴」（例：貴部 → 鈞部）。（文書處理手冊第十八點）');
  }
  if ((dir === '平行' || dir === '下行') && jun.test(body)) {
    add('address-jun', 'warn', '稱謂語', `${dir}文對受文機關稱「貴」，不稱「鈞」。（文書處理手冊第十八點）`);
  }
  if (dir === '斜行' && (gui.test(body) || jun.test(body))) {
    add('address-da', 'warn', '稱謂語', '對無隸屬關係的較高級機關稱「大」（例：大院、大部），不稱「貴」或「鈞」。（文書處理手冊第十八點）');
  }
  if (/各機關/.test(body)) {
    add('address-all', 'info', '稱謂語', '一件公文有幾個受文機關時，文內稱呼用「貴機關」，不用「各機關」。（公文書寫作實務，函錯誤態樣 7）');
  }
  const own = doc.sender.name.trim();
  if (own.length >= 4 && body.includes(own)) {
    add('self-name', 'info', '自稱', `自稱用「本」（例：本校、本會、本府），不直接寫自己機關的全名「${own}」。（文書處理手冊第十八點；公文寫作）`);
  }

  // ---- 附送語：上行「檢陳」「附陳」，其餘「檢送」「檢附」
  if (cfg.expectation || doc.type === '簽') {
    if (dir === '上行' && /檢送/.test(body)) {
      add('attach-word', 'warn', '附送語', `上行文的附送語用「${ATTACH_WORDS.上行.join('」「')}」，不用「檢送」。（公文書寫作實務，函錯誤態樣 6）`);
    }
    if (dir !== '上行' && /檢陳|附陳/.test(body)) {
      add('attach-word', 'warn', '附送語', `${dir}文的附送語用「${ATTACH_WORDS[dir].join('」「')}」，「檢陳」「附陳」是對上級機關用的。（公文書寫作實務，函錯誤態樣 6）`);
    }
  }

  // ---- 期望語只放主旨，不在說明、辦法重複
  const detail = sections.filter((s) => s.where !== cfg.subjectLabel);
  const repeated = detail.find((s) => /請(?:查照|察照|詧照|鑒核|核示|照辦|核備|備查|鑒察)/.test(s.text));
  if (cfg.subject && repeated) {
    add('expect-repeat', 'warn', repeated.where, '「請查照」「請核示」「請照辦」這類概括性期望語只寫在主旨，不在說明、辦法重複；具體要求才列入辦法。（文書處理手冊第十九點；公文書寫作實務，簽錯誤態樣 6）');
  }
  if (cfg.expectation && hasText(doc.subject)) {
    const clauses = doc.subject.split(/[，；]/).filter((c) => /^\s*(?:敬|謹)?請/.test(c));
    if (clauses.length >= 2) {
      add('expect-double', 'info', '主旨', '主旨已有描述性期望語（例：敬請惠予協助），就不必再加概括性期望語「請查照」，擇一而用。（公文書寫作實務，函錯誤態樣 26）');
    }
  }
  if (doc.type === '簽' && hasText(doc.subject) && !/(?:簽請|請)(?:核示|鑒核|鑒察|核閱|鈞閱|核備|核定|鈞參|裁示|核判|核可)/.test(doc.subject)) {
    add('memo-expect', 'info', '主旨', '簽的主旨結尾要有期望語：請核示（提出擬辦意見）、請鑒核（兼有請示）、請鑒察（僅供瞭解）、請核閱、請鈞閱、請鈞參。（公文寫作「簽」）');
  }

  // ---- 限期：寫在主旨；限期公文不填速別
  if (hasText(doc.limit) && /^\d{4}-\d{2}-\d{2}$/.test(doc.limit)) {
    if (hasText(doc.urgency)) {
      add('limit-urgency', 'warn', '速別', '定有辦理或復文期限的公文不必填速別，請把速別留空。（公文書寫作實務，函撰擬要領 7；政府文書格式參考規範）');
    }
  }

  // ---- 引據：復文、依據來文要寫日期與文號
  if (/(?:復|依據|依|奉|准|接)[^。；]{0,30}(?:來函|[日年月]函|號函|函辦理|函略以)/.test(body) && !/字第[^。；]{0,30}號/.test(body)) {
    add('cite-number', 'info', '引敘來文', '復文或引述來文時，要寫明來文機關、發文日期與字號。（函的概念與範例；文書處理手冊第十六點）');
  }
  if (/復[^。，；]{0,40}函辦理/.test(body)) {
    add('reply-banli', 'warn', '引敘來文', '「復…函」之後不必加「辦理」。（公文書寫作實務，函錯誤態樣 4）');
  }

  // ---- 本文格式
  for (const s of sections) {
    const t = s.text;
    if (/^\s*(?:主旨|說明|辦法|擬辦|依據|公告事項|案由)[：:]/.test(t)) {
      add(`label-in-text:${s.where}`, 'warn', s.where, '段名（主旨、說明…）由程式印出，內容裡不要再寫。');
    }
    if (s.where !== cfg.subjectLabel && /^\s*(?:[一二三四五六七八九十]+、|[（(][一二三四五六七八九十0-9]+[）)]|[0-9０-９]+[.、．])/.test(t)) {
      add(`manual-number:${s.where}`, 'warn', s.where, '分項編號由程式依層級自動產生（一、(一)１、(１)…），內容裡不要自己寫編號，層級用 level 表示。');
    }
    if (new RegExp(`${CHINESE_NUM}+年${CHINESE_NUM}+月|${CHINESE_NUM}+月${CHINESE_NUM}+日`).test(t)) {
      add(`num-date:${s.where}`, 'warn', s.where, '日期用阿拉伯數字（例：115年11月20日），不用中文數字。（文書處理手冊附錄 5）');
    }
    if (/乙(?:份|式|紙|張|冊|件)/.test(t) || /[壹貳參肆伍陸柒捌玖兩一二三四五六七八九十]{1,3}(?:份|紙|張|冊)|[一二三四五六七八九十]式/.test(t)) {
      add(`num-unit:${s.where}`, 'warn', s.where, '份數、紙數等計量用阿拉伯數字（例：1份、3紙、1式2份），不寫「乙份」「一份」「參紙」。（公文書寫作實務，函錯誤態樣 10、11）');
    }
    if (/\d{1,2}日\s*[（(][一二三四五六日][）)]/.test(t)) {
      add(`weekday:${s.where}`, 'warn', s.where, '星期要寫全：6月6日（星期四），不寫（四）。（公文書寫作實務，函錯誤態樣 13）');
    }
    if (/\d{1,2}[:：]\d{2}/.test(t) || /(?:上午|下午)\s*(?:1[3-9]|2[0-4])\s*時/.test(t)) {
      add(`time24:${s.where}`, 'warn', s.where, '時間用 12 小時制並寫「時、分」：上午9時30分、下午2時，不寫 09:30 或下午14時。（公文書寫作實務，函錯誤態樣 14）');
    }
    if (/[一-鿿][,;:?!]|[一-鿿]\.(?!\d)/.test(t)) {
      add(`half-punct:${s.where}`, 'warn', s.where, '中文句中的標點用全形（，；：？！。）；半形只用在阿拉伯數字與外文中。（文書處理手冊第十六點）');
    }
    if (/略以[，：:]?\s*「/.test(t)) {
      add(`lueyi:${s.where}`, 'warn', s.where, '「略以」之後是摘述，不加引號「」；照錄原文才用「」，且要寫「規定：「…」」。（公文處理注意事項 缺失表(二)；公文寫作「結語」第 7 項）');
    }
    if (/(?:^|[^\d])0\d月|月0\d日/.test(t)) {
      add(`date-zero:${s.where}`, 'info', s.where, '月、日是個位數時不補 0（5月1日，不寫 05月01日）。（公文寫作「本校公文常見錯誤」）');
    }
  }
  if ((body.match(/(?:中華)?民國\s*\d/g) ?? []).length >= 2) {
    add('republic-repeat', 'info', '日期', '首次提到年份可寫「民國」，第二次起不必重複。（公文書寫作實務，函錯誤態樣 3）');
  }

  // ---- 用字與用語
  for (const w of WORDING) {
    if (w.types && !w.types.includes(doc.type)) continue;
    const hit = sections.find((s) => s.text.includes(w.find));
    if (hit) add(`wording:${w.find}`, w.severity, hit.where, `「${w.find}」建議改為「${w.suggest}」。${w.note}`);
  }

  // ---- 其他
  if (cfg.routing && dir === '上行' && hasText(doc.ccRecipients)) {
    add('cc-upward', 'info', '副本', '對上級機關行文，以不發送副本為宜（除非要求副知）。（函的概念與範例；公文書寫作實務）');
  }
  const explanationText = sections.filter((s) => s.where !== cfg.subjectLabel).map((s) => s.text).join('\n');
  const phone = doc.contact.phone.replace(/\s/g, '');
  if ((phone.length >= 6 && explanationText.replace(/\s/g, '').includes(phone)) || (hasText(doc.contact.person) && /聯絡人|承辦人/.test(explanationText) && explanationText.includes(doc.contact.person.trim()))) {
    add('contact-dup', 'info', '說明', '說明裡的聯絡人資料如果與右上角的承辦人、電話相同，不必重複。（公文寫作「本校公文常見錯誤」第 12 項）');
  }
  if (cfg.meeting && /^\s*假/.test(doc.meeting.place)) {
    add('place-jia', 'info', '開會地點', '「假」是借用的意思，在本機關開會用「在」。（公文書寫作實務，開會通知單錯誤態樣 8）');
  }
  return out;
}
