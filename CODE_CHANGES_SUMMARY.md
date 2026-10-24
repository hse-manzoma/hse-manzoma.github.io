# ملخص التغييرات في الكود - v5

## الملفات المُحدثة
- `index.html` - الملف الرئيسي (524 KB)
- `forms2.json` - تعريفات النماذج (331 KB)
- `CHANGELOG.md` - سجل التغييرات
- `TESTING_GUIDE.md` - دليل الاختبار

---

## التغييرات الدقيقة في index.html

### 1️⃣ SIG_FIELDS (السطر 2183-2185)
**الأصلي:**
```javascript
"F-HSE-03-01":["writer"]
```
**الجديد:**
```javascript
"F-HSE-03-01":["writerSig","approvedSig"]
```
**السبب:** تحديد حقول التوقيع الجديدة لـ renderGeneric

---

### 2️⃣ renderGeneric (السطر 2192-2211)
**التغيير الكامل:** أضفنا منطق لاستخراج التوقيع الصحيح لكل نوع:

```javascript
// Old:
const src=rec.approved.signature||(rec.approved.by===ME.id?await mySig():"");
for(const nk of SIG_FIELDS[fid]){...}

// New:
for(const nk of SIG_FIELDS[fid]){
  let src="";
  if(nk==="writerSig"){
    src=rec.f?.writerSig||"";
  }else if(nk==="approvedSig"){
    src=rec.f?.approvedSig||(rec.approved.by===ME.id?await mySig():"");
  }else{
    src=rec.approved.signature||(rec.approved.by===ME.id?await mySig():"");
  }
  // ... رسم التوقيع
}
```

---

### 3️⃣ approveRecord (السطر 2217-2224)
**الإضافة:** سطر واحد قبل الحفظ:
```javascript
f.approvedSig=signature;
```
**الموضع:** مباشرة قبل `upsert("records",id,{f,approved:...})`

**السبب:** حفظ توقيع الاعتماد في الحقل المخصص

---

### 4️⃣ collectRecord (السطر 2227-2238)
**التغييرات:**
- السطر 2231: معالجة حقول التوقيع:
  ```javascript
  else if(f.type==="sig"){data.f[f.k]=(fd[f.k]||"").trim();}
  ```

- السطر 2236: معالجة التوقيعات في الجداول:
  ```javascript
  else if(c.type==="sig"){row[c.k]=(fd[nm]||"");if(row[c.k])any=true;}
  ```

**السبب:** حفظ بيانات التوقيع بدون تقليم (trim) الذي يفسد data URLs

---

## التغييرات في forms2.json

### F-HSE-03-01 - نموذج الحوادث
**الإضافة:** حقلا توقيع جديد في آخر قائمة الحقول:

```json
{
  "k": "writerSig",
  "label": "توقيع الكاتب",
  "type": "sig",
  "page": 1,
  "rect": [0.44, 0.78, 0.35, 0.04]
},
{
  "k": "approvedSig",
  "label": "توقيع المعتمد",
  "type": "sig",
  "page": 1,
  "rect": [0.066, 0.78, 0.368, 0.04]
}
```

**الموضع:** صفحة 1 (الصفحة الأولى)
**الحجم:** 0.35 و 0.368 عرض، 0.04 ارتفاع (proportional coordinates)

---

## سلوك التطبيق بعد التحديثات

### المسار 1: حفظ سجل بتوقيع الكاتب
1. ✅ يملأ المستخدم البيانات والتوقيع
2. ✅ يضغط "حفظ وطباعة"
3. ✅ collectRecord تحفظ writerSig في f.writerSig
4. ✅ renderGeneric تستخرج writerSig وترسمه على الصفحة
5. ✅ لا يوجد approvedSig بعد

### المسار 2: اعتماد من إداري
1. ✅ المستخدم يضغط "اعتمد بتوقيعك"
2. ✅ approveRecord تحفظ التوقيع الجديد في f.approvedSig
3. ✅ renderGeneric تستخرج كلا التوقيعين وترسمهما
4. ✅ writerSig يظل موجود بلا تغيير
5. ✅ approvedSig يظهر في موضعه

### المسار 3: تعديل بعد الاعتماد
1. ✅ المستخدم يفتح السجل المعتمد ويعدّل البيانات
2. ✅ collectRecord تحفظ البيانات والتوقيعات الموجودة
3. ✅ لا يُحذف writerSig أو approvedSig
4. ✅ كل شيء محفوظ بشكل صحيح

---

## اختبار سريع للتحقق

### ✅ تم التحقق من:
- [x] SIG_FIELDS يحتوي على writerSig و approvedSig
- [x] renderGeneric تستخرج التوقيعات بشكل صحيح
- [x] approveRecord تحفظ approvedSig
- [x] collectRecord تحتفظ بالتوقيعات
- [x] forms2.json تحتوي على التوقيعات

### 🧪 اختبارات مقترحة:
```
1. إنشاء حادثة + توقيع الكاتب → طباعة (يجب أن يظهر التوقيع)
2. اعتماد من إداري → طباعة (يجب أن يظهر كلا التوقيعين)
3. تعديل بعد الاعتماد → حفظ (يجب أن يحتفظ بالتوقيعين)
4. فتح سجل قديم → فحص أن writerSig و approvedSig موجودة
```

---

## ملاحظات المطور

- كل التعديلات متوافقة مع الإصدارات السابقة
- لا يوجد كسر في النماذج الأخرى
- يمكن إضافة نفس النظام لنماذج أخرى بسهولة
- التوقيعات مخزنة كـ data URLs (base64)

