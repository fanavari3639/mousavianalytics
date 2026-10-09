// ==================== Excel Reader ====================
const ExcelReader = {
  read(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
          resolve({ sheetName: workbook.SheetNames[0], rows: json });
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // تجزیه داده اکسل شما
  // ساختار: ردیف | نام و نام خانوادگی | نام امتحان | سوال1..9 | جمع کل | نمره کل
  parse(rows) {
    if (rows.length < 2) throw new Error('فایل خالی است');

    // پیدا کردن ایندکس ستون‌ها بر اساس هدر
    const headers = rows[0].map(h => String(h || '').trim());
    const nameIdx = headers.findIndex(h => h.includes('نام و') || h.includes('نام و نام خانوادگی'));
    const examIdx = headers.findIndex(h => h.includes('نام امتحان'));
    const sumIdx  = headers.findIndex(h => h.includes('جمع کل'));
    const totalIdx = headers.findIndex(h => h.includes('نمره کل'));

    // ستون سوالات = هر ستونی که با "سوال" شروع شود
    const questionCols = [];
    headers.forEach((h, i) => {
      if (/^سوال\s*\d+/.test(h)) questionCols.push({ name: h, idx: i, num: questionCols.length + 1 });
    });

    if (nameIdx === -1 || questionCols.length === 0) {
      throw new Error('ساختار فایل شناسایی نشد. ستون‌های «نام و نام خانوادگی» و «سوال 1» لازم است.');
    }

    const students = [];
    let examName = 'آزمون';

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[nameIdx]) continue;

      const fullName = String(row[nameIdx]).trim().replace(/\s+/g, ' ');
      if (!fullName) continue;

      const rowExam = examIdx !== -1 && row[examIdx] ? String(row[examIdx]).trim() : 'آزمون ناشناخته';
      examName = rowExam;

      const questions = {};
      let sum = 0;
      let count = 0;

      questionCols.forEach(q => {
        const v = row[q.idx];
        if (v === null || v === undefined || v === '') {
          questions[q.num] = null;
        } else {
          const num = parseFloat(v);
          questions[q.num] = isNaN(num) ? null : num;
          if (!isNaN(num)) { sum += num; count++; }
        }
      });

      const totalGrade = count > 0 ? (sum / count) * 20 : 0;

      // ادغام با دانش‌آموز قبلی (اگر چند آزمون داشته باشیم)
      let existing = students.find(s => s.fullName === fullName);
      if (!existing) {
        existing = {
          id: students.length + 1,
          fullName,
          firstName: fullName.split(' ')[0],
          exams: {}
        };
        students.push(existing);
      }

      existing.exams[examName] = {
        questions,
        sum,
        totalGrade: parseFloat(totalGrade.toFixed(2)),
        percent: parseFloat(((sum / count) * 100).toFixed(2)),
        rawRow: row
      };
    }

    return {
      students,
      exams: [...new Set(students.flatMap(s => Object.keys(s.exams)))],
      totalQuestions: questionCols.length,
      questionNames: questionCols.map(q => q.name)
    };
  },

  // داده نمونه برای تست (بر اساس فایل شما + آزمون دوم ساختگی)
  demoData() {
    const names = [
      'آلاء آزادوار','ویان بهرامی','رویا بیت سیاح','گلناز بیت سیاح','ریماس جمالپور',
      'نازنین زهرا چنانی','بنین حزبیان','فاطمه زهرا خسرج عبدالله','فاطمه رزمی','رها زایرچی',
      'غزل ساعدی ثابت','هلیا سالمی','فاطمه زهرا سلیمانی','اسماء سواری','دلسا شامیری',
      'ستایش طرفی','ریناس عبیات','میسا عبیات','میرال غافلی','آرام قاسم پور',
      'مارال گرجیان سرمورد','مهتاب مقربی','ملاک منصوری','سیده اسراء موسوی','سیده کوثر موسوی','سیده مهیا موسوی'
    ];

    // آزمون 1: آغازین (ضعیف‌تر)
    // آزمون 2: میان‌ترم (بهبود)
    // آزمون 3: پایان‌ترم (بهبود بیشتر)
    const generateExam = (examName, baseQuality) => {
      const students = names.map((fullName, i) => {
        const base = baseQuality + (Math.random() * 0.3 - 0.15);
        const questions = {};
        for (let q = 1; q <= 9; q++) {
          // برخی سوالات سخت‌تر
          const diffFactor = [0.85, 0.9, 0.95, 1, 0.8, 0.9, 1, 0.95, 0.85][q-1];
          const prob = Math.min(0.98, Math.max(0.15, base * diffFactor));
          questions[q] = Math.random() < prob ? 1 : 0;
        }
        const sum = Object.values(questions).reduce((a,b)=>a+b,0);
        return {
          id: i + 1,
          fullName,
          firstName: fullName.split(' ')[0],
          exams: {
            [examName]: {
              questions,
              sum,
              totalGrade: parseFloat(((sum / 9) * 20).toFixed(2)),
              percent: parseFloat(((sum / 9) * 100).toFixed(2))
            }
          }
        };
      });
      return students;
    };

    const exam1 = 'آزمون آغازین پایه سوم';
    const exam2 = 'آزمون میان‌ترم';
    const exam3 = 'آزمون پایان‌ترم';

    const s1 = generateExam(exam1, 0.55);
    const s2 = generateExam(exam2, 0.7);
    const s3 = generateExam(exam3, 0.82);

    // ادغام سه آزمون در یک ساختار
    const merged = s1.map((student, i) => ({
      ...student,
      exams: {
        ...student.exams,
        ...s2[i].exams,
        ...s3[i].exams
      }
    }));

    return {
      students: merged,
      exams: [exam1, exam2, exam3],
      totalQuestions: 9,
      questionNames: Array.from({length: 9}, (_, i) => `سوال ${i+1}`)
    };
  }
};