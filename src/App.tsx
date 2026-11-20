import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileCheck2,
  BrainCircuit,
  Trophy,
  Palette,
  Layers,
  ListChecks
} from 'lucide-react';
import rawQuestions from './data/questions.json';
import { Question, StudyMode, UserAnswerRecord } from './types';
import { gradeObjectiveQuestion } from './utils/grader';

const QUESTIONS = rawQuestions as Question[];

const THEMES = [
  { name: '清雅蓝', primary: '#2563EB', soft: '#EFF6FF', border: '#BFDBFE', bg: '#F6F8FB' },
  { name: '莫兰迪雾蓝', primary: '#5A8FA0', soft: '#EBF4F6', border: '#C7E2E0', bg: '#F7F5F2' },
  { name: '暖杏柔粉', primary: '#C97B84', soft: '#FDF2F3', border: '#EAC0C3', bg: '#FAEDE5' },
];

const TYPE_LABELS: Record<string, string> = {
  fill: '填空题',
  single: '单选题',
  judge: '判断题',
  short: '简答题',
  code: '程序分析/编程',
};

const STORAGE_KEY = 'mcu_quiz_records_v1';

export default function App() {
  const [themeIdx, setThemeIdx] = useState(0);
  const theme = THEMES[themeIdx];

  // 页面视图：home（首页选模式/章节） | session（刷题/背题页）
  const [view, setView] = useState<'home' | 'session'>('home');
  const [mode, setMode] = useState<StudyMode>('memorize');
  const [selectedChapter, setSelectedChapter] = useState<number | 'all' | 'errata'>('all');

  // 持久化答题记录
  const [records, setRecords] = useState<Record<string, UserAnswerRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore storage quota errors
    }
  }, [records]);

  // 当前练习队列与索引
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftInputs, setDraftInputs] = useState<string[]>([]);
  const [submittedCurrent, setSubmittedCurrent] = useState(false);

  // 统计指标
  const stats = useMemo(() => {
    const total = QUESTIONS.length;
    const autoGradable = QUESTIONS.filter(q => ['single', 'judge', 'fill'].includes(q.type)).length;
    const recordList = Object.values(records);
    const answeredCount = recordList.length;
    const correctCount = recordList.filter(r => r.isCorrect).length;
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const wrongIds = new Set(recordList.filter(r => !r.isCorrect).map(r => r.questionId));
    return { total, autoGradable, answeredCount, correctCount, accuracy, wrongCount: wrongIds.size, wrongIds };
  }, [records]);

  // 章节列表
  const chapters = useMemo(() => {
    const map = new Map<number, { chapter: number; title: string; count: number; done: number }>();
    QUESTIONS.forEach(q => {
      if (!map.has(q.chapter)) {
        map.set(q.chapter, { chapter: q.chapter, title: q.chapterTitle, count: 0, done: 0 });
      }
      const item = map.get(q.chapter)!;
      item.count += 1;
      if (records[q.id]) item.done += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.chapter - b.chapter);
  }, [records]);

  // 根据当前选择筛选题库预览数量
  const previewFilteredQuestions = useMemo(() => {
    if (mode === 'wrong') {
      return QUESTIONS.filter(q => stats.wrongIds.has(q.id));
    }
    let list = QUESTIONS;
    if (selectedChapter === 'errata') {
      list = QUESTIONS.filter(q => q.hasErrata);
    } else if (typeof selectedChapter === 'number') {
      list = QUESTIONS.filter(q => q.chapter === selectedChapter);
    }
    if (mode === 'exam') {
      return list.slice(0, Math.min(25, list.length));
    }
    return list;
  }, [mode, selectedChapter, stats.wrongIds]);

  // 启动刷题/背题会话
  const handleStartSession = () => {
    let targetList = [...previewFilteredQuestions];
    if (targetList.length === 0) return;

    if (mode === 'exam') {
      // 模拟测验随机抽25题
      targetList = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 25);
    }

    setSessionQuestions(targetList);
    setCurrentIndex(0);
    initQuestionState(targetList[0], mode);
    setView('session');
  };

  const initQuestionState = (q: Question, activeMode: StudyMode) => {
    if (!q) return;
    if (activeMode === 'memorize') {
      setDraftInputs([...q.answer]);
      setSubmittedCurrent(true);
    } else {
      const existing = records[q.id];
      if (existing && activeMode !== 'exam') {
        setDraftInputs([...existing.userAnswer]);
        setSubmittedCurrent(true);
      } else {
        setDraftInputs(q.type === 'fill' ? new Array(q.answer.length).fill('') : ['']);
        setSubmittedCurrent(false);
      }
    }
  };

  const currentQ = sessionQuestions[currentIndex];

  const handleSelectOption = (optValue: string) => {
    if (submittedCurrent && mode === 'memorize') return;
    const nextDraft = [optValue];
    setDraftInputs(nextDraft);
    const isCorrect = gradeObjectiveQuestion(currentQ.type, nextDraft, currentQ.answer);
    setSubmittedCurrent(true);
    setRecords(prev => ({
      ...prev,
      [currentQ.id]: {
        questionId: currentQ.id,
        userAnswer: nextDraft,
        isCorrect,
        timestamp: Date.now(),
      },
    }));
  };

  const handleSubmitFill = () => {
    const isCorrect = gradeObjectiveQuestion('fill', draftInputs, currentQ.answer);
    setSubmittedCurrent(true);
    setRecords(prev => ({
      ...prev,
      [currentQ.id]: {
        questionId: currentQ.id,
        userAnswer: [...draftInputs],
        isCorrect,
        timestamp: Date.now(),
      },
    }));
  };

  const handleSelfAssess = (mastered: boolean) => {
    setSubmittedCurrent(true);
    setRecords(prev => ({
      ...prev,
      [currentQ.id]: {
        questionId: currentQ.id,
        userAnswer: [mastered ? '已掌握' : '需巩固'],
        isCorrect: mastered,
        timestamp: Date.now(),
      },
    }));
  };

  const goToIndex = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= sessionQuestions.length) return;
    setCurrentIndex(nextIdx);
    initQuestionState(sessionQuestions[nextIdx], mode);
  };

  const handleResetRecords = () => {
    if (window.confirm('确定要清空所有累计答题与错题记录吗？')) {
      setRecords({});
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // ==================== 首页视图（复刻参考截图风格） ====================
  if (view === 'home') {
    const modeDescriptions: Record<StudyMode, { title: string; badge: string; desc: string; btn: string; icon: React.ReactNode }> = {
      memorize: {
        title: '背题模式',
        badge: '看',
        desc: '答案与解析直接展示，适合考前速览',
        btn: '开始背题',
        icon: <BookOpen className="w-5 h-5" />,
      },
      practice: {
        title: '顺序刷题',
        badge: '练',
        desc: '逐题作答自动判分，支持十六进制等价识别',
        btn: '开始刷题',
        icon: <ListChecks className="w-5 h-5" />,
      },
      wrong: {
        title: '错题攻坚',
        badge: '错',
        desc: '专攻历史答错与自评薄弱题目',
        btn: '刷错题集',
        icon: <XCircle className="w-5 h-5" />,
      },
      exam: {
        title: '模拟测验',
        badge: '测',
        desc: '随机抽取 25 题进行全真综合自测',
        btn: '开始测验',
        icon: <Trophy className="w-5 h-5" />,
      },
    };

    const currentModeMeta = modeDescriptions[mode];

    return (
      <div className="min-h-screen pb-28 transition-colors duration-300" style={{ backgroundColor: theme.bg }}>
        <div className="max-w-lg mx-auto px-4 pt-6">
          {/* 顶部标签与主题切换 */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: theme.soft, color: theme.primary }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              单片机原理 · 期末复习
            </span>
            <button
              onClick={() => setThemeIdx((themeIdx + 1) % THEMES.length)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-xs text-slate-600 shadow-sm border border-slate-100 active:scale-95 transition"
              title="切换护眼配色"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: theme.primary }} />
              {theme.name}
            </button>
          </div>

          {/* 主标题与简介 */}
          <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 leading-tight mb-3">
            按章节刷题，把 7 章知识点练透
          </h1>
          <p className="text-[14px] text-slate-500 leading-relaxed mb-5">
            题库整理自《单片机原理及应用》第 1~7 章课后思考题与习题解答，涵盖填空、单选、判断、简答及汇编编程，已标注全部教材勘误与解析。
          </p>

          {/* 数据统计胶囊 */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-100 text-sm font-bold text-slate-800">
              {stats.total} <span className="font-normal text-slate-500 text-xs">题</span>
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-100 text-sm font-bold text-slate-800">
              7 <span className="font-normal text-slate-500 text-xs">章</span>
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-100 text-sm font-bold text-slate-800">
              {stats.autoGradable} <span className="font-normal text-slate-500 text-xs">题可自动判分</span>
            </div>
          </div>

          {/* 累计进度条卡片 */}
          <div className="bg-white px-4 py-3 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-between mb-6">
            <div className="text-sm text-slate-600">
              累计答题 <span className="font-bold text-slate-900">{stats.answeredCount}</span>
              <span className="mx-2 text-slate-300">·</span>
              正确率 <span className="font-bold text-slate-900">{stats.accuracy}%</span>
            </div>
            {stats.answeredCount > 0 && (
              <button
                onClick={handleResetRecords}
                className="text-xs text-slate-400 hover:text-rose-500 inline-flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                重置
              </button>
            )}
          </div>

          {/* ① 选择模式卡片区 */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100 mb-5">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: theme.primary }}
              >
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">选择模式</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 pl-7">四种模式共用同一套题目与解析</p>

            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(modeDescriptions) as StudyMode[]).map(mKey => {
                const item = modeDescriptions[mKey];
                const active = mode === mKey;
                const disabled = mKey === 'wrong' && stats.wrongCount === 0;
                return (
                  <button
                    key={mKey}
                    disabled={disabled}
                    onClick={() => setMode(mKey)}
                    className={`text-left p-3.5 rounded-2xl border-2 transition-all relative ${
                      disabled ? 'opacity-45 cursor-not-allowed bg-slate-50 border-slate-100' : 'active:scale-[0.98]'
                    }`}
                    style={{
                      borderColor: active ? theme.primary : '#F1F5F9',
                      backgroundColor: active ? theme.soft : '#FFFFFF',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: active ? theme.primary : '#94A3B8' }}
                      >
                        {item.icon}
                      </div>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                        style={{
                          color: active ? theme.primary : '#64748B',
                          borderColor: active ? theme.border : '#E2E8F0',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        {mKey === 'wrong' ? `${stats.wrongCount}题` : item.badge}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ② 选择范围/章节卡片区 */}
          {mode !== 'wrong' && mode !== 'exam' && (
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: theme.primary }}
                >
                  2
                </span>
                <h2 className="text-base font-bold text-slate-900">选择范围</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4 pl-7">支持全库通刷、单章突破或专攻教材勘误题</p>

              <div className="space-y-2">
                {/* 全部章节 */}
                <button
                  onClick={() => setSelectedChapter('all')}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-left"
                  style={{
                    borderColor: selectedChapter === 'all' ? theme.primary : '#F1F5F9',
                    backgroundColor: selectedChapter === 'all' ? theme.soft : '#FAFAFA',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4" style={{ color: theme.primary }} />
                    <span className="font-bold text-sm text-slate-800">全部 7 章综合题库</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{stats.total} 题</span>
                </button>

                {/* 教材勘误与高频易错专项 */}
                <button
                  onClick={() => setSelectedChapter('errata')}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-left"
                  style={{
                    borderColor: selectedChapter === 'errata' ? '#D97706' : '#FEF3C7',
                    backgroundColor: selectedChapter === 'errata' ? '#FFFBEB' : '#FFFDF5',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-sm text-amber-900">教材原答案勘误与易错专项</span>
                  </div>
                  <span className="text-xs font-semibold text-amber-700">
                    {QUESTIONS.filter(q => q.hasErrata).length} 题
                  </span>
                </button>

                {/* 各章节列表 */}
                {chapters.map(ch => {
                  const active = selectedChapter === ch.chapter;
                  return (
                    <button
                      key={ch.chapter}
                      onClick={() => setSelectedChapter(ch.chapter)}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-left"
                      style={{
                        borderColor: active ? theme.primary : '#F1F5F9',
                        backgroundColor: active ? theme.soft : '#FFFFFF',
                      }}
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-800">{ch.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          已练 {ch.done} / {ch.count} 题
                        </div>
                      </div>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{
                          backgroundColor: active ? '#FFFFFF' : '#F8FAFC',
                          color: active ? theme.primary : '#64748B',
                        }}
                      >
                        {ch.count} 题
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部吸底悬浮栏（复刻截图底部卡片） */}
        <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-slate-200/70 px-4 py-3 z-20">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-700">
                本次练习 <span className="text-lg font-extrabold text-slate-900">{previewFilteredQuestions.length}</span> 题 ·{' '}
                {currentModeMeta.title}
              </div>
              <div className="text-xs text-slate-400">{currentModeMeta.desc}</div>
            </div>
            <button
              disabled={previewFilteredQuestions.length === 0}
              onClick={handleStartSession}
              className="shrink-0 px-5 py-3 rounded-2xl text-white font-bold text-sm shadow-md active:scale-95 transition disabled:opacity-40"
              style={{ backgroundColor: theme.primary }}
            >
              {currentModeMeta.btn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 刷题 / 背题会话视图 ====================
  const isObjective = currentQ && ['single', 'judge'].includes(currentQ.type);
  const isFill = currentQ && currentQ.type === 'fill';
  const isSubjective = currentQ && ['short', 'code'].includes(currentQ.type);
  const currentRecord = currentQ ? records[currentQ.id] : undefined;

  return (
    <div className="min-h-screen pb-24 flex flex-col" style={{ backgroundColor: theme.bg }}>
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => setView('home')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="w-5 h-5" />
            返回目录
          </button>
          <div className="text-sm font-bold text-slate-800">
            {currentIndex + 1} <span className="text-slate-400 font-normal">/ {sessionQuestions.length}</span>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: theme.soft, color: theme.primary }}
          >
            {TYPE_LABELS[currentQ.type]}
          </span>
        </div>
        {/* 进度条 */}
        <div className="max-w-lg mx-auto mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${((currentIndex + 1) / sessionQuestions.length) * 100}%`,
              backgroundColor: theme.primary,
            }}
          />
        </div>
      </header>

      {/* 题目主体卡片 */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100">
          {/* 章节与勘误标识 */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium text-slate-400">{currentQ.chapterTitle}</span>
            {currentQ.hasErrata && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                含教材勘误修正
              </span>
            )}
          </div>

          {/* 题干（支持保留汇编代码换行与等宽字体） */}
          <div className="text-[16px] font-bold text-slate-900 leading-relaxed whitespace-pre-wrap mb-5">
            {currentQ.question}
          </div>

          {/* 1. 单选 / 判断选项 */}
          {isObjective && (
            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                const optKey = currentQ.type === 'judge' ? opt : opt.trim().charAt(0);
                const isSelected = draftInputs[0] === optKey;
                const isRightOption = currentQ.answer[0] === optKey;

                let borderColor = '#E2E8F0';
                let bgColor = '#FFFFFF';
                let textColor = '#1E293B';

                if (submittedCurrent) {
                  if (isRightOption) {
                    borderColor = '#10B981';
                    bgColor = '#ECFDF5';
                    textColor = '#065F46';
                  } else if (isSelected && !isRightOption) {
                    borderColor = '#F43F5E';
                    bgColor = '#FFF1F2';
                    textColor = '#9F1239';
                  }
                } else if (isSelected) {
                  borderColor = theme.primary;
                  bgColor = theme.soft;
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(optKey)}
                    className="w-full text-left p-3.5 rounded-2xl border-2 font-medium text-sm transition flex items-center justify-between gap-3 active:scale-[0.99]"
                    style={{ borderColor, backgroundColor: bgColor, color: textColor }}
                  >
                    <span>{opt}</span>
                    {submittedCurrent && isRightOption && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                    {submittedCurrent && isSelected && !isRightOption && (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. 多空填空题输入 */}
          {isFill && (
            <div className="space-y-3">
              {currentQ.answer.map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-12 shrink-0">第 {idx + 1} 空</span>
                  <input
                    type="text"
                    disabled={mode === 'memorize'}
                    value={draftInputs[idx] || ''}
                    onChange={e => {
                      const next = [...draftInputs];
                      next[idx] = e.target.value;
                      setDraftInputs(next);
                    }}
                    placeholder="输入答案（自动兼容大小写与十六进制格式）"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                  />
                </div>
              ))}
              {mode !== 'memorize' && (
                <button
                  onClick={handleSubmitFill}
                  className="w-full py-3 rounded-2xl text-white font-bold text-sm mt-2 active:scale-[0.99] transition"
                  style={{ backgroundColor: theme.primary }}
                >
                  提交并核对答案
                </button>
              )}
            </div>
          )}

          {/* 3. 简答 / 汇编程序题交互 */}
          {isSubjective && mode !== 'memorize' && !submittedCurrent && (
            <div className="mt-2">
              <button
                onClick={() => setSubmittedCurrent(true)}
                className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition"
                style={{ backgroundColor: theme.primary }}
              >
                <BrainCircuit className="w-4 h-4" />
                查看参考答案与汇编解析
              </button>
            </div>
          )}
        </div>

        {/* 答案与解析卡片 */}
        {submittedCurrent && (
          <div className="mt-4 bg-white rounded-3xl p-5 shadow-xs border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <FileCheck2 className="w-4 h-4" style={{ color: theme.primary }} />
                标准答案与解析
              </div>
              {currentRecord && mode !== 'memorize' && (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    currentRecord.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {currentRecord.isCorrect ? '回答正确' : '已加入错题本'}
                </span>
              )}
            </div>

            {/* 参考答案展示区 */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto mb-3">
              {currentQ.answer.join(' ； ')}
            </div>

            {/* 详细解析 */}
            <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl">
              <span className="font-bold text-slate-800">解析：</span>
              {currentQ.explanation}
            </div>

            {/* 主观题自评按钮（计入错题本与正确率） */}
            {isSubjective && mode !== 'memorize' && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-400 mb-2 text-center">请根据掌握情况标记，自动同步至错题本：</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleSelfAssess(false)}
                    className="py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs active:scale-95 transition"
                  >
                    还需巩固（加入错题）
                  </button>
                  <button
                    onClick={() => handleSelfAssess(true)}
                    className="py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs active:scale-95 transition"
                  >
                    完全掌握（标记通过）
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 底部上一题 / 下一题切换栏 */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/70 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <button
            disabled={currentIndex === 0}
            onClick={() => goToIndex(currentIndex - 1)}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-700 flex items-center justify-center gap-1 disabled:opacity-35 active:scale-95 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            上一题
          </button>
          <button
            onClick={() => {
              if (currentIndex < sessionQuestions.length - 1) {
                goToIndex(currentIndex + 1);
              } else {
                setView('home');
              }
            }}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1 active:scale-95 transition"
            style={{ backgroundColor: theme.primary }}
          >
            {currentIndex < sessionQuestions.length - 1 ? (
              <>
                下一题
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              '完成并返回首页'
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
