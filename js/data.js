// ==================== Analytics Engine ====================
const Analytics = {
  // میانگین نمره کل دانش‌آموز
  studentAvg(student, examName) {
    const exam = student.exams[examName];
    if (!exam) return 0;
    const vals = Object.values(exam.questions).filter(v => v !== null);
    if (!vals.length) return 0;
    // نمره کل = (جمع سوالات / تعداد سوالات) * 20
    return (vals.reduce((a,b)=>a+b,0) / vals.length) * 20;
  },

  // درصد پاسخ صحیح
  studentPercent(student, examName) {
    const exam = student.exams[examName];
    if (!exam) return 0;
    const vals = Object.values(exam.questions).filter(v => v !== null);
    if (!vals.length) return 0;
    return (vals.reduce((a,b)=>a+b,0) / vals.length) * 100;
  },

  // میانگین هر سوال در کلاس
  questionAvg(students, examName, qNum) {
    const vals = students
      .map(s => s.exams[examName]?.questions[qNum])
      .filter(v => v !== null && v !== undefined);
    if (!vals.length) return 0;
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  },

  // میانگین کلاس در یک آزمون
  classAvg(students, examName) {
    const vals = students
      .map(s => this.studentPercent(s, examName))
      .filter(v => v > 0);
    if (!vals.length) return 0;
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  },

  // دانش‌آموز برتر
  topStudent(students) {
    return [...students].sort((a,b) => {
      const aAvg = Math.max(...Object.keys(a.exams).map(e => this.studentPercent(a, e)));
      const bAvg = Math.max(...Object.keys(b.exams).map(e => this.studentPercent(b, e)));
      return bAvg - aAvg;
    })[0];
  },

  // رتبه‌بندی در یک آزمون
  rank(students, examName) {
    const sorted = [...students].sort((a,b) =>
      this.studentPercent(b, examName) - this.studentPercent(a, examName)
    );
    const ranks = {};
    sorted.forEach((s, i) => ranks[s.id] = i + 1);
    return ranks;
  },

  // سطح نمره
  level(pct) {
    if (pct >= 90) return { label: 'عالی', color: '#10b981', emoji: '🌟', badge: 'q-strong' };
    if (pct >= 75) return { label: 'خوب', color: '#06b6d4', emoji: '✅', badge: 'q-strong' };
    if (pct >= 50) return { label: 'متوسط', color: '#f59e0b', emoji: '⚠️', badge: 'q-mid' };
    return { label: 'ضعیف', color: '#ef4444', emoji: '❗', badge: 'q-weak' };
  },

  // تحلیل نقاط ضعف و قوت دانش‌آموز
  studentStrengths(student, examName, totalQuestions) {
    const exam = student.exams[examName];
    if (!exam) return { strengths: [], weaknesses: [] };

    const strengths = [];
    const weaknesses = [];

    for (let i = 1; i <= totalQuestions; i++) {
      const val = exam.questions[i];
      if (val === null || val === undefined) continue;
      if (val === 1) strengths.push(i);
      else weaknesses.push(i);
    }
    return { strengths, weaknesses };
  },

  // محاسبه رشد/افت بین دو آزمون
  growth(student, exam1, exam2) {
    const p1 = this.studentPercent(student, exam1);
    const p2 = this.studentPercent(student, exam2);
    const delta = p2 - p1;
    return {
      from: p1, to: p2, delta,
      trend: delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable',
      trendLabel: delta > 5 ? 'رشد' : delta < -5 ? 'افت' : 'ثابت',
      emoji: delta > 5 ? '📈' : delta < -5 ? '📉' : '➖'
    };
  },

  // مقایسه سوال به سوال بین دو آزمون
  questionGrowth(students, exam1, exam2, totalQuestions) {
    const result = [];
    for (let i = 1; i <= totalQuestions; i++) {
      const a1 = this.questionAvg(students, exam1, i);
      const a2 = this.questionAvg(students, exam2, i);
      result.push({
        question: i,
        from: a1 * 100,
        to: a2 * 100,
        delta: (a2 - a1) * 100
      });
    }
    return result;
  }
};