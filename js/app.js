const Toast = {
  el: null,
  init() { this.el = document.getElementById('toast'); },
  show(msg, ms = 3000) {
    this.el.textContent = msg;
    this.el.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.el.classList.remove('show'), ms);
  }
};

const App = {
  data: null,
  currentExam: null,
  installPrompt: null,

  init() {
    Toast.init();
    this.bindEvents();
    this.registerPWA();
  },

  bindEvents() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length) await this.loadFiles(files);
    });

    const dz = document.getElementById('dropZone');
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => {
      e.preventDefault(); dz.classList.add('dragover');
    }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => {
      e.preventDefault(); dz.classList.remove('dragover');
    }));
    dz.addEventListener('drop', async e => {
      const files = Array.from(e.dataTransfer.files);
      if (files.length) await this.loadFiles(files);
    });

    document.getElementById('btnDemo').addEventListener('click', () => {
      this.data = ExcelReader.demoData();
      this.currentExam = this.data.exams[this.data.exams.length - 1];
      this.render();
      Toast.show('✨ داده نمونه با 3 آزمون بارگذاری شد');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById('btnPrint').addEventListener('click', () => Exporter.print());
    document.getElementById('btnExportHTML').addEventListener('click', () => Exporter.downloadHTML());
    document.getElementById('btnExportShad').addEventListener('click', () => Exporter.copyToShad());
    document.getElementById('btnDarkMode').addEventListener('click', () => this.toggleDark());
    document.getElementById('btnReset').addEventListener('click', () => location.reload());

    document.getElementById('searchStudent').addEventListener('input', e => {
      this.renderStudents(e.target.value);
    });

    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('studentModal').classList.remove('active');
    });
    document.getElementById('studentModal').addEventListener('click', e => {
      if (e.target.id === 'studentModal') e.target.classList.remove('active');
    });

    const btnInstall = document.getElementById('btnInstall');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.installPrompt = e;
      btnInstall.hidden = false;
    });
    btnInstall.addEventListener('click', async () => {
      if (this.installPrompt) {
        this.installPrompt.prompt();
        await this.installPrompt.userChoice;
        this.installPrompt = null;
        btnInstall.hidden = true;
      }
    });

    if (localStorage.getItem('theme') === 'dark') this.toggleDark(true);
  },

  async loadFiles(files) {
    try {
      Toast.show('⏳ در حال پردازش فایل‌ها...');
      let merged = null;

      for (const file of files) {
        const { rows } = await ExcelReader.read(file);
        const parsed = ExcelReader.parse(rows);

        if (!merged) {
          merged = parsed;
        } else {
          // ادغام آزمون‌ها
          parsed.students.forEach(ns => {
            const existing = merged.students.find(s => s.fullName === ns.fullName);
            if (existing) {
              Object.assign(existing.exams, ns.exams);
            } else {
              ns.id = merged.students.length + 1;
              merged.students.push(ns);
            }
          });
          merged.exams = [...new Set([...merged.exams, ...parsed.exams])];
        }
      }

      this.data = merged;
      this.currentExam = merged.exams[merged.exams.length - 1];
      this.render();
      Toast.show(`✅ ${merged.students.length} دانش‌آموز و ${merged.exams.length} آزمون بارگذاری شد`);
    } catch (err) {
      console.error(err);
      Toast.show('❌ خطا: ' + err.message, 5000);
    }
  },

  render() {
    document.getElementById('uploadSection').hidden = true;
    document.getElementById('dashboard').hidden = false;
    this.renderKPIs();
    this.renderOverview();
    this.renderStudents();
    this.renderQuestionsTab();
    this.renderCompareTab();
    this.renderGrowthTab();
  },

  renderKPIs() {
    const d = this.data;
    document.getElementById('kpiStudents').textContent = d.students.length;
    const lastExam = this.currentExam;
    document.getElementById('kpiAvg').textContent =
      (Analytics.classAvg(d.students, lastExam) / 5).toFixed(2);
    document.getElementById('kpiTop').textContent = Analytics.topStudent(d.students).firstName;
    document.getElementById('kpiExams').textContent = d.exams.length;
  },

  renderOverview() {
    const d = this.data;
    Charts.renderQuestions('chartQuestions', d.students, this.currentExam, d.totalQuestions);
    Charts.renderDistribution('chartDistribution', d.students, this.currentExam);
    Charts.renderRanking('chartRanking', d.students, this.currentExam);
  },

  renderStudents(filter = '') {
    const d = this.data;
    const ranks = Analytics.rank(d.students, this.currentExam);
    const list = d.students.filter(s => s.fullName.includes(filter));
    const container = document.getElementById('studentsList');

    container.innerHTML = list.map(s => {
      const pct = Analytics.studentPercent(s, this.currentExam);
      const grade = (pct / 100 * 20).toFixed(1);
      const level = Analytics.level(pct);
      const initial = s.firstName.charAt(0);

      // محاسبه رشد نسبت به آزمون قبلی
      let growthBadge = '';
      const examIdx = d.exams.indexOf(this.currentExam);
      if (examIdx > 0) {
        const prev = d.exams[examIdx - 1];
        const g = Analytics.growth(s, prev, this.currentExam);
        if (g.trend === 'up') growthBadge = `<span style="color:var(--success);font-weight:800;font-size:12px">📈 +${g.delta.toFixed(1)}%</span>`;
        else if (g.trend === 'down') growthBadge = `<span style="color:var(--danger);font-weight:800;font-size:12px">📉 ${g.delta.toFixed(1)}%</span>`;
        else growthBadge = `<span style="color:var(--text-muted);font-size:12px">➖ ثابت</span>`;
      }

      return `
        <div class="student-card" data-id="${s.id}">
          <div class="student-rank">رتبه ${ranks[s.id]}</div>
          <div class="student-avatar" style="background:linear-gradient(135deg,${level.color},var(--secondary))">${initial}</div>
          <div class="student-name">${s.fullName}</div>
          <div class="student-avg" style="background:linear-gradient(135deg,${level.color},var(--secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            ${grade}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;display:flex;justify-content:space-between;align-items:center">
            <span>${level.emoji} ${level.label} — ${pct.toFixed(0)}%</span>
            ${growthBadge}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${level.color},var(--secondary));"></div>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.student-card').forEach(card => {
      card.addEventListener('click', () => this.openStudent(+card.dataset.id));
    });
  },

  renderQuestionsTab() {
    const d = this.data;
    Charts.renderQuestionAnalysis('chartQuestionAnalysis', d.students, this.currentExam, d.totalQuestions);

    // جدول تحلیل سوالات
    let html = `<h3 style="margin-bottom:12px">📋 جزئیات تحلیل سوالات — ${this.currentExam}</h3>
      <table class="q-table">
        <thead>
          <tr>
            <th>سوال</th>
            <th>میانگین کلاس</th>
            <th>تعداد موفق</th>
            <th>درصد موفقیت</th>
            <th>وضعیت</th>
            <th>پاسخ‌های صحیح</th>
          </tr>
        </thead>
        <tbody>`;

    for (let i = 1; i <= d.totalQuestions; i++) {
      const avg = Analytics.questionAvg(d.students, this.currentExam, i) * 100;
      const correct = d.students.filter(s => s.exams[this.currentExam]?.questions[i] === 1).length;
      const pct = (correct / d.students.length) * 100;
      const level = Analytics.level(avg);

      html += `<tr>
        <td><strong>سوال ${i}</strong></td>
        <td>${avg.toFixed(1)}%</td>
        <td>${correct} از ${d.students.length}</td>
        <td>${pct.toFixed(0)}%</td>
        <td><span class="q-badge ${level.badge}">${level.emoji} ${level.label}</span></td>
        <td>${correct === d.students.length ? '🌟 همه' : correct === 0 ? '❗ هیچ‌کس' : `${correct} نفر`}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('questionsTable').innerHTML = html;
  },

  renderCompareTab() {
    const d = this.data;
    if (d.exams.length < 2) {
      document.getElementById('chartCompare').parentElement.innerHTML =
        '<h3>🔄 مقایسه آزمون‌ها</h3><p style="padding:40px;text-align:center;color:var(--text-muted)">برای مشاهده مقایسه، حداقل دو آزمون لازم است. فایل‌های بیشتری بارگذاری کنید.</p>';
      return;
    }

    Charts.renderCompare('chartCompare', d.students, d.exams, d.totalQuestions);

    // جدول مقایسه
    let html = `<h3 style="margin-bottom:12px">📊 مقایسه سوال به سوال در آزمون‌ها</h3>
      <table class="compare-table">
        <thead><tr><th>سوال</th>`;
    d.exams.forEach(e => html += `<th>${e}</th>`);
    html += `<th>تغییر</th></tr></thead><tbody>`;

    for (let i = 1; i <= d.totalQuestions; i++) {
      html += `<tr><td><strong>سوال ${i}</strong></td>`;
      const values = d.exams.map(e => Analytics.questionAvg(d.students, e, i) * 100);
      values.forEach(v => html += `<td>${v.toFixed(1)}%</td>`);

      const delta = values[values.length - 1] - values[0];
      const cls = delta > 2 ? 'delta-up' : delta < -2 ? 'delta-down' : 'delta-stable';
      const sym = delta > 2 ? '📈' : delta < -2 ? '📉' : '➖';
      html += `<td class="${cls}">${sym} ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%</td></tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('compareTable').innerHTML = html;
  },

  renderGrowthTab() {
    const d = this.data;
    if (d.exams.length < 2) {
      document.getElementById('growthList').innerHTML =
        '<p style="padding:40px;text-align:center;color:var(--text-muted)">برای مشاهده روند رشد، حداقل دو آزمون لازم است.</p>';
      return;
    }

    Charts.renderGrowth('chartGrowth', d.students, d.exams);

    const first = d.exams[0];
    const last = d.exams[d.exams.length - 1];

    const html = d.students.map(s => {
      const g = Analytics.growth(s, first, last);
      const badge = g.trend === 'up' ? 'badge-up' : g.trend === 'down' ? 'badge-down' : 'badge-stable';
      return `
        <div class="growth-card">
          <div class="growth-header">
            <span class="growth-name">${s.fullName}</span>
            <span class="growth-badge ${badge}">${g.emoji} ${g.trendLabel}</span>
          </div>
          <div class="growth-values">
            <span>${first}: <strong>${g.from.toFixed(1)}%</strong></span>
            <span>${last}: <strong>${g.to.toFixed(1)}%</strong></span>
            <span style="color:${g.delta > 0 ? 'var(--success)' : g.delta < 0 ? 'var(--danger)' : 'var(--text-muted)'};font-weight:800">
              ${g.delta > 0 ? '+' : ''}${g.delta.toFixed(1)}%
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${g.to}%;background:${g.trend === 'up' ? 'var(--gradient-up)' : g.trend === 'down' ? 'var(--gradient-down)' : 'var(--gradient-1)'}"></div>
          </div>
        </div>`;
    }).join('');

    document.getElementById('growthList').innerHTML = html;
  },

  openStudent(id) {
    const s = this.data.students.find(x => x.id === id);
    if (!s) return;
    const d = this.data;
    const ranks = Analytics.rank(d.students, this.currentExam);
    const pct = Analytics.studentPercent(s, this.currentExam);
    const grade = (pct / 100 * 20).toFixed(2);
    const level = Analytics.level(pct);

    // تحلیل نقاط قوت و ضعف
    const analysis = Analytics.studentStrengths(s, this.currentExam, d.totalQuestions);

    // روند رشد
    let growthHTML = '';
    if (d.exams.length >= 2) {
      growthHTML = d.exams.map((e, i) => {
        const p = Analytics.studentPercent(s, e);
        let deltaHTML = '';
        if (i > 0) {
          const prev = Analytics.studentPercent(s, d.exams[i-1]);
          const delta = p - prev;
          deltaHTML = `<span style="color:${delta > 2 ? 'var(--success)' : delta < -2 ? 'var(--danger)' : 'var(--text-muted)'};font-weight:800;font-size:12px">
            ${delta > 2 ? '📈 +' : delta < -2 ? '📉 ' : '➖ '}${delta.toFixed(1)}%
          </span>`;
        }
        return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
          <span>${e}</span>
          <span><strong>${p.toFixed(1)}%</strong> (${(p/5).toFixed(2)}) ${deltaHTML}</span>
        </div>`;
      }).join('');
    }

    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div class="student-avatar" style="margin:0 auto 12px;width:80px;height:80px;font-size:32px;background:linear-gradient(135deg,${level.color},var(--secondary))">${s.firstName.charAt(0)}</div>
        <h2 style="font-size:20px">${s.fullName}</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px">دبستان پروین اعتصامی — کلاس سوم 1</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:12px">
          <div style="font-size:22px;font-weight:900;color:${level.color}">${grade}</div>
          <div style="font-size:12px;color:var(--text-muted)">نمره از 20</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:12px">
          <div style="font-size:22px;font-weight:900;color:var(--primary)">${pct.toFixed(0)}%</div>
          <div style="font-size:12px;color:var(--text-muted)">درصد کل</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:12px">
          <div style="font-size:22px;font-weight:900;color:var(--warning)">${ranks[s.id]}</div>
          <div style="font-size:12px;color:var(--text-muted)">رتبه در کلاس</div>
        </div>
      </div>

      <div style="margin-bottom:16px;padding:14px;background:var(--bg);border-radius:12px;text-align:center">
        <span style="font-size:14px">${level.emoji} سطح: <strong style="color:${level.color}">${level.label}</strong></span>
      </div>

      <h3 style="font-size:14px;margin:20px 0 10px">📊 نمودار سوال به سوال</h3>
      <div style="height:260px"><canvas id="chartStudent"></canvas></div>

      <h3 style="font-size:14px;margin:20px 0 10px">💪 نقاط قوت و ضعف</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="padding:12px;background:rgba(16,185,129,0.1);border-radius:12px;border-right:3px solid var(--success)">
          <div style="font-weight:800;color:var(--success);margin-bottom:8px">✅ نقاط قوت</div>
          <div style="font-size:13px">${analysis.strengths.length ? analysis.strengths.map(n => `سوال ${n}`).join('، ') : 'ندارد'}</div>
        </div>
        <div style="padding:12px;background:rgba(239,68,68,0.1);border-radius:12px;border-right:3px solid var(--danger)">
          <div style="font-weight:800;color:var(--danger);margin-bottom:8px">⚠️ نقاط ضعف</div>
          <div style="font-size:13px">${analysis.weaknesses.length ? analysis.weaknesses.map(n => `سوال ${n}`).join('، ') : 'ندارد'}</div>
        </div>
      </div>

      ${d.exams.length >= 2 ? `
        <h3 style="font-size:14px;margin:20px 0 10px">📈 روند رشد در آزمون‌ها</h3>
        <div style="background:var(--bg);padding:12px;border-radius:12px">${growthHTML}</div>
      ` : ''}
    `;

    document.getElementById('studentModal').classList.add('active');
    setTimeout(() => Charts.renderStudentDetail('chartStudent', s, d.exams, d.totalQuestions), 100);
  },

  switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + name));
    setTimeout(() => {
      if (name === 'overview') this.renderOverview();
      if (name === 'questions') this.renderQuestionsTab();
      if (name === 'compare') this.renderCompareTab();
      if (name === 'growth') this.renderGrowthTab();
    }, 50);
  },

  toggleDark(force) {
    const isDark = force === true ? true : document.documentElement.getAttribute('data-theme') !== 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.getElementById('btnDarkMode').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (this.data) {
      this.renderOverview();
      this.renderQuestionsTab();
      this.renderCompareTab();
      this.renderGrowthTab();
    }
  },

  registerPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());