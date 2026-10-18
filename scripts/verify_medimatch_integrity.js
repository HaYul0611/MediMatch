/**
 * verify_medimatch_integrity.js
 * MediMatch 웹 애플리케이션의 무결성, 논문 PDF 다운로드 유효성,
 * 통계 차트 렌더러 반응형 안전성, 모바일 텍스트 가독성 규칙 종합 검증 스크립트.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const researchDir = path.join(rootDir, 'research_paper');
const indexPath = path.join(rootDir, 'index.html');
const cssPath = path.join(rootDir, 'css/app.css');
const statsJsPath = path.join(rootDir, 'js/stats.js');
const appJsPath = path.join(rootDir, 'js/app.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description, condition, extraInfo = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${description} ${extraInfo ? '-> ' + extraInfo : ''}`);
  }
}

console.log('======================================================================');
console.log('       MediMatch 웹 애플리케이션 및 논문 PDF 무결성 종합 검증       ');
console.log('======================================================================\n');

// 1. 논문 PDF 및 연구 산출물 파일 검증
console.log('[1] 논문 파일 및 자체 연구 산출물 패키지 유효성 검증');
assert('research_paper 디렉터리 존재 여부', fs.existsSync(researchDir));

const pdfPath = path.join(researchDir, '논문_의료기관_진료비_미식별_입금_및_사망환자_미수령_환불금의_공공관리체계_구축_방안_오하율.pdf');
assert('정식 논문 PDF 파일 존재 여부', fs.existsSync(pdfPath));
if (fs.existsSync(pdfPath)) {
  const stat = fs.statSync(pdfPath);
  assert(`정식 논문 PDF 크기 적격성 (현재 ${stat.size} bytes >= 800KB)`, stat.size >= 800000);
}

const docxPath = path.join(researchDir, '논문_의료기관_진료비_미식별_입금_및_사망환자_미수령_환불금의_공공관리체계_구축_방안_오하율.docx');
assert('정식 논문 DOCX 파일 존재 여부', fs.existsSync(docxPath));

const zipPath = path.join(researchDir, '재현패키지_오하율.zip');
assert('재현 패키지 ZIP 파일 존재 여부', fs.existsSync(zipPath));

// 2. index.html 링크 무결성 검증
console.log('\n[2] index.html 다운로드 링크 및 경로 무결성 검증');
const htmlContent = fs.readFileSync(indexPath, 'utf8');

assert('index.html 내 구버전 깨진 경로(../research_paper) 완전 제거 확인', !htmlContent.includes('../research_paper'));
assert('index.html 내 구버전 깨진 포트폴리오 경로(../index.html) 완전 제거 확인', !htmlContent.includes('../index.html'));

const pdfLinkMatch = htmlContent.match(/href="([^"]+\.pdf)"/);
assert('논문 PDF 다운로드 링크 존재 여부', !!pdfLinkMatch);
if (pdfLinkMatch) {
  const targetRel = pdfLinkMatch[1];
  const targetAbs = path.join(rootDir, targetRel);
  assert(`다운로드 대상 PDF 파일 실물 존재 확인: ${targetRel}`, fs.existsSync(targetAbs));
}

assert('메인 포트폴리오(SKT_ALEPH) 공식 URL 연계 확인', htmlContent.includes('https://hayul0611.github.io/SKT_ALEPH/'));

// 3. 통계 차트 캔버스 5종 탑재 검증
console.log('\n[3] 5대 통계 캔버스 그래픽 요소 탑재 검증');
const canvasIds = ['chartCvCanvas', 'chartDistCanvas', 'chartHypCanvas', 'chartSurvivalCanvas', 'chartForestCanvas'];
canvasIds.forEach(id => {
  assert(`캔버스 요소 (#${id}) 존재 확인`, htmlContent.includes(`id="${id}"`));
});

// 4. stats.js 반응형 차트 렌더러 안전성 검증
console.log('\n[4] js/stats.js 차트 렌더러 반응형 안전 조치 검증');
const statsContent = fs.readFileSync(statsJsPath, 'utf8');

assert('모바일 뷰포트 감지 플래그(isMobile) 로직 수록', statsContent.includes('isMobile'));
assert('스마트 범례(Legend) 2줄 래핑 및 모바일 단축 레이블 지원', statsContent.includes('totalLegendW > totalW - 24'));
assert('5-Fold CV 차트 Train / Val 정확도 분리 렌더링', statsContent.includes('fold.trainAccuracy.toFixed(1)'));
assert('가설 검정 차트 유의수준 뱃지(Pill) 겹침 방지 수록', statsContent.includes('pText = isMobile ? \'p<.001\' : \'*** p<0.001\''));
assert('가설 검정 바닥 수치 텍스트 여백 보장 로직 수록', statsContent.includes('Math.min(padding.top + chartH - 12'));
assert('포레스트 플롯 모바일 요약 요인명 수록', statsContent.includes('안심상속 증빙'));

// 5. css/app.css 반응형 및 줄바꿈 가독성 가드 검증
console.log('\n[5] css/app.css 모바일/데스크톱 가독성 및 줄바꿈 가드 검증');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert('한국어 줄바꿈 가드(word-break: keep-all) 전역 적용', cssContent.includes('word-break: keep-all;'));
assert('오버플로 줄바꿈 가드(overflow-wrap: break-word) 전역 적용', cssContent.includes('overflow-wrap: break-word;'));
assert('768px 미디어 쿼리 내 아코디언 헤더 모바일 스택 레이아웃 탑재', cssContent.includes('.accordion-header') && cssContent.includes('padding-right: 32px;'));
assert('통계 테이블 가로 스크롤 및 터치 스크롤링(-webkit-overflow-scrolling: touch) 지원', cssContent.includes('-webkit-overflow-scrolling: touch;'));
assert('히어로 배너 모바일 줄바꿈 가독성 개선 규칙 탑재', cssContent.includes('.hero-purpose-statement'));
// 6. README.md 문서 최신화 및 무결성 검증
console.log('\n[6] README.md 문서 최신화 및 무결성 검증');
const readmePath = path.join(rootDir, 'README.md');
assert('README.md 파일 존재 확인', fs.existsSync(readmePath));
const readmeContent = fs.readFileSync(readmePath, 'utf8');

assert('README.md 내 정식 논문 PDF 및 research_paper 산출물 문서화 확인', readmeContent.includes('research_paper/') && readmeContent.includes('논문 PDF 다운로드'));
assert('README.md 내 js/stats.js 및 5대 학술 실증 통계 캔버스 모델 문서화 확인', readmeContent.includes('js/stats.js') && readmeContent.includes('5-Fold 교차검증') && readmeContent.includes('ROI'));
assert('README.md 내 모바일/반응형 뷰포트 및 줄바꿈 가독성 가드 문서화 확인', readmeContent.includes('word-break: keep-all') && readmeContent.includes('아코디언 모바일 수직 스택'));
assert('README.md 내 자동화 무결성 검증 스크립트 실행 가이드 수록 확인', readmeContent.includes('node scripts/verify_medimatch_integrity.js'));
assert('README.md 내 메인 포트폴리오(SKT_ALEPH) 공식 URL 수록 확인', readmeContent.includes('https://hayul0611.github.io/SKT_ALEPH/'));

console.log('\n======================================================================');
console.log('                     종합 검증 결과 요약                     ');
console.log(`  총 검사 항목: ${totalTests}개`);
console.log(`  통과 (PASS):   ${passedTests}개`);
console.log(`  실패 (FAIL):   ${failedTests}개`);
console.log('======================================================================\n');

if (failedTests === 0) {
  console.log('>>> [성공] 모든 검사 항목을 100% 통과하였습니다. MediMatch가 완벽히 보완되었습니다.\n');
  process.exit(0);
} else {
  console.error(`>>> [오류] ${failedTests}개 항목이 통과하지 못했습니다.\n`);
  process.exit(1);
}
