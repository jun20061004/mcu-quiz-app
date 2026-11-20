// 标准化单片机数值与文本答案，兼容 FFH / 0FFH、大小写、全半角单位等
export function normalizeMcuAnswer(input: string): string {
  let s = input.trim().toUpperCase();
  // 全角符号转半角
  s = s.replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',').replace(/；/g, ';').replace(/：/g, ':');
  // 微秒单位标准化
  s = s.replace(/US/g, 'μS').replace(/ΜS/g, 'μS');
  // 去掉多余空格
  s = s.replace(/\s+/g, '');
  // 十六进制前导0归一化：如 0FFH -> FFH，0CBH -> CBH，0AAH -> AAH，0B0H -> B0H
  if (/^0[A-F][0-9A-F]*H$/.test(s)) {
    s = s.slice(1);
  }
  return s;
}

export function gradeObjectiveQuestion(type: string, userAnswers: string[], standardAnswers: string[]): boolean {
  if (type === 'single' || type === 'judge') {
    if (!userAnswers[0]) return false;
    return normalizeMcuAnswer(userAnswers[0]) === normalizeMcuAnswer(standardAnswers[0]);
  }
  if (type === 'fill') {
    if (userAnswers.length !== standardAnswers.length) return false;
    return standardAnswers.every((std, idx) => {
      const u = userAnswers[idx] || '';
      if (!u.trim()) return false;
      // 支持多等价答案用“或”分隔
      const acceptable = std.split(/[或/]/).map(item => normalizeMcuAnswer(item));
      return acceptable.includes(normalizeMcuAnswer(u));
    });
  }
  return false;
}
