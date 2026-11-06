import json, hashlib, os, re, sys

HERE = '/home/claude/grades/'
logos = json.load(open(HERE + 'logos.json'))
css = open(HERE + 'app.css', encoding='utf8').read()
logic = open(HERE + 'logic.js', encoding='utf8').read()
app = open(HERE + 'app.js', encoding='utf8').read()

TITLE = 'بوابة الدرجات'
HEAD_TAGS = (
    '<meta name="claude:viewport-fit-sides" content="cover">'
    '<title>' + TITLE + '</title>'
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Reem+Kufi:wght@500;600;700&display=swap">'
)

# skeleton the Artifact tool wraps around the page; refreshed from the live page after the first publish
prefix_file = HERE + 'prefix.txt'
if os.path.exists(prefix_file):
    DOC_PREFIX = open(prefix_file, encoding='utf8').read()
else:
    DOC_PREFIX = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'
                  ':root{color-scheme:light}</style></head><body>')

def js_str(s):
    return json.dumps(s, ensure_ascii=False).replace('</', '<\\/')

# state: keep live state if a state.json exists (when republishing an edited page), else seed
state_file = HERE + 'state.json'
if os.path.exists(state_file):
    state = json.load(open(state_file, encoding='utf8'))
else:
    salt = 'b4pen-7f3a91c2d85e'
    pw = 'Peter@2026#Grades'
    h = hashlib.sha256((salt + ':' + pw).encode('utf8')).hexdigest()
    names = ['أحمد محمود', 'منة الله خالد', 'يوسف عمرو', 'سلمى حسن', 'عمر إبراهيم', 'نور الدين طارق', 'ملك سامي', 'كريم وليد']
    scores = [[18, 17, 27, 9], [20, 19, 28, 10], [15, 16, 24, 8], [19, 18, 27, 9], [17, 15, 25, 8], [16, 16, 23, 8], [14, 13, 22, 7], [12, 14, 20, 6]]
    exams = [('اختبار الشهر الأول', 20), ('اختبار الشهر الثاني', 20), ('امتحان منتصف الترم', 30), ('الواجبات', 10)]
    state = {
        'rev': 1,
        'settings': {'title': TITLE, 'subtitle': 'اختر الصف وتابع درجاتك'},
        'admin': {'u': 'peter', 's': salt, 'h': h},
        'classes': [{'id': i, 'name': n} for i, n in [
            ('p4', 'الصف الرابع الابتدائي'), ('p5', 'الصف الخامس الابتدائي'), ('p6', 'الصف السادس الابتدائي'),
            ('m1', 'الصف الأول الإعدادي'), ('m2', 'الصف الثاني الإعدادي'), ('m3', 'الصف الثالث الإعدادي'),
            ('s1', 'الصف الأول الثانوي'), ('s2', 'الصف الثاني الثانوي'), ('s3', 'الصف الثالث الثانوي'),
            ('cdemo', 'صف تجريبي (امسحه بعد التجربة)')]],
        'students': [{'id': 'sdemo%d' % (i + 1), 'classId': 'cdemo', 'name': n, 'photo': None} for i, n in enumerate(names)],
        'exams': [{'id': 'edemo%d' % (i + 1), 'classId': 'cdemo', 'name': n, 'max': m} for i, (n, m) in enumerate(exams)],
        'grades': {},
    }
    for ei in range(4):
        state['grades']['edemo%d' % (ei + 1)] = {'sdemo%d' % (si + 1): scores[si][ei] for si in range(8)}

app = (app.replace('__LOGO_A__', 'data:image/webp;base64,' + logos['A'])
          .replace('__LOGO_B__', 'data:image/webp;base64,' + logos['B'])
          .replace('__HEAD_TAGS__', js_str(HEAD_TAGS))
          .replace('__DOC_PREFIX__', js_str(DOC_PREFIX)))

code = logic + '\n' + app
open(HERE + 'bundle.js', 'w', encoding='utf8').write(code)

data_json = json.dumps(state, ensure_ascii=False).replace('<', '\\u003c')
page = (HEAD_TAGS +
        '<style id="appstyle">' + css + '</style>' +
        '<div id="app"></div>' +
        '<script id="data" type="application/json">' + data_json + '</script>' +
        '<script id="appcode">' + code + '</script>')
open(HERE + 'index.html', 'w', encoding='utf8').write(page)
print('page bytes', len(page.encode('utf8')))
