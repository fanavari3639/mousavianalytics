const Exporter = {
  buildHTML() {
    const styles = Array.from(document.styleSheets).map(sheet => {
      try { return Array.from(sheet.cssRules).map(r => r.cssText).join('\n'); }
      catch { return ''; }
    }).join('\n');

    const header = document.querySelector('.app-header').outerHTML;
    const dashboard = document.getElementById('dashboard').outerHTML;

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>گزارش پیشرفت تحصیلی - پروین اعتصامی</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
<style>${styles}
body { background: #f1f5f9; }
.tab-content { display: block !important; margin-bottom: 30px; }
</style>
</head>
<body>
${header}
${dashboard}
<div style="text-align:center;padding:20px;color:#64748b;font-size:12px">
  گزارش تولید شده در تاریخ ${new Date().toLocaleDateString('fa-IR')} — دبستان پروین اعتصامی
</div>
</body>
</html>`;
  },

  downloadHTML() {
    const html = this.buildHTML();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `گزارش-پیشرفت-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('✅ خروجی HTML دانلود شد');
  },

  // ============ خروجی شاد ============
  shadReport() {
    const d = App.data;
    if (!d) return '';

    const exams = d.exams;
    const lastExam = exams[exams.length - 1];
    const firstExam = exams[0];

    let txt = `📚 *گزارش پیشرفت تحصیلی*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `🏫 دبستان پروین اعتصامی\n`;
    txt += `📖 کلاس: سوم 1\n`;
    txt += `👩‍🏫 معلم: محدثه موسوی\n`;
    txt += `📅 سال تحصیلی: 1405/1406\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    txt += `👥 تعداد دانش‌آموزان: ${d.students.length}\n`;
    txt += `📝 تعداد آزمون‌ها: ${exams.length}\n`;
    txt += `❓ تعداد سوالات: ${d.totalQuestions}\n\n`;

    // میانگین هر آزمون
    txt += `📊 *میانگین کلاس در آزمون‌ها:*\n`;
    exams.forEach(e => {
      const avg = Analytics.classAvg(d.students, e);
      const level = Analytics.level(avg);
      txt += `  ${level.emoji} ${e}: ${avg.toFixed(1)}% (${level.label})\n`;
    });
    txt += `\n`;

    // رتبه‌بندی در آخرین آزمون
    txt += `🏆 *رتبه‌بندی (${lastExam}):*\n`;
    const sorted = [...d.students].sort((a,b) =>
      Analytics.studentPercent(b, lastExam) - Analytics.studentPercent(a, lastExam)
    );
    sorted.forEach((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';
      const pct = Analytics.studentPercent(s, lastExam);
      const grade = (pct / 100 * 20).toFixed(1);
      txt += `${medal} ${i+1}. ${s.fullName}: ${grade} (${pct.toFixed(0)}%)\n`;
    });
    txt += `\n`;

    // تحلیل سوالی آخرین آزمون
    txt += `❓ *تحلیل سوال به سوال (${lastExam}):*\n`;
    for (let i = 1; i <= d.totalQuestions; i++) {
      const avg = Analytics.questionAvg(d.students, lastExam, i) * 100;
      const level = Analytics.level(avg);
      const weakness = avg < 50 ? ' ⚠️ ضعیف' : avg < 75 ? ' متوسط' : ' 💪 قوی';
      txt += `  سوال ${i}: ${avg.toFixed(0)}%${weakness}\n`;
    }
    txt += `\n`;

    // نقاط ضعف کلاس
    const weakQs = [];
    for (let i = 1; i <= d.totalQuestions; i++) {
      const avg = Analytics.questionAvg(d.students, lastExam, i) * 100;
      if (avg < 60) weakQs.push(`سوال ${i} (${avg.toFixed(0)}%)`);
    }
    if (weakQs.length) {
      txt += `⚠️ *نقاط ضعف کلاس در آخرین آزمون:*\n  ${weakQs.join('، ')}\n\n`;
    }

    // روند رشد
    if (exams.length >= 2) {
      txt += `📈 *روند رشد کلی کلاس:*\n`;
      for (let i = 1; i < exams.length; i++) {
        const prev = Analytics.classAvg(d.students, exams[i-1]);
        const curr = Analytics.classAvg(d.students, exams[i]);
        const delta = curr - prev;
        const emoji = delta > 2 ? '📈' : delta < -2 ? '📉' : '➖';
        txt += `  ${emoji} ${exams[i-1]} → ${exams[i]}: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%\n`;
      }
      txt += `\n`;
    }

    txt += `━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `📅 تاریخ: ${new Date().toLocaleDateString('fa-IR')}`;
    return txt;
  },

  async copyToShad() {
    const txt = this.shadReport();
    try {
      await navigator.clipboard.writeText(txt);
      Toast.show('📋 گزارش کپی شد! در شاد Paste کنید', 4000);
      this.downloadTxt(txt);
    } catch {
      this.downloadTxt(txt);
      Toast.show('📥 فایل گزارش شاد دانلود شد');
    }
  },

  downloadTxt(text) {
    const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `گزارش-شاد-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  print() { window.print(); }
};