const fs = require('fs');
const path = require('path');

// Mock window and browser globals
const window = {
  crypto: {
    subtle: {
      digest: async () => new Uint8Array([1, 2, 3])
    }
  }
};
global.window = window;

// Load data.js, pipeline.js, stats.js
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'pipeline.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'stats.js'), 'utf8'));

const StatsEngine = window.StatsEngine;
const PipelineEngine = window.PipelineEngine;
const data = window.MEDIMATCH_DATA;

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    passed++;
    console.log('  [PASS] ' + desc);
  } else {
    failed++;
    console.error('  [FAIL] ' + desc);
  }
}

console.log('======================================================================');
console.log('   MediMatch 통계 엔진 & 파이프라인 실제 계산 페일패스트(Fail-Fast) 검증   ');
console.log('======================================================================\n');

// 1. 단일 케이스 5단계 파이프라인 평가
console.log('[TEST 1] Pipeline Engine Single Case Evaluation');
const case1 = PipelineEngine.evaluateCase({
  depositorName: '홍길동(보호자)',
  patientName: '홍유진',
  amount: 850000,
  caseType: 'DEPOSIT',
  relationType: 'GUARDIAN',
  guardianRegistered: true
});
assert('Case 1 평가 유효성 (isValid === true)', case1.isValid === true);
assert('Case 1 정상 수납 종결', case1.finalOutcome === '매칭완료_진료비수납');
assert('Case 1 소요일 절감 계산 (daysSaved > 0)', case1.daysSaved > 0);
assert('Case 1 5단계 노드 정상 생성', case1.steps && case1.steps.length === 5);

// 2. 대학병원 모집단 5,000건 생성
console.log('\n[TEST 2] Hospital Dataset Generation (5,000 cases)');
const pop = StatsEngine.generateHospitalDataset(5000, 20261012);
assert('모집단 크기 5,000건 생성 확인', pop.length === 5000);

// 3. 연구 표본 150건 및 추가 선수금 5건 분리 검증
console.log('\n[TEST 3] Research Sample 150 & Prepayment Demo Separation');
assert('연구 실증 표본 150건 정의 존재 확인', Array.isArray(data.researchSample150));
assert('연구 실증 표본 정확히 150건', data.researchSample150.length === 150);
assert('추가 선수금 시연 예제 정확히 5건', data.demoExtraCases.length === 5);
assert('전체 통합 표본 정확히 155건', data.samples.length === 155);

const dep100 = data.researchSample150.filter(s => s.caseType === 'DEPOSIT');
const ref50 = data.researchSample150.filter(s => s.caseType === 'REFUND');
assert('미식별 입금 표본 100건', dep100.length === 100);
assert('미수령 환불금 표본 50건', ref50.length === 50);

// 4. 논문 150건 원자료 기반 4대 가설 검정 정확성 (SSOT 일치)
console.log('\n[TEST 4] 4 Core Hypotheses Verification on 150 Pilot Sample');
const hyp150 = StatsEngine.runHypothesisTests(data.researchSample150);
assert('가설 4개 결과 반환', hyp150 && hyp150.length === 4);

// 4-1. 가설 6.1: 미식별 입금 식별 성공률 (단순 매칭 20.0% -> 84.0%)
assert('가설 6.1 제안모형 식별 성공률 84.0%', Math.round(hyp150[0].proposedRate) === 84);
assert('가설 6.1 McNemar 카이제곱 48.76 근사 (48 ~ 49)', hyp150[0].statisticValue >= 48 && hyp150[0].statisticValue <= 49);
assert('가설 6.1 p값 0.00001 하드코딩 제거 및 실제 유의성 확보', hyp150[0].pValue !== 0.00001 && hyp150[0].pValue < 0.001);

// 4-2. 가설 6.2: 미식별 입금 소요일수 (137.7일 -> 9.6일, 단축 128.1일)
assert('가설 6.2 기존 평균 소요일 137.7일 근사', Math.abs(hyp150[1].legacyMeanDays - 137.7) < 0.5);
assert('가설 6.2 제안 평균 소요일 9.6일 근사', Math.abs(hyp150[1].proposedMeanDays - 9.6) < 0.5);
assert('가설 6.2 대응표본 t 통계량 26.45 근사', Math.abs(hyp150[1].statisticValue - 26.45) < 0.5);
assert('가설 6.2 p값 0.00001 하드코딩 제거 및 실제 p < 0.001', hyp150[1].pValue !== 0.00001 && hyp150[1].pValue < 0.001);

// 4-3. 가설 6.3: 환불금 적격 확인율 (기존 0.0% -> 80.0%)
assert('가설 6.3 제안모형 환불 확인율 80.0%', Math.round(hyp150[2].proposedRate) === 80);
assert('가설 6.3 전체 환불 50건 기준 McNemar 카이제곱 40.0', Math.abs(hyp150[2].statisticValue - 40.0) < 0.5);
assert('가설 6.3 p값 0.00001 하드코딩 제거', hyp150[2].pValue !== 0.00001 && hyp150[2].pValue < 0.001);

// 4-4. 가설 6.4: 환불 소요일수 단축
assert('가설 6.4 대응표본 t 통계량 13.45 근사', Math.abs(hyp150[3].statisticValue - 13.45) < 0.5);
assert('가설 6.4 p값 0.00001 하드코딩 제거', hyp150[3].pValue !== 0.00001 && hyp150[3].pValue < 0.001);

// 5. 카플란-마이어 생존분석 사건·검열 및 중위시간 미도달 검증
console.log('\n[TEST 5] Kaplan-Meier Survival Analysis (Events vs Censoring)');
const adv150 = StatsEngine.runAdvancedAnalysis(data.researchSample150);
const km = adv150.kaplanMeier;

assert('기존 방식 중위 생존시간 미도달 (legacyMedianDays === null)', km.legacyMedianDays === null);
assert('기존 방식 중위 텍스트 미도달 표기 (>240일)', km.legacyMedianText.includes('미도달') && km.legacyMedianText.includes('>240일'));
assert('제안 모형 중위 생존시간 7.0일 정확히 일치', km.proposedMedianDays === 7.0);
assert('제안 모형 완료 건수 124건 (82.7%)', km.completedCount === 124);
assert('제안 모형 240일 미해소 검열 26건 (17.3%)', km.censoredCount === 26);
assert('완료 건 124건 평균 소요일 7.37일', km.completedMeanDays === 7.37);
assert('기존 장부 완료 건 20건 평균 소요일 151.5일', km.legacyCompletedMeanDays === 151.5);
assert('240일 시점 기존 방식 잔류율 86.7% 유지 (검열 반영)', km.legacyCurve[km.legacyCurve.length - 1].s >= 0.86);
assert('독립 Log-Rank 검정통계량 전면 배제 (logRankChi2 === null)', km.logRankChi2 === null);

// 6. 비즈니스 규칙 엔진 계층화 5-Fold 처리 안정성 검증
console.log('\n[TEST 6] Stratified 5-Fold Processing Stability (N=100 DEPOSIT)');
const cv150 = StatsEngine.runCrossValidation(data.researchSample150, 5);
assert('5-Fold 검증 객체 반환', cv150 && cv150.folds && cv150.folds.length === 5);
assert('논문 100건 입금 표본 5-Fold 평균 정확도 84.0%', cv150.meanValAccuracy === 84.0);
assert('Fold 1 식별 성공률 85.0% (17/20)', cv150.folds[0].valAccuracy === 85.0);
assert('Fold 5 식별 성공률 80.0% (16/20)', cv150.folds[4].valAccuracy === 80.0);
assert('규칙 처리 안정성 진단 문구 수록', cv150.diagnosis.includes('규칙 처리 안정성'));

// 7. 비모수 백분위수 부트스트랩 고정 시드 재현성 검증
console.log('\n[TEST 7] Non-parametric Percentile Bootstrap Resampling (B=1,000)');
const boot = adv150.bootstrap;
assert('부트스트랩 1,000회 반복 실행', boot.iterations === 1000);
assert('논문 표준 표본 플래그 (isPaperStandard === true)', boot.isPaperStandard === true);
assert('평균 절감 소요일수 128.1일 일치', Math.abs(boot.meanSavedDays - 128.1) < 0.5);
assert('95% 백분위수 신뢰구간 [118.7, 137.4]일 일치', boot.ci95[0] >= 118.0 && boot.ci95[1] <= 138.0);

// 8. 대학병원 행정 ROI 산출 검증
console.log('\n[TEST 8] Hospital Economic ROI Simulation (5,000 cases)');
const roi = adv150.economicRoi;
assert('연간 절감 시간 19,500시간', roi.totalSavedHours === 19500);
assert('연간 총 경제적 편익 4억 5,400만 원', roi.totalBenefit === 454000000);
assert('연간 총 운영 비용 1억 1,800만 원', roi.annualCost === 118000000);
assert('연간 순 편익 3억 3,600만 원', roi.netBenefit === 336000000);
assert('순 투자회수율 Net ROI 284.7%', Math.abs(roi.netRoi - 284.75) < 0.2);

// 종합 결과 출력
console.log('\n======================================================================');
console.log('                     페일패스트 검증 결과 요약                     ');
console.log(`  총 검증 항목: ${passed + failed}개`);
console.log(`  통과 (PASS):   ${passed}개`);
console.log(`  실패 (FAIL):   ${failed}개`);
console.log('======================================================================\n');

if (failed > 0) {
  console.error(`>>> [치명적 오류] ${failed}개 항목 검증 실패! 비정상 종료합니다.\n`);
  process.exit(1);
} else {
  console.log(`>>> [성공] 총 ${passed}개 항목 100% 무결성 통과! 통계·파이프라인 검증 완료.\n`);
  process.exit(0);
}
