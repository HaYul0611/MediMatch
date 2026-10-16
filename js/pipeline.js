/**
 * MediMatch - 5단계 다차원 교차검증 및 공공연계 판정 엔진
 * 
 * 연구 논문: 의료기관 진료비 미식별 입금 및 사망환자 미수령 환불금의 공공관리체계 구축 방안 (오하율, 2026)
 * 모형 아키텍처:
 *   [1단계] 1차 단순 성명 대조 (Legacy)
 *   [2단계] HIS 다차원 교차검증 (환자번호, 생년월일, 진료기간, 과거 수납이력)
 *   [3단계] 예외 분류 및 상태값 추적
 *   [4단계] 공공행정정보 연계 (정부24 안심상속 등 상속권자 적격 확인)
 *   [5단계] 적법 후속처리 및 종결 (오지급 원천 차단)
 */

(function (window) {
  'use strict';

  var PipelineEngine = {
    /**
     * 단건 정산 케이스 검증 및 5단계 판정
     * @param {Object} input - 사용자 입력 또는 샘플 데이터
     * @returns {Object} 단계별 처리 결과 및 최종 판정
     */
    evaluateCase: function (input) {
      // 1. 입력 유효성 검증
      var validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          isValid: false,
          errors: validation.errors
        };
      }

      var sanitized = validation.data;
      var steps = [];

      // [1단계] 단순 1:1 성명 대조
      var isDirectNameMatch = (sanitized.depositorName.trim() === sanitized.patientName.trim());
      var step1Detail = isDirectNameMatch
        ? '입금자명과 환자명이 정확히 일치합니다 (' + sanitized.depositorName + ').'
        : (sanitized.isDeceased
            ? '심평원 보험자격 말소 상태 감지 및 입금자명(' + sanitized.depositorName + ')·환자명(' + sanitized.patientName + ') 불일치.'
            : '입금자명(' + sanitized.depositorName + ')과 환자등록명(' + sanitized.patientName + ')이 불일치합니다.');

      steps.push({
        step: 1,
        title: '1차 단순 성명 대조',
        status: isDirectNameMatch ? 'SUCCESS' : 'PENDING',
        detail: step1Detail
      });

      // [2단계] HIS 다차원 교차검증
      var multiDimSuccess = false;
      var multiDimDetail = '';

      if (sanitized.caseType === 'PREPAYMENT') {
        if (isDirectNameMatch) {
          multiDimSuccess = true;
          multiDimDetail = '수진자 본인 선수금(사전 예치금) 계좌 일치. 입원 중간수납/차기 외래 정산 전표 연계 승인.';
        } else if (sanitized.relationType === 'GUARDIAN' && sanitized.guardianRegistered) {
          multiDimSuccess = true;
          multiDimDetail = '원내 HIS 등록 보호자 명의 선수금 납부 확인. 입원 중간수납 및 퇴원 진료비 대체 계좌 연계 완료.';
        } else if (sanitized.relationType === 'UNKNOWN' || !sanitized.guardianRegistered) {
          multiDimSuccess = false;
          multiDimDetail = '원내 미등록 대납자의 선수금 입금. 귀속 환자 특정 불가로 원무과 소명 대기 큐로 이관.';
        } else {
          multiDimSuccess = true;
          multiDimDetail = '원내 선수금 원장 대조를 통해 환자 입원/외래 수납 대체 내역이 확인되었습니다.';
        }
      } else if (isDirectNameMatch) {
        multiDimSuccess = true;
        multiDimDetail = '1단계 일치 건으로 다차원 수납 내역이 자동 승인되었습니다.';
      } else if (sanitized.relationType === 'GUARDIAN' && sanitized.guardianRegistered) {
        multiDimSuccess = true;
        multiDimDetail = '원내 HIS 보호자 등록 정보 및 수납 청구액(' + sanitized.amount.toLocaleString() + '원) 교차 대조 완료.';
      } else if (sanitized.isRenamed && sanitized.hasPrevNameRecord) {
        multiDimSuccess = true;
        multiDimDetail = '주민등록번호 및 개명 전/후 이력 교차 검증으로 동일인 식별 완료.';
      } else if (sanitized.caseType === 'REFUND' && (sanitized.isDeceased || sanitized.isUninsured)) {
        multiDimSuccess = false;
        // 2차에서는 사망을 섣불리 단정하지 않고 자격 부존재(외국인·무자격자 또는 사망 의심)로 감지 후 3차 진단으로 이관
        multiDimDetail = '건강보험 자격 부존재/말소 상태 감지 (외국인·무자격자 또는 사망 의심 등 예외 상태). 2차에서 사망 건으로 단정하는 것은 섣부른 판단이므로, 원내 EMR 진료기록 및 환자 원장 대조 후 3차 정밀 진단 단계로 이관합니다.';
      } else if (sanitized.relationType === 'UNKNOWN' || !sanitized.guardianRegistered) {
        multiDimSuccess = false;
        multiDimDetail = '원내 미등록 대납자(기타 대납) 및 성명 불일치. 내부 전산만으로는 귀속 환자 특정 불가.';
      } else {
        multiDimSuccess = true;
        multiDimDetail = '진료기간 및 수납 내역 복합 대조를 통해 귀속 환자가 특정되었습니다.';
      }

      steps.push({
        step: 2,
        title: '2차 HIS 다차원 교차검증',
        status: multiDimSuccess ? 'SUCCESS' : 'EXCEPTION',
        detail: multiDimDetail
      });

      // [3단계] 예외 분류 및 상태값 추적 (사망 판정은 3차 정밀 진단 후 최종 결정)
      var step3Status = 'TRACKING';
      var step3Detail = '';
      if (sanitized.caseType === 'PREPAYMENT') {
        if (multiDimSuccess) {
          step3Status = 'RESOLVED';
          step3Detail = '선수금(예치금) 수납 정상 분류. 입원 중간수납 시기 도래 또는 차기 외래 시 자동 대체 대기.';
        } else {
          step3Status = 'UNIDENTIFIED_LOG';
          step3Detail = '미확인 선수금 임시 예치 상태로 등재. 입금 확인 전산 알림 및 소명 대기 큐로 이관.';
        }
      } else if (multiDimSuccess) {
        step3Status = 'RESOLVED';
        step3Detail = '정상 매칭 완료 건으로 분류. 예외 추적 종료.';
      } else if (sanitized.caseType === 'REFUND' && sanitized.isDeceased) {
        // 3차에서 원내 EMR 의무기록 및 사망진단서 확인 후 비로소 '사망환자' 판정 확정
        step3Status = 'DECEASED_DIAGNOSED';
        step3Detail = '원내 EMR 의무기록 및 사망진단서(사망선고 기록) 교차 정밀 진단 완료 → [사망환자] 최종 판정 확정. 민법상 임의지급 차단 및 4단계 안심상속 공공행정연계로 이관.';
      } else if (sanitized.caseType === 'REFUND' && sanitized.isUninsured) {
        // 외국인, 무자격자 등 생존 환자로 판정
        step3Status = 'UNINSURED_RESOLVED';
        step3Detail = '원내 EMR 진료기록 대조 결과: 생존 환자(외국인·건보 무자격자 등 보험 미적용)로 확인. 사망 건 배제 후 외국인/무자격자 예외 정산 프로세스로 정상 분류.';
      } else {
        step3Status = 'UNIDENTIFIED_LOG';
        step3Detail = '장기 미식별 예수금 상태로 등재. 입금 확인 전산 알림 및 소명 대기 큐로 이관.';
      }

      steps.push({
        step: 3,
        title: '3차 예외 분류 및 정밀 진단',
        status: step3Status,
        detail: step3Detail
      });

      // [4단계] 공공행정정보 연계 (정부24 안심상속 등)
      var step4Status = 'SKIPPED';
      var step4Detail = '';
      var heirQualified = false;

      if (sanitized.caseType === 'REFUND' && sanitized.isDeceased) {
        if (sanitized.hasHeirPublicProof) {
          step4Status = 'VERIFIED';
          step4Detail = '정부24 안심상속 원스톱 서비스 적격 상속인 증빙(상속관계 및 대리권) 공공 확인 완료.';
          heirQualified = true;
        } else {
          step4Status = 'HOLD';
          step4Detail = '공공 상속 증빙 부존재 또는 상속 분쟁 상태. 오지급 방지를 위해 임의 지급 보류.';
          heirQualified = false;
        }
      } else if (sanitized.caseType === 'REFUND' && sanitized.isUninsured) {
        step4Status = 'NOT_APPLICABLE';
        step4Detail = '생존 환자(외국인·무자격자) 환불 건으로 공공 상속연계 단계를 건너뜁니다.';
      } else if (sanitized.caseType === 'PREPAYMENT') {
        step4Status = 'NOT_APPLICABLE';
        step4Detail = '선수금(사전 예치) 수납 건으로 공공 상속연계 단계를 건너뜁니다.';
      } else if (!multiDimSuccess) {
        step4Status = 'PUBLIC_INQUIRY_STANDBY';
        step4Detail = '미식별 장기 잔류 건으로 기관 행정연계 대기열에 등록되었습니다.';
      } else {
        step4Status = 'NOT_APPLICABLE';
        step4Detail = '사망환자 환불 건이 아니므로 공공 상속연계 단계를 건너뜁니다.';
      }

      steps.push({
        step: 4,
        title: '4차 공공행정정보 연계',
        status: step4Status,
        detail: step4Detail
      });

      // [5단계] 적법 후속처리 및 최종 종결
      var finalOutcome = '';
      var riskControlled = true;
      var daysSaved = 0;

      if (sanitized.caseType === 'PREPAYMENT') {
        if (multiDimSuccess) {
          finalOutcome = '선수금_정상수납대체';
          daysSaved = 95;
        } else {
          finalOutcome = '선수금_수기확인대기';
          daysSaved = 0;
        }
      } else if (sanitized.caseType === 'REFUND' && sanitized.isDeceased) {
        if (heirQualified) {
          finalOutcome = '상속인확인_환불지급';
          daysSaved = 148;
        } else {
          finalOutcome = '상속인부존재_공탁예정';
          daysSaved = 0;
        }
      } else if (sanitized.caseType === 'REFUND' && sanitized.isUninsured) {
        finalOutcome = '외국인무자격_예외수납환불';
        daysSaved = 101;
      } else if (multiDimSuccess) {
        finalOutcome = '매칭완료_진료비수납';
        daysSaved = 128; // 논문 통계 기반
      } else {
        finalOutcome = '장기미식별_지속관리';
        daysSaved = 0;
      }

      steps.push({
        step: 5,
        title: '5차 적법 후속처리 및 종결',
        status: finalOutcome.indexOf('완료') !== -1 || finalOutcome.indexOf('지급') !== -1 || finalOutcome.indexOf('대체') !== -1 || finalOutcome.indexOf('환불') !== -1 ? 'RESOLVED' : 'MANAGED',
        detail: '최종 상태: ' + finalOutcome + ' (오지급 분쟁 노출 차단)'
      });

      return {
        isValid: true,
        input: sanitized,
        steps: steps,
        finalOutcome: finalOutcome,
        legacyMatched: isDirectNameMatch,
        proposedMatched: multiDimSuccess || heirQualified || Boolean(sanitized.isUninsured),
        riskControlled: riskControlled,
        daysSaved: daysSaved
      };
    },

    /**
     * 사용자 입력 데이터 안전 유효성 검사 (잘못된 입력에도 중단되지 않음)
     */
    validateInput: function (raw) {
      var errors = [];
      if (!raw || typeof raw !== 'object') {
        return { isValid: false, errors: ['입력 데이터 객체가 유효하지 않습니다.'] };
      }

      var depositorName = (raw.depositorName || '').toString().trim();
      var patientName = (raw.patientName || '').toString().trim();
      var amount = Number(raw.amount);

      if (!depositorName) {
        errors.push('입금자명을 입력해 주십시오.');
      } else if (depositorName.length > 20) {
        errors.push('입금자명은 20자 이하여야 합니다.');
      }

      if (!patientName) {
        errors.push('환자 등록명을 입력해 주십시오.');
      } else if (patientName.length > 20) {
        errors.push('환자 등록명은 20자 이하여야 합니다.');
      }

      if (isNaN(amount) || amount <= 0) {
        errors.push('금액은 0원보다 큰 올바른 숫자여야 합니다.');
      } else if (amount > 100000000) {
        errors.push('금액이 비정상적으로 큽니다 (1억 원 이하).');
      }

      if (errors.length > 0) {
        return { isValid: false, errors: errors };
      }

      return {
        isValid: true,
        data: {
          depositorName: depositorName,
          patientName: patientName,
          amount: Math.round(amount),
          caseType: raw.caseType === 'REFUND' ? 'REFUND' : (raw.caseType === 'PREPAYMENT' ? 'PREPAYMENT' : 'DEPOSIT'),
          relationType: raw.relationType || 'GUARDIAN',
          guardianRegistered: Boolean(raw.guardianRegistered),
          isRenamed: Boolean(raw.isRenamed),
          hasPrevNameRecord: Boolean(raw.hasPrevNameRecord),
          isDeceased: Boolean(raw.isDeceased),
          isUninsured: Boolean(raw.isUninsured),
          hasHeirPublicProof: Boolean(raw.hasHeirPublicProof)
        }
      };
    },

    /**
     * 전체 샘플 데이터셋 일괄 통계 계산
     * @param {Array} samples - 데이터 배열
     * @returns {Object} 비교 메트릭 결과
     */
    computeBatchMetrics: function (samples) {
      if (!Array.isArray(samples) || samples.length === 0) {
        return null;
      }

      var depTotal = 0;
      var depLegacyMatch = 0;
      var depPropMatch = 0;
      var depLegacyDaysSum = 0;
      var depPropDaysSum = 0;

      var refTotal = 0;
      var refLegacyMatch = 0;
      var refPropMatch = 0;
      var refLegacyDaysSum = 0;
      var refPropDaysSum = 0;
      var deceasedCount = 0;

      for (var i = 0; i < samples.length; i++) {
        var item = samples[i];
        if (item.caseType === 'DEPOSIT' || item.caseType === 'PREPAYMENT') {
          depTotal++;
          if (item.legacyMatched) depLegacyMatch++;
          if (item.proposedMatched) depPropMatch++;
          depLegacyDaysSum += item.daysLegacy;
          depPropDaysSum += item.daysProposed;
        } else if (item.caseType === 'REFUND') {
          refTotal++;
          if (item.isDeceased) deceasedCount++;
          if (item.legacyMatched) refLegacyMatch++;
          if (item.proposedMatched) refPropMatch++;
          refLegacyDaysSum += item.daysLegacy;
          refPropDaysSum += item.daysProposed;
        }
      }

      var depLegacyRate = depTotal > 0 ? (depLegacyMatch / depTotal) * 100 : 0;
      var depPropRate = depTotal > 0 ? (depPropMatch / depTotal) * 100 : 0;
      var depLegacyAvgDays = depTotal > 0 ? depLegacyDaysSum / depTotal : 0;
      var depPropAvgDays = depTotal > 0 ? depPropDaysSum / depTotal : 0;

      var refLegacyRate = refTotal > 0 ? (refLegacyMatch / refTotal) * 100 : 0;
      var refPropRate = refTotal > 0 ? (refPropMatch / refTotal) * 100 : 0;
      var refLegacyAvgDays = refTotal > 0 ? refLegacyDaysSum / refTotal : 0;
      var refPropAvgDays = refTotal > 0 ? refPropDaysSum / refTotal : 0;

      return {
        deposits: {
          total: depTotal,
          legacyMatched: depLegacyMatch,
          proposedMatched: depPropMatch,
          legacyRate: depLegacyRate,
          proposedRate: depPropRate,
          rateDiff: depPropRate - depLegacyRate,
          legacyAvgDays: depLegacyAvgDays,
          proposedAvgDays: depPropAvgDays,
          daysSaved: depLegacyAvgDays - depPropAvgDays
        },
        refunds: {
          total: refTotal,
          deceasedCount: deceasedCount,
          legacyMatched: refLegacyMatch,
          proposedMatched: refPropMatch,
          legacyRate: refLegacyRate,
          proposedRate: refPropRate,
          rateDiff: refPropRate - refLegacyRate,
          legacyAvgDays: refLegacyAvgDays,
          proposedAvgDays: refPropAvgDays,
          daysSaved: refLegacyAvgDays - refPropAvgDays
        },
        totalCount: samples.length
      };
    },

    /**
     * 숫자를 한글 금액 독음으로 변환
     * @param {number} num - 금액 숫자
     * @returns {string} 한글 금액 표현
     */
    numberToKoreanAmount: function (num) {
      if (typeof num !== 'number' || isNaN(num) || num <= 0) {
        return '';
      }
      var units = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
      var smallUnits = ['', '십', '백', '천'];
      var bigUnits = ['', '만', '억', '조'];

      var n = Math.floor(num);
      if (n === 0) return '금 영 원정';

      var result = '';
      var bigUnitIndex = 0;

      while (n > 0) {
        var chunk = n % 10000;
        if (chunk > 0) {
          var chunkStr = '';
          var smallUnitIndex = 0;
          var tempChunk = chunk;
          while (tempChunk > 0) {
            var digit = tempChunk % 10;
            if (digit > 0) {
              chunkStr = units[digit] + smallUnits[smallUnitIndex] + chunkStr;
            }
            smallUnitIndex++;
            tempChunk = Math.floor(tempChunk / 10);
          }
          var unitName = bigUnits[bigUnitIndex] || '';
          if (unitName) {
            result = chunkStr + unitName + (result ? ' ' + result : '');
          } else {
            result = chunkStr + (result ? ' ' + result : '');
          }
        }
        bigUnitIndex++;
        n = Math.floor(n / 10000);
      }

      return '금 ' + result.trim() + ' 원정';
    },

    /**
     * Web Crypto API 기반 표준 SHA-256 해시 계산 (비동기)
     */
    generateCryptoHash: function (seed, callback) {
      var text = (typeof seed === 'object' ? JSON.stringify(seed) : String(seed)) + '_MEDIMATCH_SALT_2026';
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        try {
          var encoder = new TextEncoder();
          var data = encoder.encode(text);
          window.crypto.subtle.digest('SHA-256', data).then(function (buffer) {
            var hashArray = Array.from(new Uint8Array(buffer));
            var hashHex = hashArray.map(function (b) {
              return b.toString(16).padStart(2, '0');
            }).join('');
            callback(hashHex);
          }).catch(function () {
            callback(PipelineEngine.generateAuditHash(seed));
          });
          return;
        } catch (e) {
          // fallback
        }
      }
      callback(this.generateAuditHash(seed));
    },

    /**
     * XSS 방어용 HTML 엔티티 이스케이프
     */
    escapeHtml: function (str) {
      if (typeof str !== 'string') return String(str || '');
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * CSV Injection (DDE 수식 주입 공격) 방어
     */
    sanitizeCsvCell: function (cell) {
      if (typeof cell !== 'string') cell = String(cell || '');
      var trimmed = cell.trim();
      if (/^[=+\-@\t\r]/.test(trimmed)) {
        return "'" + trimmed;
      }
      return trimmed;
    },

    /**
     * 개인정보보호법 안전조치 성명 마스킹
     */
    maskName: function (name) {
      if (!name || typeof name !== 'string') return '';
      var clean = name.trim();
      var parenIdx = clean.indexOf('(');
      var suffix = '';
      if (parenIdx !== -1) {
        suffix = clean.slice(parenIdx);
        clean = clean.slice(0, parenIdx).trim();
      }

      if (clean.length <= 1) {
        return clean + suffix;
      } else if (clean.length === 2) {
        return clean[0] + '*' + suffix;
      } else {
        var mid = '*'.repeat(clean.length - 2);
        return clean[0] + mid + clean[clean.length - 1] + suffix;
      }
    },

    /**
     * 원무 감사 무결성 검증용 모의 SHA-256 해시 생성기
     */
    generateAuditHash: function (seed) {
      var str = (typeof seed === 'object' ? JSON.stringify(seed) : String(seed)) + 'MEDIMATCH_SALT_2026';
      var hash = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
      var hex1 = (hash >>> 0).toString(16).padStart(8, '0');
      var hex2 = ((hash ^ 0x5bd1e995) >>> 0).toString(16).padStart(8, '0');
      var hex3 = ((hash ^ 0x27d4eb2f) >>> 0).toString(16).padStart(8, '0');
      var hex4 = ((hash ^ 0x1597a2f3) >>> 0).toString(16).padStart(8, '0');
      return (hex1 + hex2 + hex3 + hex4 + hex1 + hex3).slice(0, 64);
    },

    /**
     * CSV 텍스트 안전 파싱
     */
    parseCsvText: function (csvText) {
      if (!csvText || typeof csvText !== 'string') return [];
      var lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) return [];

      var header = lines[0].split(',').map(function (h) { return h.trim(); });
      var results = [];

      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var parts = line.split(',');
        if (parts.length < header.length) continue;

        var amountVal = parseInt(parts[2], 10);
        if (isNaN(amountVal) || amountVal <= 0) amountVal = 100000;

        results.push({
          id: this.sanitizeCsvCell(parts[0] || ('CSV-' + i)),
          caseType: parts[1] === 'REFUND' ? 'REFUND' : (parts[1] === 'PREPAYMENT' ? 'PREPAYMENT' : 'DEPOSIT'),
          amount: Math.min(amountVal, 100000000),
          depositorName: this.sanitizeCsvCell(parts[3] || '입금자'),
          patientName: this.sanitizeCsvCell(parts[4] || '환자'),
          reasonCode: parts[5] || 'CUSTOM_CSV',
          legacyMatched: parts[6] === '1' || parts[6] === 'true',
          proposedMatched: parts[7] === '1' || parts[7] === 'true',
          isDeceased: parts[8] === '1' || parts[8] === 'true',
          heirConfirmed: parts[9] === '1' || parts[9] === 'true',
          daysLegacy: parseInt(parts[10], 10) || 90,
          daysProposed: parseInt(parts[11], 10) || 5,
          finalResult: parts[12] ? parts[12].trim() : '매칭완료_진료비수납'
        });
      }

      return results;
    }
  };

  window.PipelineEngine = PipelineEngine;
})(window);
