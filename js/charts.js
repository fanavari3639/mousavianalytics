const Charts = {
  instances: {},

  destroy(id) {
    if (this.instances[id]) { this.instances[id].destroy(); delete this.instances[id]; }
  },

  themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#f1f5f9' : '#1e293b',
      grid: dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.12)'
    };
  },

  baseOptions(extra = {}) {
    const t = this.themeColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: t.text, font: { family: 'Vazirmatn', size: 12 } } },
        tooltip: { titleFont: { family: 'Vazirmatn' }, bodyFont: { family: 'Vazirmatn' } }
      },
      ...extra
    };
  },

  // میانگین سوالات کلاس (Bar)
  renderQuestions(canvasId, students, examName, totalQ) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = Array.from({length: totalQ}, (_, i) => `سوال ${i+1}`);
    const data = labels.map((_, i) => {
      const avg = Analytics.questionAvg(students, examName, i + 1);
      return (avg * 100).toFixed(1);
    });

    const colors = data.map(v => {
      const n = parseFloat(v);
      if (n >= 85) return 'rgba(16,185,129,0.9)';
      if (n >= 65) return 'rgba(6,182,212,0.9)';
      if (n >= 45) return 'rgba(245,158,11,0.9)';
      return 'rgba(239,68,68,0.9)';
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'درصد پاسخ صحیح',
          data,
          backgroundColor: colors,
          borderRadius: 10,
          borderSkipped: false
        }]
      },
      options: this.baseOptions({
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: this.themeColors().text, callback: v => v + '%' }, grid: { color: this.themeColors().grid } },
          x: { ticks: { color: this.themeColors().text }, grid: { display: false } }
        }
      })
    });
  },

  // توزیع سطح نمرات
  renderDistribution(canvasId, students, examName) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const buckets = [0, 0, 0, 0];
    students.forEach(s => {
      const pct = Analytics.studentPercent(s, examName);
      if (pct < 50) buckets[0]++;
      else if (pct < 75) buckets[1]++;
      else if (pct < 90) buckets[2]++;
      else buckets[3]++;
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['ضعیف (زیر 50%)', 'متوسط (50-75%)', 'خوب (75-90%)', 'عالی (بالای 90%)'],
        datasets: [{
          data: buckets,
          backgroundColor: ['#ef4444', '#f59e0b', '#06b6d4', '#10b981'],
          borderWidth: 0
        }]
      },
      options: this.baseOptions({
        plugins: {
          legend: { position: 'bottom', labels: { color: this.themeColors().text, font: { family: 'Vazirmatn' }, padding: 12 } }
        },
        cutout: '65%'
      })
    });
  },

  // رتبه‌بندی
  renderRanking(canvasId, students, examName) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const sorted = [...students].sort((a,b) =>
      Analytics.studentPercent(b, examName) - Analytics.studentPercent(a, examName)
    );

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(s => s.fullName),
        datasets: [{
          label: 'درصد',
          data: sorted.map(s => Analytics.studentPercent(s, examName).toFixed(1)),
          backgroundColor: sorted.map((_, i) => {
            if (i === 0) return 'rgba(16,185,129,0.9)';
            if (i === 1) return 'rgba(6,182,212,0.9)';
            if (i === 2) return 'rgba(99,102,241,0.9)';
            return 'rgba(139,92,246,0.7)';
          }),
          borderRadius: 8
        }]
      },
      options: this.baseOptions({
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { color: this.themeColors().text, callback: v => v + '%' }, grid: { color: this.themeColors().grid } },
          y: { ticks: { color: this.themeColors().text, font: { family: 'Vazirmatn', size: 11 } }, grid: { display: false } }
        }
      })
    });
  },

  // تحلیل سوالی - میله‌ای مقایسه‌ای
  renderQuestionAnalysis(canvasId, students, examName, totalQ) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = Array.from({length: totalQ}, (_, i) => `سوال ${i+1}`);
    const classAvg = labels.map((_, i) => Analytics.questionAvg(students, examName, i + 1) * 100);

    // درصد دانش‌آموزانی که پاسخ صحیح داده‌اند
    const correctCount = labels.map((_, i) =>
      students.filter(s => s.exams[examName]?.questions[i+1] === 1).length
    );
    const correctPct = correctCount.map(c => (c / students.length) * 100);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'میانگین درصد پاسخ صحیح',
            data: classAvg.map(v => v.toFixed(1)),
            backgroundColor: 'rgba(99,102,241,0.85)',
            borderRadius: 8
          },
          {
            label: 'درصد دانش‌آموزان موفق',
            data: correctPct.map(v => v.toFixed(1)),
            backgroundColor: 'rgba(16,185,129,0.65)',
            borderRadius: 8
          }
        ]
      },
      options: this.baseOptions({
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: this.themeColors().text, callback: v => v + '%' }, grid: { color: this.themeColors().grid } },
          x: { ticks: { color: this.themeColors().text }, grid: { display: false } }
        }
      })
    });
  },

  // مقایسه آزمون‌ها
  renderCompare(canvasId, students, exams, totalQ) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = Array.from({length: totalQ}, (_, i) => `سوال ${i+1}`);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

    const datasets = exams.map((exam, idx) => ({
      label: exam,
      data: labels.map((_, i) => {
        const avg = Analytics.questionAvg(students, exam, i + 1);
        return (avg * 100).toFixed(1);
      }),
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '30',
      borderWidth: 3,
      tension: 0.4,
      fill: false,
      pointBackgroundColor: colors[idx % colors.length],
      pointRadius: 6
    }));

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: this.baseOptions({
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: this.themeColors().text, callback: v => v + '%' }, grid: { color: this.themeColors().grid } },
          x: { ticks: { color: this.themeColors().text }, grid: { display: false } }
        }
      })
    });
  },

  // روند رشد هر دانش‌آموز
  renderGrowth(canvasId, students, exams) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // نمایش 5 دانش‌آموز اول (یا می‌توان فیلتر کرد)
    const top5 = students.slice(0, 8);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

    const datasets = top5.map((s, i) => ({
      label: s.fullName,
      data: exams.map(e => Analytics.studentPercent(s, e).toFixed(1)),
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '20',
      borderWidth: 3,
      tension: 0.4,
      pointRadius: 5,
      pointBackgroundColor: colors[i % colors.length]
    }));

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: exams, datasets },
      options: this.baseOptions({
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: this.themeColors().text, callback: v => v + '%' }, grid: { color: this.themeColors().grid } },
          x: { ticks: { color: this.themeColors().text, font: { family: 'Vazirmatn' } }, grid: { display: false } }
        }
      })
    });
  },

  // نمودار دانش‌آموز در Modal
  renderStudentDetail(canvasId, student, exams, totalQ) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = Array.from({length: totalQ}, (_, i) => `سوال ${i+1}`);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

    const datasets = exams.map((exam, idx) => ({
      label: exam,
      data: labels.map((_, i) => {
        const v = student.exams[exam]?.questions[i+1];
        return v === null || v === undefined ? 0 : v * 100;
      }),
      backgroundColor: colors[idx % colors.length] + 'cc',
      borderRadius: 6
    }));

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: this.baseOptions({
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: this.themeColors().text, callback: v => v + '%' }, grid: { color: this.themeColors().grid } },
          x: { ticks: { color: this.themeColors().text }, grid: { display: false } }
        }
      })
    });
  }
};