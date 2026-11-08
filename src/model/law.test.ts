import { describe, expect, it } from 'vitest';
import { articleText, joinLine, parseLaw } from './lawText';

describe('法規純文字解析', () => {
  it('條文、標題、章節，折行的句子接回去', () => {
    const p = parseLaw(
      [
        '          ○○市立○○高級中學學生會財產法',
        '第 一   章 徵收',
        '第 一   條 （徵收時間）',
        '會費於每學年初徵收乙次。',
        '會費的收取應出於會員自願，不得強迫催繳。',
        '第 二   條 （徵收數額）',
        '會費徵收數額由每屆會長就任後提送議會審議。若本屆會長未選出得由議會議長提出，議會對會',
        '費徵收額可為刪減之決議，但不得增加。',
        '第 二   章 會費管理',
        '第 十一   條   （會產編列）',
        '受本辦法規範之會產包括：',
        '一、由會員會費購入之資產。',
        '二、外界贈與之資產。',
      ].join('\n'),
    );
    expect(p.name).toBe('○○市立○○高級中學學生會財產法');
    expect(p.articles.map((a) => [a.no, a.title, a.chapter])).toEqual([
      ['第一條', '徵收時間', '第一章 徵收'],
      ['第二條', '徵收數額', '第一章 徵收'],
      ['第十一條', '會產編列', '第二章 會費管理'],
    ]);
    expect(p.articles[0].text).toBe('會費於每學年初徵收乙次。\n會費的收取應出於會員自願，不得強迫催繳。');
    expect(p.articles[1].text).toBe('會費徵收數額由每屆會長就任後提送議會審議。若本屆會長未選出得由議會議長提出，議會對會費徵收額可為刪減之決議，但不得增加。');
    expect(p.articles[2].text).toBe('受本辦法規範之會產包括：\n一、由會員會費購入之資產。\n二、外界贈與之資產。');
  });

  it('零寬字元、沿革、之一條', () => {
    const p = parseLaw(
      [
        '   ○○學校學生自治組織章程​',
        '                     ​ 法沿革：​',
        '1.​ ​中華民國111年06月21日修正通過。​',
        '宣揚民主精神，',
        '並制定本章程。',
        '​第一章 總則​',
        '​第一條 ​',
        '  依據高級中等教育法第五十三條成立自治組織，並制定本章程。​',
        '第三十三條之一',
        '依第五條規定辦理。',
      ].join('\n'),
    );
    expect(p.articles.map((a) => a.no)).toEqual(['第一條', '第三十三條之一']);
    expect(p.articles[0].text).toBe('依據高級中等教育法第五十三條成立自治組織，並制定本章程。');
    expect(p.articles[1].text).toBe('依第五條規定辦理。');
  });

  it('只貼幾條、沒有法規名稱也可以', () => {
    const p = parseLaw('第三條　本會設會長一人。\n第四條　會長任期一年。');
    expect(p.name).toBe('');
    expect(p.articles).toHaveLength(2);
    expect(p.articles[0]).toMatchObject({ no: '第三條', text: '本會設會長一人。' });
  });

  it('引用句的折行不當成新條文', () => {
    const p = parseLaw('第一條　適用範圍依本法規定，其中涉及\n第五條規定之事項，亦同。');
    expect(p.articles).toHaveLength(1);
    expect(p.articles[0].text).toBe('適用範圍依本法規定，其中涉及第五條規定之事項，亦同。');
  });

  it('joinLine 與 articleText', () => {
    expect(joinLine('', '甲')).toBe('甲');
    expect(joinLine('甲。', '乙')).toBe('甲。\n乙');
    expect(joinLine('甲', '一、乙')).toBe('甲\n一、乙');
    expect(articleText({ no: '第一條', title: '目的', text: '為…。' })).toBe('第一條（目的）　為…。');
    expect(articleText({ no: '第二條', text: '' })).toBe('第二條');
  });
});
