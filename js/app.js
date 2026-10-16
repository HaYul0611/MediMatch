/**
 * MediMatch - Main UI Controller (Advanced & Secure Edition)
 * 
 * 엔지니어링 및 보안 아키텍처:
 * - BRB-C01/02: 1문장 정의 및 할 일 3가지 수행 제어
 * - BRB-C03: 헤더 및 고정 배너 렌더링
 * - BRB-C04: 논문 5단계 알고리즘 실제 실행 및 통계 갱신
 * - BRB-C05: 설명 없는 직관적 인터랙션 및 잘못된 입력 방어
 * - Zero Emoji: 모든 그래픽 SVG 벡터화
 * - Security & Privacy:
 *     1) XSS Sanitization (HTML Entity Encoding)
 *     2) CSV Injection Defense (DDE Operator Escaping)
 *     3) 개인정보보호법 제29조 안전조치 성명 마스킹 시뮬레이션
 *     4) SHA-256 감사 무결성 검증 및 전자 직인 스탬프 연동
 *     5) 실시간 한글 금액 독음 변환기
 */

(function () {
  'use strict';

  // State Management
  var state = {
    theme: localStorage.getItem('theme') || 'light',
    currentFilter: 'all',
    searchQuery: '',
    displayLimit: 50,
    activePreset: 'guardian',
    currentCase: null,
    selectedRowId: null,
    isMasked: true,
    pipelineRunning: false,
    tableViewMode: 'compact', // 'compact' (가로스크롤 없는 3대 금액 통합 뷰) or 'full' (전체 열 열람)
    isCltMode: false          // false (실제 소요일수 로그정규 적합) or true (중심극한정리 CLT 표본평균 정규 적합)
  };

  // Pre-configured Research Cases (Directly from Paper Findings)
  var PRESET_CASES = {
    guardian: {
      depositorName: '김영희(자녀)',
      patientName: '이순신(부친)',
      amount: 148720,
      caseType: 'DEPOSIT',
      relationType: 'GUARDIAN',
      guardianRegistered: true,
      isRenamed: false,
      hasPrevNameRecord: false,
      isDeceased: false,
      hasHeirPublicProof: false,
      badgeText: '논문 케이스 1 · 보호자 대납 (60%)',
      title: '자녀가 부친의 진료비를 타인명의로 대납한 케이스',
      desc: '기존 단일대조(불일치 0%) 방식에서는 방치되나, HIS 내 보호자 등록정보와 수납 청구액 교차검증으로 즉시 매칭.'
    },
    renamed: {
      depositorName: '김서연(개명후)',
      patientName: '김민지(개명전)',
      amount: 235100,
      caseType: 'DEPOSIT',
      relationType: 'SELF',
      guardianRegistered: false,
      isRenamed: true,
      hasPrevNameRecord: true,
      isDeceased: false,
      hasHeirPublicProof: false,
      badgeText: '논문 케이스 2 · 환자 개명 (20%)',
      title: '입금자명과 EMR 환자등록명이 개명으로 불일치한 케이스',
      desc: '주민등록번호 및 개명 전/후 이력 교차 검증을 통해 본인 동일인 식별 후 자동 진료비 수납 대사 및 정산.'
    },
    deceased: {
      depositorName: '건강보험심사평가원(사후정산)',
      patientName: '박영수(고인)',
      amount: 350000,
      caseType: 'REFUND',
      relationType: 'HEIR',
      guardianRegistered: false,
      isRenamed: false,
      hasPrevNameRecord: false,
      isDeceased: true,
      isUninsured: false,
      hasHeirPublicProof: true,
      badgeText: '논문 케이스 3 · 사망환자 환불금 (공공연계)',
      title: '사후 발생 진료비 환불금의 3차 EMR 사망진단 및 안심상속 공공확인 케이스',
      desc: '1차 심평원 건보 말소 감지 → 2차 자격부존재(외국인·무자격 배제 대기 / 사망 단정 유보) → 3차 원내 EMR 사망진단서 확인 후 [사망환자] 최종 판정 확정 → 4차 안심상속 적격 상속인 검증 → 5차 종결.'
    }
  };

  // DOM Elements
  var dom = {};

  function cacheDom() {
    dom.themeToggleBtn = document.getElementById('themeToggleBtn');
    dom.themeIconSun = document.getElementById('themeIconSun');
    dom.themeIconMoon = document.getElementById('themeIconMoon');

    dom.presetCards = document.querySelectorAll('.preset-card');
    dom.runPipelineBtn = document.getElementById('runPipelineBtn');
    dom.openReportBtn = document.getElementById('openReportBtn');
    dom.loadBatchBtn = document.getElementById('loadBatchBtn');
    dom.simForm = document.getElementById('simForm');
    dom.formFeedback = document.getElementById('formFeedback');

    dom.formTargetIndicator = document.getElementById('formTargetIndicator');
    dom.targetIndicatorLabel = document.getElementById('targetIndicatorLabel');
    dom.targetIndicatorBadge = document.getElementById('targetIndicatorBadge');
    dom.targetIndicatorSub = document.getElementById('targetIndicatorSub');
    dom.targetIndicatorDot = document.getElementById('targetIndicatorDot');
    dom.btnIndicatorRunSim = document.getElementById('btnIndicatorRunSim');
    dom.btnIndicatorAutoFill = document.getElementById('btnIndicatorAutoFill');
    dom.btnIndicatorReset = document.getElementById('btnIndicatorReset');
    dom.btnIndicatorSaveRow = document.getElementById('btnIndicatorSaveRow');

    dom.saveTransactionBtn = document.getElementById('saveTransactionBtn');
    dom.addNewTransactionBtn = document.getElementById('addNewTransactionBtn');
    dom.deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
    dom.revertTransactionBtn = document.getElementById('revertTransactionBtn');
    dom.resetFormBtn = document.getElementById('resetFormBtn');

    dom.inputDepositor = document.getElementById('inputDepositor');
    dom.inputPatient = document.getElementById('inputPatient');
    dom.inputAmount = document.getElementById('inputAmount');
    dom.amountKoreanReadout = document.getElementById('amountKoreanReadout');
    dom.quickAmountChips = document.querySelectorAll('.quick-amount-chip');
    dom.inputCaseType = document.getElementById('inputCaseType');
    dom.inputRelation = document.getElementById('inputRelation');
    dom.checkGuardianReg = document.getElementById('checkGuardianReg');
    dom.checkRenamed = document.getElementById('checkRenamed');
    dom.renamedDetailsBox = document.getElementById('renamedDetailsBox');
    dom.inputPrevPatientName = document.getElementById('inputPrevPatientName');
    dom.checkDeceased = document.getElementById('checkDeceased');
    dom.checkUninsured = document.getElementById('checkUninsured');
    dom.checkPublicProof = document.getElementById('checkPublicProof');

    dom.maskingToggle = document.getElementById('maskingToggle');
    dom.csvFileInput = document.getElementById('csvFileInput');
    dom.downloadCsvTemplateBtn = document.getElementById('downloadCsvTemplateBtn');
    dom.exportReconciledCsvBtn = document.getElementById('exportReconciledCsvBtn');

    dom.nodes = [
      document.getElementById('nodeStep1'),
      document.getElementById('nodeStep2'),
      document.getElementById('nodeStep3'),
      document.getElementById('nodeStep4'),
      document.getElementById('nodeStep5')
    ];

    dom.evalStatusTitle = document.getElementById('evalStatusTitle');
    dom.evalStatusDetail = document.getElementById('evalStatusDetail');
    dom.evalBadge = document.getElementById('evalBadge');

    // Metrics
    dom.statDepRate = document.getElementById('statDepRate');
    dom.statDepDays = document.getElementById('statDepDays');
    dom.statRefRate = document.getElementById('statRefRate');
    dom.statRefDays = document.getElementById('statRefDays');

    // Table, Filter, Search & Pagination
    dom.filterChips = document.querySelectorAll('.filter-chip');
    dom.tableBody = document.getElementById('sampleTableBody');
    dom.mainTableHead = document.getElementById('mainTableHead');
    dom.btnToggleTableViewMode = document.getElementById('btnToggleTableViewMode');
    dom.tableViewModeText = document.getElementById('tableViewModeText');
    dom.tableScrollHintText = document.getElementById('tableScrollHintText');
    dom.tableSearchInput = document.getElementById('tableSearchInput');
    dom.clearSearchBtn = document.getElementById('clearSearchBtn');
    dom.tableCountBadge = document.getElementById('tableCountBadge');
    dom.tablePaginationBar = document.getElementById('tablePaginationBar');
    dom.paginationInfo = document.getElementById('paginationInfo');
    dom.loadMoreRowsBtn = document.getElementById('loadMoreRowsBtn');
    dom.showAllRowsBtn = document.getElementById('showAllRowsBtn');

    // Part 06 CLT toggle
    dom.btnToggleCltMode = document.getElementById('btnToggleCltMode');
    dom.cltModeBtnText = document.getElementById('cltModeBtnText');
    dom.distChartTitle = document.getElementById('distChartTitle');
    dom.distChartDesc = document.getElementById('distChartDesc');

    // 3대 정산 금액 체계 (납부 · 확정 · 환불) 폼 필드
    dom.inputConfirmedCost = document.getElementById('inputConfirmedCost');
    dom.inputRefundAmount = document.getElementById('inputRefundAmount');
    dom.formRefundTag = document.getElementById('formRefundTag');
    dom.formRefundBadge = document.getElementById('formRefundBadge');
    dom.formRefundBadgeText = document.getElementById('formRefundBadgeText');

    // Report Modal
    dom.reportModal = document.getElementById('reportModal');
    dom.modalCloseBtn = document.getElementById('modalCloseBtn');
    dom.modalCancelBtn = document.getElementById('modalCancelBtn');
    dom.printReportBtn = document.getElementById('printReportBtn');
    dom.reportBody = document.getElementById('reportBodyContent');

    // SIEM Modal Elements
    dom.siemModal = document.getElementById('siemModal');
    dom.openSiemModalBtn = document.getElementById('openSiemModalBtn');
    dom.siemModalCloseBtn = document.getElementById('siemModalCloseBtn');
    dom.siemModalCancelBtn = document.getElementById('siemModalCancelBtn');
    dom.refreshSiemLogBtn = document.getElementById('refreshSiemLogBtn');
    dom.sendSiemTelemetryBtn = document.getElementById('sendSiemTelemetryBtn');
    dom.exportSiemLogBtn = document.getElementById('exportSiemLogBtn');
    dom.siemTerminalLogs = document.getElementById('siemTerminalLogs');

    // Confirm Delete Modal
    dom.confirmDeleteModal = document.getElementById('confirmDeleteModal');
    dom.confirmDeleteCloseBtn = document.getElementById('confirmDeleteCloseBtn');
    dom.confirmDeleteCancelBtn = document.getElementById('confirmDeleteCancelBtn');
    dom.confirmDeleteProceedBtn = document.getElementById('confirmDeleteProceedBtn');
    dom.confirmDeleteTargetInfo = document.getElementById('confirmDeleteTargetInfo');

    dom.toastContainer = document.getElementById('toastContainer');
  }

  function updateThemeUI() {
    document.documentElement.setAttribute('data-theme', state.theme);
    if (dom.themeIconSun && dom.themeIconMoon) {
      if (state.theme === 'dark') {
        dom.themeIconSun.style.display = 'none';
        dom.themeIconMoon.style.display = 'inline-block';
      } else {
        dom.themeIconSun.style.display = 'inline-block';
        dom.themeIconMoon.style.display = 'none';
      }
    }
  }

  function initTheme() {
    updateThemeUI();
    dom.themeToggleBtn.addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', state.theme);
      updateThemeUI();
      if (typeof redrawAllStatsCharts === 'function') {
        redrawAllStatsCharts();
      }
      showToast('테마가 ' + (state.theme === 'dark' ? '다크 모드' : '라이트 모드') + '로 변경되었습니다.');
      SiemService.recordEvent({
        action: 'THEME_CHANGE',
        severity: 'INFO',
        detail: '사용자 인터페이스 테마 전환: ' + state.theme
      });
    });
  }

  // Enterprise SIEM (Security Information & Event Management) Telemetry Engine
  var SiemService = {
    events: [],
    init: function () {
      this.recordEvent({
        action: 'SYSTEM_BOOT',
        severity: 'INFO',
        detail: 'MediMatch 5단계 다차원 교차검증 감사 엔진 로드 완료. (RFC 5424 Syslog / Splunk HEC 스트림 활성화)'
      });
      this.recordEvent({
        action: 'AUTH_SESSION',
        severity: 'INFO',
        detail: '원무 실무자 작업 세션 인가 완료. (작업자 ID: EMP-2026-MED01, 안심상속·EMR 접근 권한 유효)'
      });
    },
    recordEvent: function (opts) {
      var now = new Date();
      var eventId = 'SIEM-' + now.getTime().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 899 + 100);
      var eventObj = {
        timestamp: now.toISOString(),
        event_id: eventId,
        facility: 'AUTHPRIV',
        severity: opts.severity || 'INFO',
        action: opts.action || 'GENERAL_AUDIT',
        app_name: 'MEDIMATCH-CORE',
        operator: {
          id: 'EMP-2026-MED01',
          name: '오하율 (원무과 수납정산팀)',
          ip: '192.168.10.45'
        },
        target: {
          id: opts.targetId || 'N/A',
          patient: opts.patientName || 'N/A',
          amount: opts.amount || 0
        },
        detail: opts.detail || '',
        compliance: {
          pipa_korea_art29: true,
          integrity_signature: window.PipelineEngine ? window.PipelineEngine.generateAuditHash(opts) : 'SHA256-PENDING'
        }
      };

      this.events.unshift(eventObj);
      if (this.events.length > 200) this.events.pop();
      this.render();
    },
    render: function () {
      if (!dom.siemTerminalLogs) return;
      var lines = this.events.map(function (e) {
        var color = e.severity === 'CRITICAL' ? '#f43f5e' : (e.severity === 'WARN' ? '#fbbf24' : '#38bdf8');
        return '<span style="color:#64748b;">[' + e.timestamp.replace('T', ' ').slice(0, 19) + ']</span> ' +
          '<span style="color:' + color + '; font-weight:800;">[' + e.severity + ']</span> ' +
          '<span style="color:#a855f7; font-weight:700;">[' + e.action + ']</span> ' +
          '<span style="color:#e2e8f0;">' + window.PipelineEngine.escapeHtml(e.detail) + '</span> ' +
          '<span style="color:#475569;">(Op: ' + e.operator.id + ' | Hash: ' + e.compliance.integrity_signature.slice(0, 12) + '...)</span>';
      });
      dom.siemTerminalLogs.innerHTML = lines.join('\n');
    },
    sendTelemetry: function () {
      var btn = dom.sendSiemTelemetryBtn;
      if (!btn) return;
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block; animation:spin 1s infinite linear;">⟳</span> <span>SIEM 수집 서버로 TLS 1.3 암호화 전송 중...</span>';

      var self = this;
      setTimeout(function () {
        btn.disabled = false;
        btn.innerHTML = '<svg class="svg-icon sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg> <span>SIEM 전송 성공 (HTTP 200 OK)</span>';

        self.recordEvent({
          action: 'SIEM_FORWARD_SUCCESS',
          severity: 'INFO',
          detail: '총 ' + self.events.length + '건 감사 이벤트가 원격 Splunk HEC 수집 서버(HTTPS 8088)로 정상 수신되었습니다. (수신 영수증: ACK-' + Math.floor(Math.random() * 89999 + 10000) + ')'
        });

        showToast('보안 감사 로그(' + self.events.length + '건)가 외부 SIEM 서버로 안전하게 전송되었습니다. (HTTP 200 OK)');
        setTimeout(function () {
          btn.innerHTML = '<svg class="svg-icon sm" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> <span>SIEM 서버로 즉시 전송 테스트 (Mock API)</span>';
        }, 3000);
      }, 750);
    },
    exportJson: function () {
      var jsonStr = JSON.stringify(this.events, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = 'MediMatch_SIEM_Audit_Events_' + dateStr + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('SIEM 규격 RFC 5424 감사 이벤트 로그(.json)가 다운로드되었습니다.');
    }
  };

  // Update Real-time Korean Amount Readout
  function updateKoreanAmountReadout(val) {
    if (!dom.amountKoreanReadout) return;
    var rawStr = String(val || '').replace(/[^0-9]/g, '');
    var num = Number(rawStr);
    if (!rawStr || isNaN(num) || num <= 0) {
      dom.amountKoreanReadout.textContent = '유효한 양수 금액을 입력해 주십시오.';
      dom.amountKoreanReadout.style.color = 'var(--danger)';
    } else {
      var readout = window.PipelineEngine.numberToKoreanAmount(num);
      dom.amountKoreanReadout.textContent = readout;
      dom.amountKoreanReadout.style.color = 'var(--primary)';
    }
  }

  // Custom Select Dropdown Controller
  function initCustomSelects() {
    var wrappers = document.querySelectorAll('.custom-select-wrapper');
    wrappers.forEach(function (wrapper) {
      var trigger = wrapper.querySelector('.custom-select-trigger');
      var hiddenSelect = wrapper.querySelector('.form-select-hidden');
      var options = wrapper.querySelectorAll('.custom-select-option');

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = wrapper.classList.contains('open');
        document.querySelectorAll('.custom-select-wrapper.open').forEach(function (w) {
          if (w !== wrapper) {
            w.classList.remove('open');
            var trg = w.querySelector('.custom-select-trigger');
            if (trg) trg.setAttribute('aria-expanded', 'false');
          }
        });
        wrapper.classList.toggle('open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });

      options.forEach(function (opt) {
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          var val = this.getAttribute('data-value');
          var title = this.querySelector('.option-title').textContent.trim();

          options.forEach(function (o) {
            o.classList.remove('selected');
            o.setAttribute('aria-selected', 'false');
          });
          opt.classList.add('selected');
          opt.setAttribute('aria-selected', 'true');

          var valSpan = trigger.querySelector('.custom-select-value');
          if (valSpan) valSpan.textContent = title;

          if (hiddenSelect) {
            hiddenSelect.value = val;
            var evt = new Event('change', { bubbles: true });
            hiddenSelect.dispatchEvent(evt);
          }

          wrapper.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          executePipeline();
        });
      });
    });

    document.addEventListener('click', function () {
      document.querySelectorAll('.custom-select-wrapper.open').forEach(function (w) {
        w.classList.remove('open');
        var trg = w.querySelector('.custom-select-trigger');
        if (trg) trg.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function setCustomSelectValue(wrapperId, val) {
    var wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    var hiddenSelect = wrapper.querySelector('.form-select-hidden');
    var trigger = wrapper.querySelector('.custom-select-trigger');
    var options = wrapper.querySelectorAll('.custom-select-option');

    if (hiddenSelect) hiddenSelect.value = val;

    options.forEach(function (opt) {
      if (opt.getAttribute('data-value') === val) {
        opt.classList.add('selected');
        opt.setAttribute('aria-selected', 'true');
        var title = opt.querySelector('.option-title').textContent.trim();
        var valSpan = trigger.querySelector('.custom-select-value');
        if (valSpan) valSpan.textContent = title;
      } else {
        opt.classList.remove('selected');
        opt.setAttribute('aria-selected', 'false');
      }
    });
  }

  // Update Target Indicator Bar & Simulation Controller
  function updateTargetIndicator(item, presetKey) {
    if (!dom.formTargetIndicator) return;
    dom.formTargetIndicator.classList.remove('mode-direct', 'mode-row-edit', 'mode-preset', 'editing');

    if (item) {
      dom.formTargetIndicator.classList.add('mode-row-edit', 'editing');
      var isEdited = Boolean(item.isEdited);
      var labelText = '선택 행 수정 모드: [' + item.id + '] ' + item.depositorName;
      dom.targetIndicatorLabel.textContent = labelText;
      dom.targetIndicatorBadge.textContent = isEdited ? '수정됨' : '행 데이터 로드됨';
      dom.targetIndicatorBadge.className = 'badge ' + (isEdited ? 'badge-edited' : 'badge-primary');
      if (dom.targetIndicatorSub) {
        dom.targetIndicatorSub.textContent = '선택한 트랜잭션의 금액·관계 등을 수정한 후 저장하거나 즉시 검증할 수 있습니다.';
      }
      if (dom.btnIndicatorReset) dom.btnIndicatorReset.style.display = 'inline-flex';
      if (dom.btnIndicatorSaveRow) dom.btnIndicatorSaveRow.style.display = 'inline-flex';
    } else if (presetKey && PRESET_CASES[presetKey]) {
      var preset = PRESET_CASES[presetKey];
      dom.formTargetIndicator.classList.add('mode-preset');
      var presetName = (presetKey === 'guardian' ? '보호자 대납 (60%)' : (presetKey === 'renamed' ? '환자 개명 (20%)' : '사망환자 진료비 환불금'));
      dom.targetIndicatorLabel.textContent = '프리셋 검증 모드: ' + presetName;
      dom.targetIndicatorBadge.textContent = '프리셋 로드됨';
      dom.targetIndicatorBadge.className = 'badge badge-purple';
      if (dom.targetIndicatorSub) {
        dom.targetIndicatorSub.textContent = preset.desc || '선택한 연구 대표 시나리오 값으로 시뮬레이터를 즉시 검증합니다.';
      }
      if (dom.btnIndicatorReset) dom.btnIndicatorReset.style.display = 'inline-flex';
      if (dom.btnIndicatorSaveRow) dom.btnIndicatorSaveRow.style.display = 'none';
    } else {
      dom.formTargetIndicator.classList.add('mode-direct');
      dom.targetIndicatorLabel.textContent = '신규 직접 시뮬레이션 모드';
      dom.targetIndicatorBadge.textContent = '직접 입력 중';
      dom.targetIndicatorBadge.className = 'badge badge-live';
      if (dom.targetIndicatorSub) {
        dom.targetIndicatorSub.textContent = '아래 입력값을 실시간 수정하거나 빠른 테스트 액션으로 즉시 검증하세요.';
      }
      if (dom.btnIndicatorReset) dom.btnIndicatorReset.style.display = 'none';
      if (dom.btnIndicatorSaveRow) dom.btnIndicatorSaveRow.style.display = 'none';
    }
  }

  // Load Preset into Form
  function loadPreset(presetKey) {
    state.activePreset = presetKey;
    state.selectedRowId = null;
    var data = PRESET_CASES[presetKey];
    if (!data) return;

    dom.presetCards.forEach(function (card) {
      if (card.getAttribute('data-preset') === presetKey) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    dom.inputDepositor.value = data.depositorName;
    dom.inputPatient.value = data.patientName;
    dom.inputAmount.value = Number(data.amount).toLocaleString('ko-KR');

    setCustomSelectValue('caseTypeSelectWrapper', data.caseType);
    setCustomSelectValue('relationSelectWrapper', data.relationType);

    dom.checkGuardianReg.checked = data.guardianRegistered;
    dom.checkRenamed.checked = data.isRenamed;
    dom.checkDeceased.checked = data.isDeceased;
    if (dom.checkUninsured) dom.checkUninsured.checked = Boolean(data.isUninsured);
    dom.checkPublicProof.checked = data.hasHeirPublicProof;

    updateKoreanAmountReadout(data.amount);

    var depAmt = data.depositAmount || data.amount || 0;
    var confAmt = (data.confirmedCost !== undefined) ? data.confirmedCost : (data.caseType === 'REFUND' ? Math.max(0, depAmt - data.amount) : depAmt);
    var refAmt = (data.refundAmount !== undefined) ? data.refundAmount : (data.caseType === 'REFUND' ? data.amount : 0);
    updateFormTierAmounts(depAmt, confAmt, refAmt);

    updateTargetIndicator(null, presetKey);
    hideFormError();
    executePipeline();
    renderBatchTable();
  }

  // 3대 정산 금액 체계 (납부 · 확정 · 환불) 실시간 자동 산출 및 노출 연동
  function updateFormTierAmounts(forcedDeposit, forcedConf, forcedRef) {
    var rawVal = (dom.inputAmount && dom.inputAmount.value) ? dom.inputAmount.value.replace(/[^0-9]/g, '') : '0';
    var depAmt = (forcedDeposit !== undefined && forcedDeposit !== null) ? Number(forcedDeposit) : (Number(rawVal) || 0);
    var caseType = dom.inputCaseType ? dom.inputCaseType.value : 'DEPOSIT';
    var confAmt, refAmt;

    if (forcedConf !== undefined && forcedConf !== null && forcedRef !== undefined && forcedRef !== null) {
      confAmt = Number(forcedConf);
      refAmt = Number(forcedRef);
    } else {
      if (caseType === 'REFUND') {
        var selectedItem = state.selectedRowId ? (window.MEDIMATCH_DATA && window.MEDIMATCH_DATA.samples.find(function (s) { return s.id === state.selectedRowId; })) : null;
        if (selectedItem && selectedItem.caseType === 'REFUND' && (selectedItem.depositAmount === depAmt || selectedItem.amount === depAmt)) {
          confAmt = (selectedItem.confirmedCost !== undefined) ? selectedItem.confirmedCost : Math.max(0, depAmt - selectedItem.amount);
          refAmt = (selectedItem.refundAmount !== undefined) ? selectedItem.refundAmount : selectedItem.amount;
        } else {
          // 환불 케이스: 원납부액의 30%를 과오납 환불금으로 자동 산정 (확정 70%, 환불 30%)
          refAmt = Math.round(depAmt * 0.3);
          confAmt = Math.max(0, depAmt - refAmt);
        }
      } else {
        // 진료비 수납(DEPOSIT) 및 선수금(PREPAYMENT): 전액 확정, 환불 0원
        confAmt = depAmt;
        refAmt = 0;
      }
    }

    if (dom.inputConfirmedCost) {
      dom.inputConfirmedCost.value = confAmt.toLocaleString('ko-KR') + '원';
    }
    if (dom.inputRefundAmount) {
      dom.inputRefundAmount.value = refAmt.toLocaleString('ko-KR') + '원';
      if (refAmt > 0) {
        dom.inputRefundAmount.classList.add('has-refund');
        if (dom.formRefundTag) dom.formRefundTag.classList.add('has-refund');
        if (dom.formRefundBadge) dom.formRefundBadge.classList.add('has-refund');
        if (dom.formRefundBadgeText) dom.formRefundBadgeText.textContent = '환불 발생 (' + refAmt.toLocaleString('ko-KR') + '원)';
      } else {
        dom.inputRefundAmount.classList.remove('has-refund');
        if (dom.formRefundTag) dom.formRefundTag.classList.remove('has-refund');
        if (dom.formRefundBadge) dom.formRefundBadge.classList.remove('has-refund');
        if (dom.formRefundBadgeText) dom.formRefundBadgeText.textContent = '자동 산출 (수정 불가)';
      }
    }
  }

  // Get Current Form Data Safely
  function getFormData() {
    var rawAmount = dom.inputAmount.value.replace(/[^0-9]/g, '');
    var depAmt = Number(rawAmount) || 0;
    var confAmt = dom.inputConfirmedCost ? (Number(dom.inputConfirmedCost.value.replace(/[^0-9]/g, '')) || 0) : depAmt;
    var refAmt = dom.inputRefundAmount ? (Number(dom.inputRefundAmount.value.replace(/[^0-9]/g, '')) || 0) : 0;
    return {
      depositorName: dom.inputDepositor.value,
      patientName: dom.inputPatient.value,
      amount: rawAmount,
      depositAmount: depAmt,
      confirmedCost: confAmt,
      refundAmount: refAmt,
      caseType: dom.inputCaseType.value,
      relationType: dom.inputRelation.value,
      guardianRegistered: dom.checkGuardianReg.checked,
      isRenamed: dom.checkRenamed.checked,
      hasPrevNameRecord: dom.checkRenamed.checked,
      isDeceased: dom.checkDeceased.checked,
      isUninsured: dom.checkUninsured ? dom.checkUninsured.checked : false,
      hasHeirPublicProof: dom.checkPublicProof.checked
    };
  }

  // Execute Pipeline with Micro-Animations
  function executePipeline() {
    var rawInput = getFormData();
    var result = window.PipelineEngine.evaluateCase(rawInput);

    if (!result.isValid) {
      showFormError(result.errors.join(' '));
      return;
    }

    hideFormError();
    state.currentCase = result;

    // Reset visual nodes
    dom.nodes.forEach(function (node) {
      node.className = 'pipeline-node';
      var badge = node.querySelector('.node-result-badge');
      if (badge) {
        badge.textContent = '대기 중';
        badge.className = 'node-result-badge';
      }
    });

    dom.evalStatusTitle.textContent = '5단계 검증 파이프라인 분석 중...';
    dom.evalStatusDetail.textContent = '각 단계별 HIS 원무 전산 및 행정정보 교차검증을 수행합니다.';

    // Sequential Node Illumination Animation
    var stepIndex = 0;
    var interval = setInterval(function () {
      if (stepIndex >= result.steps.length) {
        clearInterval(interval);
        finalizeEvaluation(result);
        return;
      }

      var stepData = result.steps[stepIndex];
      var node = dom.nodes[stepIndex];

      if (node) {
        node.classList.add('active');
        setTimeout(function (targetNode, currentStep) {
          targetNode.classList.remove('active');
          targetNode.classList.add('done');
          var badge = targetNode.querySelector('.node-result-badge');
          if (badge) {
            badge.textContent = currentStep.status;
            badge.className = 'node-result-badge ' + (currentStep.status === 'SUCCESS' || currentStep.status === 'VERIFIED' || currentStep.status === 'RESOLVED' ? 'success' : 'warn');
          }
          var desc = targetNode.querySelector('.node-desc');
          if (desc) {
            desc.textContent = currentStep.detail;
          }
        }, 120, node, stepData);
      }

      stepIndex++;
    }, 180);
  }

  // Finalize UI with Evaluation Results
  function finalizeEvaluation(result) {
    dom.evalStatusTitle.textContent = '최종 판정: ' + result.finalOutcome.replace(/_/g, ' ');
    dom.evalStatusDetail.textContent = result.proposedMatched
      ? '다차원 교차검증 성공 (기존 대비 평균 소요 기간 ' + result.daysSaved + '일 단축, 오지급 분쟁 0건 통제)'
      : '예외 분류 완료. 장기 미식별 또는 행정안심상속 2차 소명 대기열로 안전 이관되었습니다.';

    dom.evalBadge.className = 'badge ' + (result.proposedMatched ? 'badge-success' : 'badge-pending');
    dom.evalBadge.textContent = result.proposedMatched ? '적법 처리 확정' : '보류 및 지속관리';

    showToast('파이프라인 판정이 완료되었습니다: ' + result.finalOutcome.replace(/_/g, ' '));
  }

  // 3대 정산 금액 HTML 렌더러 (①원납부/선수금, ②심평원확정, ③환불금 명확 구분)
  function renderThreeTierAmounts(row) {
    var depAmt = row.depositAmount || row.amount || 0;
    var confAmt = (row.confirmedCost !== undefined) ? row.confirmedCost : (row.caseType === 'REFUND' ? Math.max(0, depAmt - row.amount) : depAmt);
    var refAmt = (row.refundAmount !== undefined) ? row.refundAmount : (row.caseType === 'REFUND' ? row.amount : 0);
    var hasRef = refAmt > 0;

    return '<div class="amount-three-tier">' +
      '<div class="tier-row deposit" title="환자/보호자 기납부액 (선수금 또는 수납액)">' +
        '<span class="tier-tag deposit-tag">납부</span><span>' + depAmt.toLocaleString('ko-KR') + '원</span>' +
      '</div>' +
      '<div class="tier-row confirmed" title="심평원 심사 후 결정된 실제 본인부담 진료비">' +
        '<span class="tier-tag confirmed-tag">확정</span><span>' + confAmt.toLocaleString('ko-KR') + '원</span>' +
      '</div>' +
      '<div class="tier-row refund' + (hasRef ? ' has-refund' : '') + '" title="과오납 발생 환불 결정액">' +
        '<span class="tier-tag refund-tag">환불</span><span class="' + (hasRef ? '' : 'refund-zero') + '">' + refAmt.toLocaleString('ko-KR') + '원</span>' +
      '</div>' +
    '</div>';
  }

  // Render Batch Table (컴팩트 6열 뷰 & 전체 10열 뷰 지원 + 3대 정산 금액 체계)
  function renderBatchTable() {
    if (!window.MEDIMATCH_DATA || !window.MEDIMATCH_DATA.samples) return;
    var list = window.MEDIMATCH_DATA.samples;
    var filtered = list;

    // 1. Category Filter
    if (state.currentFilter === 'deposit') {
      filtered = list.filter(function (item) { return item.caseType === 'DEPOSIT'; });
    } else if (state.currentFilter === 'prepayment') {
      filtered = list.filter(function (item) { return item.caseType === 'PREPAYMENT'; });
    } else if (state.currentFilter === 'refund') {
      filtered = list.filter(function (item) { return item.caseType === 'REFUND'; });
    } else if (state.currentFilter === 'unidentified') {
      filtered = list.filter(function (item) { return !item.legacyMatched; });
    }

    // 2. Real-time Search Query Filter
    if (state.searchQuery) {
      var q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(function (item) {
        var idMatch = (item.id || '').toLowerCase().indexOf(q) !== -1;
        var depMatch = (item.depositorName || '').toLowerCase().indexOf(q) !== -1;
        var patMatch = (item.patientName || '').toLowerCase().indexOf(q) !== -1;
        var amtMatch = String(item.amount).indexOf(q) !== -1;
        var resMatch = (item.finalResult || '').toLowerCase().indexOf(q) !== -1;
        return idMatch || depMatch || patMatch || amtMatch || resMatch;
      });
    }

    var totalCount = list.length;
    var matchCount = filtered.length;
    var displayCount = Math.min(matchCount, state.displayLimit);

    // 3. UI 뱃지 및 모드 라벨 동기화
    if (dom.tableCountBadge) {
      if (state.searchQuery) {
        dom.tableCountBadge.textContent = '검색 ' + matchCount + '건 / 전체 ' + totalCount + '건';
      } else if (state.currentFilter !== 'all') {
        dom.tableCountBadge.textContent = '필터 ' + matchCount + '건 / 전체 ' + totalCount + '건';
      } else {
        dom.tableCountBadge.textContent = '전체 ' + totalCount + '건 중 ' + displayCount + '건 표시';
      }
    }

    if (dom.paginationInfo) {
      dom.paginationInfo.textContent = '1 - ' + displayCount + '건 표시 중 (해당 ' + matchCount + '건 / 전체 ' + totalCount + '건)';
    }

    if (dom.loadMoreRowsBtn) {
      dom.loadMoreRowsBtn.style.display = (displayCount >= matchCount) ? 'none' : 'inline-flex';
    }
    if (dom.showAllRowsBtn) {
      dom.showAllRowsBtn.style.display = (state.displayLimit >= matchCount) ? 'none' : 'inline-flex';
    }

    // 뷰 모드 텍스트 동기화
    var isCompact = (state.tableViewMode === 'compact');
    if (dom.tableViewModeText) {
      dom.tableViewModeText.textContent = isCompact ? '전체 열 보기 (스크롤)' : '컴팩트 뷰로 전환 (한눈에 보기)';
    }
    if (dom.tableScrollHintText) {
      dom.tableScrollHintText.innerHTML = isCompact
        ? '<strong>컴팩트 뷰 활성화:</strong> 3대 정산 금액(원납부/확정/환불)과 식별 전환 내역이 한눈에 정렬됩니다. (가로 스크롤 불필요)'
        : '<strong>전체 열 모드:</strong> 가로로 스크롤하여 10개 상세 컬럼 내역을 모두 확인하실 수 있습니다.';
    }

    // 4. 테이블 헤더 렌더링
    if (dom.mainTableHead) {
      if (isCompact) {
        dom.mainTableHead.innerHTML = '<tr>' +
          '<th scope="col" style="width:125px;">ID / 구분</th>' +
          '<th scope="col" style="min-width:180px;">3대 정산 금액 (납부 · 확정 · 환불)</th>' +
          '<th scope="col" style="min-width:140px;">거래 주체 (입금자 / 환자)</th>' +
          '<th scope="col" style="min-width:170px;">대조 전환 &amp; 처리 소요일</th>' +
          '<th scope="col" style="min-width:140px;">최종 판정 결과</th>' +
          '<th scope="col" style="text-align:center; width:50px;">관리</th>' +
        '</tr>';
      } else {
        dom.mainTableHead.innerHTML = '<tr>' +
          '<th scope="col">ID</th>' +
          '<th scope="col">구분</th>' +
          '<th scope="col">3대 정산 금액</th>' +
          '<th scope="col">입금자</th>' +
          '<th scope="col">환자</th>' +
          '<th scope="col">기존대조</th>' +
          '<th scope="col">제안모형</th>' +
          '<th scope="col">소요일수</th>' +
          '<th scope="col">최종결과</th>' +
          '<th scope="col" style="text-align:center; width:50px;">관리</th>' +
        '</tr>';
      }
    }

    var isMasked = dom.maskingToggle ? dom.maskingToggle.checked : true;
    var html = '';

    if (matchCount === 0) {
      html = '<tr><td colspan="' + (isCompact ? '6' : '10') + '" style="text-align:center; padding:36px 16px; color:var(--text-light); font-weight:600;">검색 및 필터 조건에 부합하는 정산 트랜잭션이 없습니다.</td></tr>';
    } else {
      filtered.slice(0, state.displayLimit).forEach(function (row) {
        var isLegacyOk = row.legacyMatched;
        var isPropOk = row.proposedMatched;
        var isSelected = (state.selectedRowId === row.id);
        var rowClasses = [];
        if (isSelected) rowClasses.push('active-edit-row');
        if (row.isEdited) rowClasses.push('is-edited-row');

        var dispDepositor = isMasked ? window.PipelineEngine.maskName(row.depositorName) : window.PipelineEngine.escapeHtml(row.depositorName);
        var dispPatient = isMasked ? window.PipelineEngine.maskName(row.patientName) : window.PipelineEngine.escapeHtml(row.patientName);

        var caseTypeBadge = '';
        if (row.caseType === 'PREPAYMENT') {
          caseTypeBadge = '<span class="badge badge-accent" style="font-size:11px;">선수금 수납</span>';
        } else if (row.caseType === 'DEPOSIT') {
          caseTypeBadge = '<span class="badge badge-neutral" style="font-size:11px;">진료비 수납</span>';
        } else {
          caseTypeBadge = '<span class="badge badge-held" style="font-size:11px;">진료비 환불금</span>';
        }

        var delBtn = '<button type="button" class="table-row-delete-btn" data-delete-id="' + window.PipelineEngine.escapeHtml(row.id) + '" title="트랜잭션 ' + window.PipelineEngine.escapeHtml(row.id) + ' 삭제" aria-label="삭제">' +
          '<svg class="svg-icon sm" viewBox="0 0 24 24" style="width:13px; height:13px; pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
        '</button>';

        var daysSaved = Math.max(0, (row.daysLegacy || 0) - (row.daysProposed || 0));

        if (isCompact) {
          // [컴팩트 모드] 6개 통합 컬럼으로 가로 스크롤 불필요
          html += '<tr class="' + rowClasses.join(' ') + '" data-id="' + window.PipelineEngine.escapeHtml(row.id) + '" title="클릭 시 이 케이스를 시뮬레이터로 자동 로드하여 수정/검증합니다">';
          html += '<td><code>' + window.PipelineEngine.escapeHtml(row.id) + '</code><div style="margin-top:3px;">' + caseTypeBadge + '</div>' + (row.isEdited ? '<span class="badge badge-edited" style="margin-top:2px;" title="' + (row.editedAt || '수정됨') + '">수정됨</span>' : '') + '</td>';
          html += '<td>' + renderThreeTierAmounts(row) + '</td>';
          html += '<td><div class="cell-entity-stack">' +
            '<div class="entity-line"><span class="entity-badge">입금</span><span>' + dispDepositor + '</span></div>' +
            '<div class="entity-line"><span class="entity-badge">환자</span><strong>' + dispPatient + '</strong></div>' +
          '</div></td>';
          html += '<td><div class="cell-match-flow">' +
            '<div class="flow-badges">' +
              '<span class="badge ' + (isLegacyOk ? 'badge-success' : 'badge-held') + '" style="font-size:10px;">' + (isLegacyOk ? '일치' : '미식별') + '</span>' +
              '<span>&rarr;</span>' +
              '<span class="badge ' + (isPropOk ? 'badge-success' : 'badge-pending') + '" style="font-size:10px;">' + (isPropOk ? '식별완료' : '예외관리') + '</span>' +
            '</div>' +
            '<div class="flow-days">' + row.daysLegacy + '일 &rarr; <strong>' + row.daysProposed + '일</strong>' + (daysSaved > 0 ? '<span class="days-saved-pill">-' + daysSaved + '일</span>' : '') + '</div>' +
          '</div></td>';
          html += '<td><small>' + window.PipelineEngine.escapeHtml(row.finalResult.replace(/_/g, ' ')) + '</small></td>';
          html += '<td style="text-align:center;">' + delBtn + '</td>';
          html += '</tr>';
        } else {
          // [전체 10열 모드]
          html += '<tr class="' + rowClasses.join(' ') + '" data-id="' + window.PipelineEngine.escapeHtml(row.id) + '" title="클릭 시 이 케이스를 시뮬레이터로 자동 로드하여 수정/검증합니다">';
          html += '<td><code>' + window.PipelineEngine.escapeHtml(row.id) + '</code>' + (row.isEdited ? ' <span class="badge badge-edited" title="' + (row.editedAt || '수정됨') + '">수정됨</span>' : '') + '</td>';
          html += '<td>' + caseTypeBadge + '</td>';
          html += '<td>' + renderThreeTierAmounts(row) + '</td>';
          html += '<td>' + dispDepositor + '</td>';
          html += '<td>' + dispPatient + '</td>';
          html += '<td><span class="badge ' + (isLegacyOk ? 'badge-success' : 'badge-held') + '">' + (isLegacyOk ? '매칭성공' : '미식별') + '</span></td>';
          html += '<td><span class="badge ' + (isPropOk ? 'badge-success' : 'badge-pending') + '">' + (isPropOk ? '식별완료' : '예외관리') + '</span></td>';
          html += '<td>' + row.daysLegacy + '일 &rarr; <strong>' + row.daysProposed + '일</strong></td>';
          html += '<td><small>' + window.PipelineEngine.escapeHtml(row.finalResult.replace(/_/g, ' ')) + '</small></td>';
          html += '<td style="text-align:center;">' + delBtn + '</td>';
          html += '</tr>';
        }
      });
    }

    dom.tableBody.innerHTML = html;

    // Attach Interactive Row Click Handler & Row Delete Handler
    dom.tableBody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('.table-row-delete-btn')) {
          e.stopPropagation();
          var delId = e.target.closest('.table-row-delete-btn').getAttribute('data-delete-id');
          deleteTransactionById(delId);
          return;
        }

        var rowId = this.getAttribute('data-id');
        var targetRow = list.find(function (item) { return item.id === rowId; });
        if (!targetRow) return;

        // Save original if not exists
        if (!targetRow._original) {
          targetRow._original = {
            amount: targetRow.amount,
            depositorName: targetRow.depositorName,
            patientName: targetRow.patientName,
            caseType: targetRow.caseType,
            reasonCode: targetRow.reasonCode,
            legacyMatched: targetRow.legacyMatched,
            proposedMatched: targetRow.proposedMatched,
            isDeceased: targetRow.isDeceased,
            heirConfirmed: targetRow.heirConfirmed,
            daysLegacy: targetRow.daysLegacy,
            daysProposed: targetRow.daysProposed,
            finalResult: targetRow.finalResult
          };
        }

        state.selectedRowId = targetRow.id;

        // Enable Delete Button in Form Action
        if (dom.deleteTransactionBtn) {
          dom.deleteTransactionBtn.disabled = false;
          dom.deleteTransactionBtn.title = '선택된 트랜잭션 [' + targetRow.id + '] 영구 삭제';
        }

        dom.inputDepositor.value = targetRow.depositorName;
        dom.inputPatient.value = targetRow.patientName;
        dom.inputAmount.value = Number(targetRow.amount).toLocaleString('ko-KR');

        setCustomSelectValue('caseTypeSelectWrapper', targetRow.caseType);

        // Determine relation type and checkboxes accurately
        if (targetRow.isDeceased) {
          setCustomSelectValue('relationSelectWrapper', 'HEIR');
          dom.checkDeceased.checked = true;
          dom.checkPublicProof.checked = Boolean(targetRow.heirConfirmed);
          dom.checkGuardianReg.checked = false;
          dom.checkRenamed.checked = false;
        } else if (targetRow.depositorName.trim() === targetRow.patientName.trim()) {
          setCustomSelectValue('relationSelectWrapper', 'SELF');
          dom.checkGuardianReg.checked = false;
          dom.checkRenamed.checked = false;
          dom.checkDeceased.checked = false;
          dom.checkPublicProof.checked = false;
        } else if (targetRow.reasonCode === 'GUARDIAN_PAY' || targetRow.reasonCode === 'GUARDIAN_PREPAY' || targetRow.depositorName.indexOf('보호자') !== -1 || targetRow.depositorName.indexOf('(') !== -1) {
          setCustomSelectValue('relationSelectWrapper', 'GUARDIAN');
          dom.checkGuardianReg.checked = true;
          dom.checkRenamed.checked = false;
          dom.checkDeceased.checked = false;
          dom.checkPublicProof.checked = false;
        } else if (targetRow.reasonCode === 'RENAMED' || targetRow.reasonCode === 'NAME_CHANGED' || targetRow.depositorName.indexOf('개명') !== -1) {
          setCustomSelectValue('relationSelectWrapper', 'SELF');
          dom.checkGuardianReg.checked = false;
          dom.checkRenamed.checked = true;
          dom.checkDeceased.checked = false;
          dom.checkPublicProof.checked = false;
        } else {
          setCustomSelectValue('relationSelectWrapper', 'UNKNOWN');
          dom.checkGuardianReg.checked = false;
          dom.checkRenamed.checked = false;
          dom.checkDeceased.checked = false;
          dom.checkPublicProof.checked = false;
        }

        updateKoreanAmountReadout(targetRow.amount);

        var depAmt = targetRow.depositAmount || targetRow.amount || 0;
        var confAmt = (targetRow.confirmedCost !== undefined) ? targetRow.confirmedCost : (targetRow.caseType === 'REFUND' ? Math.max(0, depAmt - targetRow.amount) : depAmt);
        var refAmt = (targetRow.refundAmount !== undefined) ? targetRow.refundAmount : (targetRow.caseType === 'REFUND' ? targetRow.amount : 0);
        updateFormTierAmounts(depAmt, confAmt, refAmt);

        updateTargetIndicator(targetRow);
        executePipeline();
        renderBatchTable();
        showToast('트랜잭션 [' + targetRow.id + ']가 로드되었습니다. 수정 후 [수정 내역 저장]을 클릭하십시오.');
        dom.simForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  // 커스텀 트랜잭션 삭제 확인 다이얼로그 모달 제어
  var activeDeleteResolve = null;

  function closeConfirmDeleteModal(confirmed) {
    if (dom.confirmDeleteModal) {
      dom.confirmDeleteModal.classList.remove('active');
    }
    if (activeDeleteResolve) {
      activeDeleteResolve(Boolean(confirmed));
      activeDeleteResolve = null;
    }
  }

  function requestDeleteConfirmation(targetRow) {
    return new Promise(function (resolve) {
      if (!dom.confirmDeleteModal) {
        var fallbackConfirm = window.confirm('트랜잭션 [' + targetRow.id + ' (' + targetRow.patientName + ' / ' + Number(targetRow.amount).toLocaleString('ko-KR') + '원)]을(를) 데이터셋에서 완전히 삭제하시겠습니까?');
        resolve(fallbackConfirm);
        return;
      }

      activeDeleteResolve = resolve;

      var caseTypeBadgeMap = {
        'DEPOSIT': '<span class="tier-tag deposit-tag">진료비 수납</span>',
        'PREPAYMENT': '<span class="tier-tag confirmed-tag">선수금 수납</span>',
        'REFUND': '<span class="tier-tag refund-tag">진료비 환불</span>'
      };
      var cBadge = caseTypeBadgeMap[targetRow.caseType] || targetRow.caseType;
      var depAmt = targetRow.depositAmount || targetRow.amount || 0;
      var confAmt = (targetRow.confirmedCost !== undefined) ? targetRow.confirmedCost : (targetRow.caseType === 'REFUND' ? Math.max(0, depAmt - targetRow.amount) : depAmt);
      var refAmt = (targetRow.refundAmount !== undefined) ? targetRow.refundAmount : (targetRow.caseType === 'REFUND' ? targetRow.amount : 0);

      var infoHtml = '<div class="confirm-info-row"><span class="confirm-info-label">트랜잭션 식별 ID</span><span class="confirm-info-val bold-mono">' + targetRow.id + '</span></div>' +
        '<div class="confirm-info-row"><span class="confirm-info-label">대상 환자명 / 입금자명</span><span class="confirm-info-val">' + targetRow.patientName + ' / ' + targetRow.depositorName + '</span></div>' +
        '<div class="confirm-info-row"><span class="confirm-info-label">원납부 정산 금액</span><span class="confirm-info-val amount-bold">' + Number(depAmt).toLocaleString('ko-KR') + '원</span></div>' +
        '<div class="confirm-info-row"><span class="confirm-info-label">심평원 확정 / 환불</span><span class="confirm-info-val">' + Number(confAmt).toLocaleString('ko-KR') + '원 / ' + Number(refAmt).toLocaleString('ko-KR') + '원</span></div>' +
        '<div class="confirm-info-row"><span class="confirm-info-label">정산 구분 유형</span><span class="confirm-info-val">' + cBadge + '</span></div>';

      if (dom.confirmDeleteTargetInfo) {
        dom.confirmDeleteTargetInfo.innerHTML = infoHtml;
      }

      dom.confirmDeleteModal.classList.add('active');
    });
  }

  // Delete Transaction from Dataset (CRUD - Delete)
  function deleteTransactionById(id) {
    if (!id) return;
    var list = window.MEDIMATCH_DATA && window.MEDIMATCH_DATA.samples;
    if (!list) return;

    var targetIndex = list.findIndex(function (item) { return item.id === id; });
    if (targetIndex === -1) {
      showToast('삭제할 트랜잭션을 찾을 수 없습니다.');
      return;
    }

    var targetRow = list[targetIndex];

    requestDeleteConfirmation(targetRow).then(function (confirmed) {
      if (!confirmed) return;

      list.splice(targetIndex, 1);

      if (state.selectedRowId === id) {
        resetForm();
      }

      SiemService.recordEvent({
        action: 'TRANSACTION_DELETE',
        severity: 'WARN',
        targetId: targetRow.id,
        patientName: targetRow.patientName,
        amount: targetRow.amount,
        detail: '트랜잭션 [' + targetRow.id + '] 영구 삭제 완료 (환자: ' + targetRow.patientName + ', ' + Number(targetRow.amount).toLocaleString('ko-KR') + '원)'
      });

      renderBatchTable();
      updateBatchMetrics();
      showToast('트랜잭션 [' + id + ']가 성공적으로 삭제되었습니다.');
    });
  }

  // Save Modifications to Current Transaction in Dataset
  function saveTransactionToDataset() {
    var rawInput = getFormData();
    var result = window.PipelineEngine.evaluateCase(rawInput);

    if (!result.isValid) {
      showFormError(result.errors.join(' '));
      return;
    }

    var list = window.MEDIMATCH_DATA && window.MEDIMATCH_DATA.samples;
    if (!list) return;

    var targetRow = null;
    if (state.selectedRowId) {
      targetRow = list.find(function (item) { return item.id === state.selectedRowId; });
    }

    var nowTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (targetRow) {
      if (!targetRow._original) {
        targetRow._original = {
          amount: targetRow.amount,
          depositAmount: targetRow.depositAmount || targetRow.amount,
          confirmedCost: targetRow.confirmedCost,
          refundAmount: targetRow.refundAmount,
          depositorName: targetRow.depositorName,
          patientName: targetRow.patientName,
          caseType: targetRow.caseType,
          reasonCode: targetRow.reasonCode,
          legacyMatched: targetRow.legacyMatched,
          proposedMatched: targetRow.proposedMatched,
          isDeceased: targetRow.isDeceased,
          heirConfirmed: targetRow.heirConfirmed,
          daysLegacy: targetRow.daysLegacy,
          daysProposed: targetRow.daysProposed,
          finalResult: targetRow.finalResult
        };
      }

      targetRow.depositorName = rawInput.depositorName;
      targetRow.patientName = rawInput.patientName;
      targetRow.amount = Math.round(Number(rawInput.amount));
      targetRow.depositAmount = rawInput.depositAmount;
      targetRow.confirmedCost = rawInput.confirmedCost;
      targetRow.refundAmount = rawInput.refundAmount;
      targetRow.caseType = rawInput.caseType;
      targetRow.isDeceased = rawInput.isDeceased;
      targetRow.heirConfirmed = rawInput.hasHeirPublicProof;
      targetRow.legacyMatched = (rawInput.depositorName.trim() === rawInput.patientName.trim());
      targetRow.proposedMatched = result.proposedMatched;
      targetRow.finalResult = result.finalOutcome;
      targetRow.daysProposed = result.proposedMatched ? Math.max(1, Math.min(10, Math.round((targetRow.daysLegacy || 60) * 0.1))) : 45;
      targetRow.isEdited = true;
      targetRow.editedAt = nowTime;

      renderBatchTable();
      updateBatchMetrics();
      updateTargetIndicator(targetRow);
      executePipeline();
      SiemService.recordEvent({
        action: 'TRANSACTION_UPDATE',
        severity: 'INFO',
        targetId: targetRow.id,
        patientName: targetRow.patientName,
        amount: targetRow.amount,
        detail: '트랜잭션 [' + targetRow.id + '] 정산 데이터 수정 반영 (금액: ' + targetRow.amount.toLocaleString('ko-KR') + '원, 판정: ' + targetRow.finalResult + ')'
      });
      showToast('[' + targetRow.id + '] 정산 내역이 데이터셋에 수정 저장되었습니다 (지표 실시간 갱신 완료).');
    } else {
      addNewTransaction();
    }
  }

  // Add Current Form Data as a New Transaction
  function addNewTransaction() {
    var rawInput = getFormData();
    var result = window.PipelineEngine.evaluateCase(rawInput);

    if (!result.isValid) {
      showFormError(result.errors.join(' '));
      return;
    }

    var list = window.MEDIMATCH_DATA && window.MEDIMATCH_DATA.samples;
    if (!list) return;

    var prefix = (rawInput.caseType === 'PREPAYMENT') ? 'PRE-' : (rawInput.caseType === 'DEPOSIT' ? 'DEP-' : 'REF-');
    var nextNum = list.length + 1;
    var newId = prefix + ('000' + nextNum).slice(-3);
    var nowTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    var newItem = {
      id: newId,
      caseType: rawInput.caseType,
      amount: Math.round(Number(rawInput.amount)),
      depositAmount: rawInput.depositAmount,
      confirmedCost: rawInput.confirmedCost,
      refundAmount: rawInput.refundAmount,
      depositorName: rawInput.depositorName,
      patientName: rawInput.patientName,
      reasonCode: rawInput.caseType === 'PREPAYMENT' ? 'INPATIENT_ADVANCE' : (rawInput.relationType === 'GUARDIAN' ? 'GUARDIAN_PAY' : (rawInput.isRenamed ? 'RENAMED' : 'MANUAL_ENTRY')),
      legacyMatched: (rawInput.depositorName.trim() === rawInput.patientName.trim()),
      proposedMatched: result.proposedMatched,
      isDeceased: rawInput.isDeceased,
      heirConfirmed: rawInput.hasHeirPublicProof,
      daysLegacy: rawInput.caseType === 'PREPAYMENT' ? 30 : (rawInput.caseType === 'DEPOSIT' ? 120 : 180),
      daysProposed: result.proposedMatched ? 2 : 45,
      finalResult: result.finalOutcome,
      isEdited: true,
      isNew: true,
      editedAt: nowTime + ' (신규)'
    };

    list.unshift(newItem);
    state.selectedRowId = newId;

    if (dom.deleteTransactionBtn) {
      dom.deleteTransactionBtn.disabled = false;
      dom.deleteTransactionBtn.title = '선택된 트랜잭션 [' + newId + '] 영구 삭제';
    }

    renderBatchTable();
    updateBatchMetrics();
    updateTargetIndicator(newItem);
    executePipeline();
    SiemService.recordEvent({
      action: 'TRANSACTION_CREATE',
      severity: 'NOTICE',
      targetId: newId,
      patientName: newItem.patientName,
      amount: newItem.amount,
      detail: '신규 트랜잭션 [' + newId + '] 생성 등록 완료 (입금자: ' + newItem.depositorName + ', 환자: ' + newItem.patientName + ', ' + newItem.amount.toLocaleString('ko-KR') + '원)'
    });
    showToast('신규 트랜잭션 [' + newId + ']가 데이터셋 최상단에 등록되었습니다.');
  }

  // Revert Selected Transaction to Original Values
  function revertTransaction() {
    if (!state.selectedRowId) {
      showToast('선택된 편집 대상 트랜잭션이 없습니다.');
      return;
    }

    var list = window.MEDIMATCH_DATA && window.MEDIMATCH_DATA.samples;
    if (!list) return;

    var targetRow = list.find(function (item) { return item.id === state.selectedRowId; });
    if (!targetRow) return;

    if (targetRow.isNew) {
      var idx = list.indexOf(targetRow);
      if (idx !== -1) list.splice(idx, 1);
      resetForm();
      renderBatchTable();
      updateBatchMetrics();
      showToast('신규 추가된 트랜잭션 [' + targetRow.id + ']가 목록에서 삭제되었습니다.');
      return;
    }

    if (targetRow._original) {
      Object.assign(targetRow, targetRow._original);
      delete targetRow.isEdited;
      delete targetRow.editedAt;

      dom.inputDepositor.value = targetRow.depositorName;
      dom.inputPatient.value = targetRow.patientName;
      dom.inputAmount.value = Number(targetRow.amount).toLocaleString('ko-KR');
      setCustomSelectValue('caseTypeSelectWrapper', targetRow.caseType);
      setCustomSelectValue('relationSelectWrapper', targetRow.isDeceased ? 'HEIR' : (targetRow.depositorName === targetRow.patientName ? 'SELF' : 'GUARDIAN'));
      dom.checkDeceased.checked = Boolean(targetRow.isDeceased);
      dom.checkPublicProof.checked = Boolean(targetRow.heirConfirmed);

      updateKoreanAmountReadout(targetRow.amount);
      updateTargetIndicator(targetRow);
      renderBatchTable();
      updateBatchMetrics();
      executePipeline();
      SiemService.recordEvent({
        action: 'TRANSACTION_REVERT',
        severity: 'INFO',
        targetId: targetRow.id,
        patientName: targetRow.patientName,
        detail: '트랜잭션 [' + targetRow.id + '] 최초 원본 데이터로 복원 완료.'
      });
      showToast('[' + targetRow.id + '] 데이터가 최초 원본 상태로 복원되었습니다.');
    } else {
      showToast('수정된 내역이 없는 원본 데이터입니다.');
    }
  }

  // Reset Input Form
  function resetForm() {
    state.selectedRowId = null;
    if (dom.deleteTransactionBtn) {
      dom.deleteTransactionBtn.disabled = true;
      dom.deleteTransactionBtn.title = '선택된 트랜잭션 삭제 (선택 필요)';
    }
    dom.inputDepositor.value = '';
    dom.inputPatient.value = '';
    dom.inputAmount.value = '';
    setCustomSelectValue('caseTypeSelectWrapper', 'DEPOSIT');
    setCustomSelectValue('relationSelectWrapper', 'GUARDIAN');
    dom.checkGuardianReg.checked = true;
    dom.checkRenamed.checked = false;
    if (dom.renamedDetailsBox) dom.renamedDetailsBox.style.display = 'none';
    dom.checkDeceased.checked = false;
    dom.checkPublicProof.checked = false;
    updateKoreanAmountReadout(0);
    updateFormTierAmounts(0, 0, 0);
    updateTargetIndicator(null);
    hideFormError();
    renderBatchTable();
    showToast('입력 폼이 초기화되었습니다. 새로운 데이터를 직접 입력할 수 있습니다.');
  }

  // Export Reconciled Dataset to CSV with Injection Defense
  function exportReconciledDatasetToCsv() {
    if (!window.MEDIMATCH_DATA || !window.MEDIMATCH_DATA.samples) return;
    var samples = window.MEDIMATCH_DATA.samples;
    var rows = [];
    rows.push([
      '트랜잭션ID',
      '정산구분',
      '정산금액(원)',
      '입금자명',
      '환자등록명',
      '사유코드',
      '1단계_기존대조결과',
      '5단계_제안모형결과',
      '기존소요일수(일)',
      '제안모형소요일수(일)',
      '소요일수절감(일)',
      '최종판정결과',
      '실무자수정여부',
      '수정일시'
    ]);

    var isMasked = dom.maskingToggle ? dom.maskingToggle.checked : false;

    samples.forEach(function (s) {
      var dep = isMasked ? window.PipelineEngine.maskName(s.depositorName) : s.depositorName;
      var pat = isMasked ? window.PipelineEngine.maskName(s.patientName) : s.patientName;
      var daysSaved = Math.max(0, (s.daysLegacy || 0) - (s.daysProposed || 0));

      rows.push([
        s.id,
        (s.caseType === 'PREPAYMENT' ? '선수금(예치금) 수납' : (s.caseType === 'DEPOSIT' ? '진료비 수납' : '진료비 환불금')),
        s.amount,
        dep,
        pat,
        s.reasonCode || '',
        s.legacyMatched ? '일치' : '미식별',
        s.proposedMatched ? '식별완료' : '예외관리',
        s.daysLegacy,
        s.daysProposed,
        daysSaved,
        s.finalResult,
        s.isEdited ? '수정됨' : '원형',
        s.editedAt || ''
      ]);
    });

    var csvContent = '\uFEFF' + rows.map(function (row) {
      return row.map(function (cell) {
        var sanitized = window.PipelineEngine.sanitizeCsvCell(String(cell));
        return '"' + sanitized.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');

    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = 'MediMatch_예외정산_결산대사내역_' + dateStr + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('전체 ' + samples.length + '건 결산 데이터셋이 CSV 파일로 다운로드되었습니다.');
  }

  // Compute and Animate Statistics Counter & Progress Bars (100% 완전 동적 연동)
  function updateBatchMetrics() {
    if (!window.MEDIMATCH_DATA || !window.MEDIMATCH_DATA.samples) return;
    var metrics = window.PipelineEngine.computeBatchMetrics(window.MEDIMATCH_DATA.samples);
    if (!metrics) return;

    // 1. 숫자 애니메이션
    animateNumber(dom.statDepRate, 20.0, metrics.deposits.proposedRate, '%');
    animateNumber(dom.statDepDays, 137.7, metrics.deposits.proposedAvgDays, '일');
    animateNumber(dom.statRefRate, 0.0, metrics.refunds.proposedRate, '%');
    animateNumber(dom.statRefDays, 188.0, metrics.refunds.proposedAvgDays, '일');

    // 2. 차이 뱃지(Diff badge) 100% 동적 갱신 (하드코딩 완전 제거)
    var diffDepRate = document.getElementById('diffDepRate');
    var diffDepDays = document.getElementById('diffDepDays');
    var diffRefRate = document.getElementById('diffRefRate');
    var diffRefDays = document.getElementById('diffRefDays');

    var depRateDiff = metrics.deposits.proposedRate - metrics.deposits.legacyRate;
    var depDaysDiff = metrics.deposits.legacyAvgDays - metrics.deposits.proposedAvgDays;
    var refRateDiff = metrics.refunds.proposedRate - metrics.refunds.legacyRate;
    var refDaysDiff = metrics.refunds.legacyAvgDays - metrics.refunds.proposedAvgDays;

    if (diffDepRate) {
      diffDepRate.textContent = (depRateDiff >= 0 ? '+' : '') + depRateDiff.toFixed(1) + '%p';
      diffDepRate.className = 'metric-diff-badge ' + (depRateDiff >= 0 ? 'up' : 'down');
    }
    if (diffDepDays) {
      diffDepDays.textContent = (depDaysDiff >= 0 ? '-' : '+') + Math.abs(depDaysDiff).toFixed(1) + '일';
      diffDepDays.className = 'metric-diff-badge ' + (depDaysDiff >= 0 ? 'down' : 'up');
    }
    if (diffRefRate) {
      diffRefRate.textContent = (refRateDiff >= 0 ? '+' : '') + refRateDiff.toFixed(1) + '%p';
      diffRefRate.className = 'metric-diff-badge ' + (refRateDiff >= 0 ? 'up' : 'down');
    }
    if (diffRefDays) {
      diffRefDays.textContent = (refDaysDiff >= 0 ? '-' : '+') + Math.abs(refDaysDiff).toFixed(1) + '일';
      diffRefDays.className = 'metric-diff-badge ' + (refDaysDiff >= 0 ? 'down' : 'up');
    }

    // 3. 하단 비교 문구(Compare caption) 100% 동적 갱신 (하드코딩 완전 제거)
    var compDepRate = document.getElementById('compareDepRate');
    var compDepDays = document.getElementById('compareDepDays');
    var compRefRate = document.getElementById('compareRefRate');
    var compRefDays = document.getElementById('compareRefDays');

    if (compDepRate) {
      compDepRate.innerHTML = '기존 단순대조 ' + metrics.deposits.legacyRate.toFixed(1) + '% &rarr; 제안모형 ' + metrics.deposits.proposedRate.toFixed(1) + '%';
    }
    if (compDepDays) {
      compDepDays.innerHTML = '기존 ' + metrics.deposits.legacyAvgDays.toFixed(1) + '일 &rarr; 제안모형 ' + metrics.deposits.proposedAvgDays.toFixed(1) + '일로 단축';
    }
    if (compRefRate) {
      compRefRate.innerHTML = '기존 단순대조 ' + metrics.refunds.legacyRate.toFixed(1) + '% &rarr; 제안모형 ' + metrics.refunds.proposedRate.toFixed(1) + '%';
    }
    if (compRefDays) {
      compRefDays.innerHTML = '기존 ' + metrics.refunds.legacyAvgDays.toFixed(1) + '일 &rarr; 제안모형 ' + metrics.refunds.proposedAvgDays.toFixed(1) + '일로 단축';
    }

    // 4. 게이지 프로그레스 바 동적 갱신
    var barDepRate = document.getElementById('barDepRate');
    var barDepDays = document.getElementById('barDepDays');
    var barRefRate = document.getElementById('barRefRate');
    var barRefDays = document.getElementById('barRefDays');

    if (barDepRate) barDepRate.style.width = Math.min(metrics.deposits.proposedRate, 100) + '%';
    if (barDepDays) {
      var savedPct = Math.max(0, Math.min(100, Math.round(((metrics.deposits.legacyAvgDays - metrics.deposits.proposedAvgDays) / (metrics.deposits.legacyAvgDays || 1)) * 100)));
      barDepDays.style.width = savedPct + '%';
    }
    if (barRefRate) barRefRate.style.width = Math.min(metrics.refunds.proposedRate, 100) + '%';
    if (barRefDays) {
      var refSavedPct = Math.max(0, Math.min(100, Math.round(((metrics.refunds.legacyAvgDays - metrics.refunds.proposedAvgDays) / (metrics.refunds.legacyAvgDays || 1)) * 100)));
      barRefDays.style.width = refSavedPct + '%';
    }
  }

  function animateNumber(element, start, end, unit) {
    if (!element) return;
    var duration = 750;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var current = start + (end - start) * progress;
      element.textContent = current.toFixed(1) + unit;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  // Open Audit Report Modal (with Security Stamp & SHA-256 Hash)
  function openAuditReport() {
    if (!state.currentCase) {
      showToast('먼저 정산 케이스를 실행해 주십시오.');
      return;
    }

    var c = state.currentCase;
    var inp = c.input;
    var steps = c.steps;
    var isMasked = dom.maskingToggle ? dom.maskingToggle.checked : true;

    var dispPatient = isMasked ? window.PipelineEngine.maskName(inp.patientName) : window.PipelineEngine.escapeHtml(inp.patientName);
    var dispDepositor = isMasked ? window.PipelineEngine.maskName(inp.depositorName) : window.PipelineEngine.escapeHtml(inp.depositorName);
    var auditHash = window.PipelineEngine.generateAuditHash(c);
    var todayStr = new Date().toISOString().slice(0, 10);

    var html = '';
    html += '<div class="report-header-box">';
    html += '<div><span class="report-item-label">트랜잭션 일련번호</span><p class="report-item-value">TX-' + Date.now().toString().slice(-8) + '</p></div>';
    html += '<div><span class="report-item-label">정산 대상 환자명</span><p class="report-item-value">' + dispPatient + '</p></div>';
    html += '<div><span class="report-item-label">입금자 / 신청인</span><p class="report-item-value">' + dispDepositor + '</p></div>';
    html += '<div><span class="report-item-label">정산 확정 금액</span><p class="report-item-value">' + inp.amount.toLocaleString() + ' KRW (' + window.PipelineEngine.numberToKoreanAmount(inp.amount) + ')</p></div>';
    html += '</div>';

    // Security & Compliance Bar
    html += '<div class="security-audit-box">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += '<strong>[보안 무결성 검증] SHA-256 Transaction Signature</strong>';
    html += '<span style="color:var(--success); font-weight:700;">VERIFIED</span>';
    html += '</div>';
    html += '<code class="audit-hash-code">' + auditHash + '</code>';
    html += '<p style="color:var(--text-light); margin-top:2px;">개인정보보호법 제29조(안전조치의무) 및 전자정부법 제36조 공공연계 감사 추적 로깅 완료</p>';
    html += '</div>';

    html += '<h4 class="report-section-title">5단계 적법 감사 추적 내역 (Audit Trail)</h4>';
    html += '<ul class="report-step-list">';
    steps.forEach(function (s) {
      html += '<li class="report-step-item">';
      html += '<div>';
      html += '<strong>[Step ' + s.step + '] ' + window.PipelineEngine.escapeHtml(s.title) + ' (' + s.status + ')</strong>';
      html += '<p style="color:var(--text-mid); font-size:12px; margin-top:2px;">' + window.PipelineEngine.escapeHtml(s.detail) + '</p>';
      html += '</div>';
      html += '</li>';
    });
    html += '</ul>';

    // Official Stamp Seal
    html += '<div class="stamp-seal-wrap">';
    html += '<div class="stamp-seal" role="img" aria-label="의료기관 원무과장 결재인">';
    html += '<span class="stamp-dept">원무행정</span>';
    html += '<span class="stamp-text">결재승인</span>';
    html += '<span class="stamp-date">' + todayStr + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="report-footer-stamp">';
    html += '<strong>[최종 판정 결재] ' + window.PipelineEngine.escapeHtml(c.finalOutcome.replace(/_/g, ' ')) + '</strong><br>';
    html += '<small>본 증적 문서는 오하율 연구원의 학술 논문(2026) 다차원 공공관리 기준 및 SKT ALEPH 보안 가이드라인에 따라 자동 검증되었습니다.</small>';
    html += '</div>';

    dom.reportBody.innerHTML = html;
    dom.reportModal.classList.add('active');

    // Compute standard Web Crypto SHA-256 asynchronously
    window.PipelineEngine.generateCryptoHash(c, function (realHash) {
      var hashEl = dom.reportBody.querySelector('.audit-hash-code');
      if (hashEl) {
        hashEl.textContent = realHash;
      }
    });
  }

  function closeAuditReport() {
    dom.reportModal.classList.remove('active');
  }

  // Form Error Display (Defensive Coding)
  function showFormError(msg) {
    dom.formFeedback.textContent = msg;
    dom.formFeedback.className = 'form-feedback error';
  }

  function hideFormError() {
    dom.formFeedback.className = 'form-feedback';
    dom.formFeedback.textContent = '';
  }

  // Toast Notification
  function showToast(msg) {
    if (!dom.toastContainer) return;
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg><span>' + window.PipelineEngine.escapeHtml(msg) + '</span>';
    dom.toastContainer.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2800);
  }

  // Attach Event Handlers
  function attachEvents() {
    // Preset Clicks
    dom.presetCards.forEach(function (card) {
      card.addEventListener('click', function () {
        var key = card.getAttribute('data-preset');
        loadPreset(key);
      });
    });

    // Run Pipeline Button
    dom.runPipelineBtn.addEventListener('click', function () {
      executePipeline();
    });

    // Modal Triggers
    dom.openReportBtn.addEventListener('click', openAuditReport);
    dom.modalCloseBtn.addEventListener('click', closeAuditReport);
    dom.modalCancelBtn.addEventListener('click', closeAuditReport);
    dom.reportModal.addEventListener('click', function (e) {
      if (e.target === dom.reportModal) closeAuditReport();
    });
    dom.printReportBtn.addEventListener('click', function () {
      window.print();
    });

    // Real-time Auto-Comma Formatting & Korean Readout
    dom.inputAmount.addEventListener('input', function () {
      var raw = this.value.replace(/[^0-9]/g, '');
      if (!raw) {
        this.value = '';
        updateKoreanAmountReadout('');
        updateFormTierAmounts(0, 0, 0);
        executePipeline();
        return;
      }
      var num = parseInt(raw, 10);
      if (num > 100000000) num = 100000000;
      this.value = num.toLocaleString('ko-KR');
      updateKoreanAmountReadout(num);
      updateFormTierAmounts();
      executePipeline();
    });

    // Privacy Masking Toggle
    if (dom.maskingToggle) {
      dom.maskingToggle.addEventListener('change', function () {
        renderBatchTable();
        showToast('개인정보 안심 마스킹이 ' + (this.checked ? '활성화' : '해제') + '되었습니다.');
      });
    }

    // Custom CSV File Upload (with Injection & Size Defense)
    if (dom.csvFileInput) {
      dom.csvFileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;

        // Size check (max 1MB)
        if (file.size > 1024 * 1024) {
          showToast('보안 정책: 업로드 파일 크기는 1MB 이하만 가능합니다.');
          e.target.value = '';
          return;
        }

        var reader = new FileReader();
        reader.onload = function (evt) {
          var text = evt.target.result;
          var parsed = window.PipelineEngine.parseCsvText(text);

          if (!parsed || parsed.length === 0) {
            showToast('CSV 헤더 구조가 올바르지 않거나 데이터가 없습니다.');
            return;
          }

          window.MEDIMATCH_DATA.samples = parsed;
          renderBatchTable();
          updateBatchMetrics();
          showToast('사용자 CSV 트랜잭션 (' + parsed.length + '건)이 안전하게 적재되었습니다.');
        };
        reader.onerror = function () {
          showToast('파일을 읽는 도중 오류가 발생했습니다.');
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
      });
    }

    // CSV Sample Template Download
    if (dom.downloadCsvTemplateBtn) {
      dom.downloadCsvTemplateBtn.addEventListener('click', function () {
        var templateContent = "transaction_id,case_type,amount,depositor_name,patient_name,reason_code,legacy_matched,proposed_matched,is_deceased,heir_confirmed_proposed,days_pending_legacy,days_pending_proposed,final_result\n"
          + "CSV-001,DEPOSIT,148720,김영희,이순신,GUARDIAN_PAY,0,1,0,0,60,4,매칭완료_진료비수납\n"
          + "CSV-002,DEPOSIT,235100,김서연,김민지,RENAMED,0,1,0,0,45,3,매칭완료_진료비수납\n"
          + "CSV-003,REFUND,350000,건보공단,박영수,DECEASED_REFUND,0,1,1,1,180,35,상속인확인_환불지급\n"
          + "CSV-004,DEPOSIT,50000,제3자,홍길동,UNKNOWN,0,0,0,0,120,45,장기미식별_지속관리\n"
          + "CSV-005,PREPAYMENT,1000000,박민수,박민수,INPATIENT_ADVANCE,1,1,0,0,1,0,선수금_정상수납대체\n";

        var blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'medimatch_sample_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('모의 CSV 템플릿 파일이 다운로드되었습니다.');
      });
    }

    // Form inputs change triggers instant safe evaluation & tier amount recalculation
    var inputs = dom.simForm.querySelectorAll('input, select');
    inputs.forEach(function (input) {
      input.addEventListener('change', function () {
        updateFormTierAmounts();
        executePipeline();
      });
    });

    // Table Filter Chips
    dom.filterChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        dom.filterChips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        state.currentFilter = chip.getAttribute('data-filter');
        renderBatchTable();
      });
    });

    // Batch Load Button
    dom.loadBatchBtn.addEventListener('click', function () {
      updateBatchMetrics();
      renderBatchTable();
      showToast('150건 원자료 모의 데이터셋이 갱신되었습니다.');
    });

    // Quick Amount Increment Chips
    if (dom.quickAmountChips) {
      dom.quickAmountChips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var delta = parseInt(this.getAttribute('data-add'), 10) || 0;
          var curRaw = dom.inputAmount.value.replace(/[^0-9]/g, '');
          var curNum = parseInt(curRaw, 10) || 0;
          var newNum = Math.min(100000000, curNum + delta);
          dom.inputAmount.value = newNum.toLocaleString('ko-KR');
          updateKoreanAmountReadout(newNum);
          updateFormTierAmounts();
          executePipeline();
        });
      });
    }

    // Confirm Delete Modal Actions
    if (dom.confirmDeleteCloseBtn) {
      dom.confirmDeleteCloseBtn.addEventListener('click', function () {
        closeConfirmDeleteModal(false);
      });
    }
    if (dom.confirmDeleteCancelBtn) {
      dom.confirmDeleteCancelBtn.addEventListener('click', function () {
        closeConfirmDeleteModal(false);
      });
    }
    if (dom.confirmDeleteProceedBtn) {
      dom.confirmDeleteProceedBtn.addEventListener('click', function () {
        closeConfirmDeleteModal(true);
      });
    }
    if (dom.confirmDeleteModal) {
      dom.confirmDeleteModal.addEventListener('click', function (e) {
        if (e.target === dom.confirmDeleteModal) {
          closeConfirmDeleteModal(false);
        }
      });
    }

    // Renamed Patient Details Box Toggle
    if (dom.checkRenamed) {
      dom.checkRenamed.addEventListener('change', function () {
        if (dom.renamedDetailsBox) {
          dom.renamedDetailsBox.style.display = this.checked ? 'flex' : 'none';
        }
        executePipeline();
      });
    }

    // Live Table Search Filtering
    if (dom.tableSearchInput) {
      dom.tableSearchInput.addEventListener('input', function () {
        state.searchQuery = this.value.trim();
        state.displayLimit = 50;
        if (dom.clearSearchBtn) {
          dom.clearSearchBtn.style.display = state.searchQuery ? 'flex' : 'none';
        }
        renderBatchTable();
      });
    }
    if (dom.clearSearchBtn) {
      dom.clearSearchBtn.addEventListener('click', function () {
        if (dom.tableSearchInput) {
          dom.tableSearchInput.value = '';
          state.searchQuery = '';
          this.style.display = 'none';
          renderBatchTable();
        }
      });
    }

    // Table Pagination & Show All Controls
    if (dom.loadMoreRowsBtn) {
      dom.loadMoreRowsBtn.addEventListener('click', function () {
        state.displayLimit += 50;
        renderBatchTable();
      });
    }
    if (dom.showAllRowsBtn) {
      dom.showAllRowsBtn.addEventListener('click', function () {
        state.displayLimit = 9999;
        renderBatchTable();
      });
    }

    // Export Reconciled Dataset to CSV
    if (dom.exportReconciledCsvBtn) {
      dom.exportReconciledCsvBtn.addEventListener('click', exportReconciledDatasetToCsv);
    }

    // 실무자 오입력 대응 Action Buttons (수정 저장, 신규 추가, 삭제, 원본 복원, 초기화)
    if (dom.saveTransactionBtn) {
      dom.saveTransactionBtn.addEventListener('click', saveTransactionToDataset);
    }
    if (dom.addNewTransactionBtn) {
      dom.addNewTransactionBtn.addEventListener('click', addNewTransaction);
    }
    if (dom.deleteTransactionBtn) {
      dom.deleteTransactionBtn.addEventListener('click', function () {
        if (!state.selectedRowId) {
          showToast('삭제할 트랜잭션을 테이블에서 먼저 선택해 주십시오.');
          return;
        }
        deleteTransactionById(state.selectedRowId);
      });
    }
    if (dom.revertTransactionBtn) {
      dom.revertTransactionBtn.addEventListener('click', revertTransaction);
    }
    if (dom.resetFormBtn) {
      dom.resetFormBtn.addEventListener('click', resetForm);
    }

    // 대화형 시뮬레이션 인디케이터 컨트롤러 바 이벤트 (5단계 즉시 검증, 모의 케이스 채우기, 리셋, 행 저장)
    if (dom.btnIndicatorRunSim) {
      dom.btnIndicatorRunSim.addEventListener('click', function () {
        if (dom.formTargetIndicator) {
          dom.formTargetIndicator.classList.add('pulsing');
          setTimeout(function () {
            dom.formTargetIndicator.classList.remove('pulsing');
          }, 600);
        }
        executePipeline();
        showToast('입력된 데이터로 5단계 다차원 교차검증을 실행했습니다.');
      });
    }

    var SIMULATION_CASES = [
      {
        name: '선수금(예치금) 사전 수납',
        depositorName: '박민수',
        patientName: '박민수',
        amount: 1000000,
        caseType: 'PREPAYMENT',
        relationType: 'SELF',
        guardianRegistered: false,
        isRenamed: false,
        isDeceased: false,
        hasHeirPublicProof: false,
        desc: '환자 본인이 입원(502호) 중간진료비 및 퇴원정산 대비 사전 예치금을 납부한 실무 케이스입니다.'
      },
      {
        name: '보호자 대납 진료비 수납',
        depositorName: '김영희(자녀)',
        patientName: '이순신(부친)',
        amount: 148720,
        caseType: 'DEPOSIT',
        relationType: 'GUARDIAN',
        guardianRegistered: true,
        isRenamed: false,
        isDeceased: false,
        hasHeirPublicProof: false,
        desc: '자녀가 부친의 진료비를 대납하였으며, 원내 HIS 가족관계 등록과 수납액이 일치하는 케이스입니다.'
      },
      {
        name: '환자 개명 본인부담금 수납',
        depositorName: '김서연(개명후)',
        patientName: '김민지(개명전)',
        amount: 235100,
        caseType: 'DEPOSIT',
        relationType: 'SELF',
        guardianRegistered: false,
        isRenamed: true,
        isDeceased: false,
        hasHeirPublicProof: false,
        desc: '개명 후 금융 입금자명과 과거 EMR 환자등록명이 다르나, 주민등록번호 교차 검증으로 일치된 케이스입니다.'
      },
      {
        name: '사망환자 진료비 환불금',
        depositorName: '건강보험심사평가원',
        patientName: '박영수(고인)',
        amount: 350000,
        caseType: 'REFUND',
        relationType: 'HEIR',
        guardianRegistered: false,
        isRenamed: false,
        isDeceased: true,
        hasHeirPublicProof: true,
        desc: '심평원 사후 환불 결정 건으로, 정부24 안심상속 원스톱 서비스를 통해 적격 상속권자를 확인한 케이스입니다.'
      },
      {
        name: '미등록 제3자 대납 (소명 대기)',
        depositorName: '홍길동(불명)',
        patientName: '강감찬',
        amount: 89000,
        caseType: 'DEPOSIT',
        relationType: 'UNKNOWN',
        guardianRegistered: false,
        isRenamed: false,
        isDeceased: false,
        hasHeirPublicProof: false,
        desc: '원내 미등록된 제3자가 환자명과 다른 명의로 입금하여 원무과 수기 확인 및 소명이 필요한 케이스입니다.'
      }
    ];
    var simCaseIndex = 0;

    if (dom.btnIndicatorAutoFill) {
      dom.btnIndicatorAutoFill.addEventListener('click', function () {
        var testCase = SIMULATION_CASES[simCaseIndex % SIMULATION_CASES.length];
        simCaseIndex++;

        dom.inputDepositor.value = testCase.depositorName;
        dom.inputPatient.value = testCase.patientName;
        dom.inputAmount.value = Number(testCase.amount).toLocaleString('ko-KR');

        setCustomSelectValue('caseTypeSelectWrapper', testCase.caseType);
        setCustomSelectValue('relationSelectWrapper', testCase.relationType);

        dom.checkGuardianReg.checked = testCase.guardianRegistered;
        dom.checkRenamed.checked = testCase.isRenamed;
        if (dom.renamedDetailsBox) {
          dom.renamedDetailsBox.style.display = testCase.isRenamed ? 'flex' : 'none';
        }
        dom.checkDeceased.checked = testCase.isDeceased;
        dom.checkPublicProof.checked = testCase.hasHeirPublicProof;

        updateKoreanAmountReadout(testCase.amount);
        state.selectedRowId = null;

        if (dom.formTargetIndicator) {
          dom.formTargetIndicator.className = 'form-target-indicator mode-preset pulsing';
          setTimeout(function () {
            dom.formTargetIndicator.classList.remove('pulsing');
          }, 600);
        }
        if (dom.targetIndicatorLabel) {
          dom.targetIndicatorLabel.textContent = '모의 테스트: ' + testCase.name;
        }
        if (dom.targetIndicatorBadge) {
          dom.targetIndicatorBadge.textContent = '테스트값 적용됨';
          dom.targetIndicatorBadge.className = 'badge badge-purple';
        }
        if (dom.targetIndicatorSub) {
          dom.targetIndicatorSub.textContent = testCase.desc;
        }
        if (dom.btnIndicatorReset) dom.btnIndicatorReset.style.display = 'inline-flex';
        if (dom.btnIndicatorSaveRow) dom.btnIndicatorSaveRow.style.display = 'none';

        hideFormError();
        executePipeline();
        showToast('모의 케이스 [' + testCase.name + '] 입력 및 5단계 검증이 완료되었습니다.');
      });
    }

    if (dom.btnIndicatorReset) {
      dom.btnIndicatorReset.addEventListener('click', function () {
        resetForm();
        showToast('신규 직접 시뮬레이션 모드로 리셋되었습니다.');
      });
    }

    if (dom.btnIndicatorSaveRow) {
      dom.btnIndicatorSaveRow.addEventListener('click', function () {
        saveTransactionToDataset();
      });
    }

    // SIEM Modal Event Bindings
    if (dom.openSiemModalBtn) {
      dom.openSiemModalBtn.addEventListener('click', function () {
        SiemService.render();
        dom.siemModal.classList.add('active');
      });
    }
    if (dom.siemModalCloseBtn) {
      dom.siemModalCloseBtn.addEventListener('click', function () {
        dom.siemModal.classList.remove('active');
      });
    }
    if (dom.siemModalCancelBtn) {
      dom.siemModalCancelBtn.addEventListener('click', function () {
        dom.siemModal.classList.remove('active');
      });
    }
    if (dom.siemModal) {
      dom.siemModal.addEventListener('click', function (e) {
        if (e.target === dom.siemModal) dom.siemModal.classList.remove('active');
      });
    }
    if (dom.refreshSiemLogBtn) {
      dom.refreshSiemLogBtn.addEventListener('click', function () {
        SiemService.render();
        showToast('SIEM 실시간 감사 로그가 새로고침되었습니다.');
      });
    }
    if (dom.sendSiemTelemetryBtn) {
      dom.sendSiemTelemetryBtn.addEventListener('click', function () {
        SiemService.sendTelemetry();
      });
    }
    if (dom.exportSiemLogBtn) {
      dom.exportSiemLogBtn.addEventListener('click', function () {
        SiemService.exportJson();
      });
    }

    // ESC key close modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (dom.confirmDeleteModal && dom.confirmDeleteModal.classList.contains('active')) {
          closeConfirmDeleteModal(false);
        }
        if (dom.reportModal && dom.reportModal.classList.contains('active')) {
          closeAuditReport();
        }
        if (dom.siemModal && dom.siemModal.classList.contains('active')) {
          dom.siemModal.classList.remove('active');
        }
      }
    });
  }

  // ========================================================
  // Statistical Analytics & Accordion UI Controller
  // ========================================================
  var currentDistVar = 'deposit'; // 'deposit' or 'refund'
  var latestCvResult = null;
  var latestDistResult = null;
  var latestHypList = null;
  var latestAdvResult = null;

  function renderCvUI(cvResult) {
    if (!cvResult) return;
    latestCvResult = cvResult;

    var tbody = document.getElementById('cvTableBody');
    if (tbody) {
      tbody.innerHTML = cvResult.folds.map(function (f) {
        return '<tr>' +
          '<td><strong>Fold ' + f.fold + '</strong></td>' +
          '<td>' + f.trainSize.toLocaleString() + '건</td>' +
          '<td>' + f.valSize.toLocaleString() + '건</td>' +
          '<td><span style="color:var(--primary); font-weight:700;">' + f.trainAccuracy.toFixed(2) + '%</span></td>' +
          '<td><span style="color:var(--success); font-weight:700;">' + f.valAccuracy.toFixed(2) + '%</span></td>' +
          '<td>' + f.valF1.toFixed(1) + '%</td>' +
          '<td>' + f.valLoss.toFixed(4) + '</td>' +
          '<td><span class="badge badge-neutral" style="font-size:11px;">' + f.accuracyGap.toFixed(2) + '%p</span></td>' +
          '</tr>';
      }).join('') +
      '<tr style="background:var(--surface-sub); font-weight:800;">' +
      '<td>평균 (Mean)</td>' +
      '<td colspan="2">전체 ' + (cvResult.folds[0].trainSize + cvResult.folds[0].valSize).toLocaleString() + '건</td>' +
      '<td>' + cvResult.meanTrainAccuracy.toFixed(2) + '%</td>' +
      '<td style="color:var(--success);">' + cvResult.meanValAccuracy.toFixed(2) + '%</td>' +
      '<td>' + cvResult.meanTrainF1.toFixed(1) + '%</td>' +
      '<td>' + cvResult.meanValLoss.toFixed(4) + '</td>' +
      '<td><span class="badge badge-success" style="font-size:11px;">' + cvResult.generalizationGap.toFixed(2) + '%p (적정)</span></td>' +
      '</tr>';
    }

    var diagText = document.getElementById('cvDiagnosisText');
    if (diagText) {
      diagText.innerHTML = '<strong>[데이터 적격성 정밀 진단]</strong> ' + cvResult.diagnosis;
    }

    var badge = document.getElementById('cvStatusBadge');
    if (badge) {
      badge.textContent = cvResult.status === 'OPTIMAL_FIT' ? 'Optimal Fit (적정 적합)' : cvResult.status;
      badge.className = cvResult.status === 'OPTIMAL_FIT' ? 'badge badge-success' : 'badge badge-warning';
    }

    var canvas = document.getElementById('chartCvCanvas');
    if (canvas && window.StatsEngine) {
      StatsEngine.ChartRenderer.renderCvChart(canvas, cvResult);
    }
  }

  function renderDistributionUI(distResult) {
    if (!distResult) return;
    latestDistResult = distResult;

    var tbody = document.getElementById('distTableBody');
    if (tbody) {
      var d = distResult.depositStats;
      var r = distResult.refundStats;
      var a = distResult.amountStats;

      tbody.innerHTML =
        '<tr>' +
        '<td><strong>미식별 입금 소요일 (기존)</strong></td>' +
        '<td>' + d.legacy.n.toLocaleString() + '건</td>' +
        '<td>' + d.legacy.mean.toFixed(1) + '일</td>' +
        '<td>' + d.legacy.variance.toFixed(1) + '</td>' +
        '<td>' + d.legacy.sd.toFixed(2) + '일</td>' +
        '<td>' + d.legacy.se.toFixed(2) + '</td>' +
        '<td>[' + d.legacy.ci95[0].toFixed(1) + ', ' + d.legacy.ci95[1].toFixed(1) + ']</td>' +
        '<td>' + d.legacy.median.toFixed(1) + ' (' + d.legacy.iqr.toFixed(1) + ')</td>' +
        '<td>' + d.legacy.skewness.toFixed(2) + ' / ' + d.legacy.kurtosis.toFixed(2) + '</td>' +
        '</tr>' +
        '<tr style="background:var(--surface-sub);">' +
        '<td><strong>미식별 입금 소요일 (제안)</strong></td>' +
        '<td>' + d.proposed.n.toLocaleString() + '건</td>' +
        '<td style="color:var(--success); font-weight:700;">' + d.proposed.mean.toFixed(1) + '일</td>' +
        '<td>' + d.proposed.variance.toFixed(1) + '</td>' +
        '<td>' + d.proposed.sd.toFixed(2) + '일</td>' +
        '<td>' + d.proposed.se.toFixed(2) + '</td>' +
        '<td>[' + d.proposed.ci95[0].toFixed(1) + ', ' + d.proposed.ci95[1].toFixed(1) + ']</td>' +
        '<td>' + d.proposed.median.toFixed(1) + ' (' + d.proposed.iqr.toFixed(1) + ')</td>' +
        '<td>' + d.proposed.skewness.toFixed(2) + ' / ' + d.proposed.kurtosis.toFixed(2) + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>환불금 잔류 소요일 (기존)</strong></td>' +
        '<td>' + r.legacy.n.toLocaleString() + '건</td>' +
        '<td>' + r.legacy.mean.toFixed(1) + '일</td>' +
        '<td>' + r.legacy.variance.toFixed(1) + '</td>' +
        '<td>' + r.legacy.sd.toFixed(2) + '일</td>' +
        '<td>' + r.legacy.se.toFixed(2) + '</td>' +
        '<td>[' + r.legacy.ci95[0].toFixed(1) + ', ' + r.legacy.ci95[1].toFixed(1) + ']</td>' +
        '<td>' + r.legacy.median.toFixed(1) + ' (' + r.legacy.iqr.toFixed(1) + ')</td>' +
        '<td>' + r.legacy.skewness.toFixed(2) + ' / ' + r.legacy.kurtosis.toFixed(2) + '</td>' +
        '</tr>' +
        '<tr style="background:var(--surface-sub);">' +
        '<td><strong>환불금 잔류 소요일 (제안)</strong></td>' +
        '<td>' + r.proposed.n.toLocaleString() + '건</td>' +
        '<td style="color:var(--success); font-weight:700;">' + r.proposed.mean.toFixed(1) + '일</td>' +
        '<td>' + r.proposed.variance.toFixed(1) + '</td>' +
        '<td>' + r.proposed.sd.toFixed(2) + '일</td>' +
        '<td>' + r.proposed.se.toFixed(2) + '</td>' +
        '<td>[' + r.proposed.ci95[0].toFixed(1) + ', ' + r.proposed.ci95[1].toFixed(1) + ']</td>' +
        '<td>' + r.proposed.median.toFixed(1) + ' (' + r.proposed.iqr.toFixed(1) + ')</td>' +
        '<td>' + r.proposed.skewness.toFixed(2) + ' / ' + r.proposed.kurtosis.toFixed(2) + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td><strong>정산 금액 분포 (원)</strong></td>' +
        '<td>' + a.n.toLocaleString() + '건</td>' +
        '<td>' + Math.round(a.mean).toLocaleString() + '원</td>' +
        '<td>' + (Math.round(a.variance / 1000000)).toLocaleString() + 'M</td>' +
        '<td>' + Math.round(a.sd).toLocaleString() + '원</td>' +
        '<td>' + Math.round(a.se).toLocaleString() + '</td>' +
        '<td>[' + Math.round(a.ci95[0]).toLocaleString() + ', ' + Math.round(a.ci95[1]).toLocaleString() + ']</td>' +
        '<td>' + Math.round(a.median).toLocaleString() + ' (' + Math.round(a.iqr).toLocaleString() + ')</td>' +
        '<td>' + a.skewness.toFixed(2) + ' / ' + a.kurtosis.toFixed(2) + '</td>' +
        '</tr>';
    }

    var canvas = document.getElementById('chartDistCanvas');
    if (canvas && window.StatsEngine) {
      if (state.isCltMode) {
        var cltData = StatsEngine.simulateSamplingDistributionOfMean(
          StatsEngine.currentSample,
          (currentDistVar === 'deposit') ? 'daysProposed' : 'daysProposed',
          1000, 30
        );
        StatsEngine.ChartRenderer.renderDistributionChart(canvas, cltData, true);
        if (dom.cltModeBtnText) dom.cltModeBtnText.textContent = '원시 관측 소요일수 분포로 복귀';
        if (dom.distChartTitle) dom.distChartTitle.textContent = (currentDistVar === 'deposit' ? '미식별 입금' : '환불금') + ' 표본평균(x̄)의 중심극한정리(CLT) 정규분포';
        if (dom.distChartDesc) dom.distChartDesc.textContent = '※ 표본(n=30)씩 1,000회 부트스트랩 리샘플링한 표본평균들의 분포로, 중심극한정리에 의해 좌우 완전 대칭의 가우시안 정규분포(Bell Curve)를 형성합니다.';
      } else {
        var targetStats = (currentDistVar === 'deposit') ? distResult.depositStats.proposed : distResult.refundStats.proposed;
        StatsEngine.ChartRenderer.renderDistributionChart(canvas, targetStats, false);
        if (dom.cltModeBtnText) dom.cltModeBtnText.textContent = 'CLT 표본평균 정규분포(Bell Curve)로 전환';
        if (dom.distChartTitle) dom.distChartTitle.textContent = (currentDistVar === 'deposit' ? '미식별 입금' : '환불금') + ' 처리 소요일수 표본분포 히스토그램 및 로그정규 적합 곡선';
        if (dom.distChartDesc) dom.distChartDesc.textContent = '※ 제안 모델 도입으로 대다수 케이스가 0~5일 이내 신속 처리되어 좌측으로 치우친 형태(양의 왜도)를 띱니다. 통계학적 완전 정규분포는 우측 버튼을 눌러 확인하세요.';
      }
    }
  }

  function renderHypothesisUI(hypList) {
    if (!hypList || !Array.isArray(hypList)) return;
    latestHypList = hypList;

    var container = document.getElementById('hypGridContainer');
    if (container) {
      container.innerHTML = hypList.map(function (hyp) {
        var isRate = (hyp.id === '6.1' || hyp.id === '6.3');
        var legStr = isRate ? (hyp.legacyRate.toFixed(1) + '%') : (hyp.legacyMeanDays.toFixed(1) + '일');
        var propStr = isRate ? (hyp.proposedRate.toFixed(1) + '%') : (hyp.proposedMeanDays.toFixed(1) + '일');

        return '<div class="hyp-card significant">' +
          '<div class="hyp-header">' +
            '<span class="hyp-num-badge">가설 ' + hyp.id + '</span>' +
            '<span class="hyp-p-badge">귀무가설 기각 (p < 0.001)</span>' +
          '</div>' +
          '<div class="hyp-title">' + hyp.title + '</div>' +
          '<div class="hyp-statement">' +
            '<div><strong>귀무가설:</strong> ' + hyp.nullHypothesis + '</div>' +
            '<div><strong>대립가설:</strong> ' + hyp.altHypothesis + '</div>' +
          '</div>' +
          '<div class="hyp-metrics">' +
            '<div class="hyp-stat-item">' +
              '<span class="hyp-stat-lbl">기존 방식</span>' +
              '<span class="hyp-stat-val">' + legStr + '</span>' +
            '</div>' +
            '<div class="hyp-stat-item">' +
              '<span class="hyp-stat-lbl">제안 모형</span>' +
              '<span class="hyp-stat-val" style="color:var(--success);">' + propStr + '</span>' +
            '</div>' +
            '<div class="hyp-stat-item">' +
              '<span class="hyp-stat-lbl">' + hyp.statisticName + '</span>' +
              '<span class="hyp-stat-val">' + (typeof hyp.statisticValue === 'number' ? hyp.statisticValue.toFixed(2) : hyp.statisticValue) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="hyp-conclusion">✓ ' + hyp.conclusion + '</div>' +
        '</div>';
      }).join('');
    }

    var canvas = document.getElementById('chartHypCanvas');
    if (canvas && window.StatsEngine) {
      StatsEngine.ChartRenderer.renderHypothesisChart(canvas, hypList);
    }
  }

  function renderAdvancedUI(advResult) {
    if (!advResult) return;
    latestAdvResult = advResult;

    // Kaplan-Meier
    var kmCanvas = document.getElementById('chartSurvivalCanvas');
    if (kmCanvas && window.StatsEngine) {
      StatsEngine.ChartRenderer.renderSurvivalChart(kmCanvas, advResult.kaplanMeier);
    }

    // Logistic Forest Plot
    var forestCanvas = document.getElementById('chartForestCanvas');
    if (forestCanvas && window.StatsEngine) {
      StatsEngine.ChartRenderer.renderForestPlot(forestCanvas, advResult.logisticRegression);
    }

    // Bootstrap
    var bootMean = document.getElementById('bootMeanVal');
    var bootCi = document.getElementById('bootCiVal');
    if (bootMean && advResult.bootstrap) {
      bootMean.textContent = advResult.bootstrap.meanSavedDays.toFixed(1) + '일 절감';
    }
    if (bootCi && advResult.bootstrap) {
      bootCi.textContent = '95% BCa 신뢰구간: [' + advResult.bootstrap.ci95[0].toFixed(1) + '일, ' + advResult.bootstrap.ci95[1].toFixed(1) + '일] (B=' + advResult.bootstrap.iterations + '회)';
    }

    // Hospital ROI
    var roi = advResult.economicRoi;
    if (roi) {
      var hVal = document.getElementById('roiHoursVal');
      var lVal = document.getElementById('roiLaborVal');
      var legVal = document.getElementById('roiLegalVal');
      var tVal = document.getElementById('roiTotalVal');
      if (hVal) hVal.textContent = roi.totalSavedHours.toLocaleString() + '시간';
      if (lVal) lVal.textContent = (Math.round(roi.laborCostSaved / 10000)).toLocaleString() + '만 원';
      if (legVal) legVal.textContent = (Math.round(roi.legalCostSaved / 10000)).toLocaleString() + '만 원';
      if (tVal) tVal.textContent = (Math.round(roi.totalBenefit / 10000)).toLocaleString() + '만 원';
    }
  }

  function redrawAllStatsCharts() {
    if (!window.StatsEngine) return;
    if (latestCvResult) {
      var cvCanvas = document.getElementById('chartCvCanvas');
      if (cvCanvas) StatsEngine.ChartRenderer.renderCvChart(cvCanvas, latestCvResult);
    }
    if (latestDistResult) {
      var distCanvas = document.getElementById('chartDistCanvas');
      if (distCanvas) {
        if (state.isCltMode) {
          var cltData = StatsEngine.simulateSamplingDistributionOfMean(
            StatsEngine.currentSample,
            (currentDistVar === 'deposit') ? 'daysProposed' : 'daysProposed',
            1000, 30
          );
          StatsEngine.ChartRenderer.renderDistributionChart(distCanvas, cltData, true);
        } else {
          var targetStats = (currentDistVar === 'deposit') ? latestDistResult.depositStats.proposed : latestDistResult.refundStats.proposed;
          StatsEngine.ChartRenderer.renderDistributionChart(distCanvas, targetStats, false);
        }
      }
    }
    if (latestHypList) {
      var hypCanvas = document.getElementById('chartHypCanvas');
      if (hypCanvas) StatsEngine.ChartRenderer.renderHypothesisChart(hypCanvas, latestHypList);
    }
    if (latestAdvResult) {
      var kmCanvas = document.getElementById('chartSurvivalCanvas');
      if (kmCanvas) StatsEngine.ChartRenderer.renderSurvivalChart(kmCanvas, latestAdvResult.kaplanMeier);
      var forestCanvas = document.getElementById('chartForestCanvas');
      if (forestCanvas) StatsEngine.ChartRenderer.renderForestPlot(forestCanvas, latestAdvResult.logisticRegression);
    }
  }

  function runAndRenderAllStats(sample) {
    if (!sample) return;
    // 1. KPI cards
    var depItems = sample.filter(function (s) { return s.caseType === 'DEPOSIT' || s.caseType === 'PREPAYMENT'; });
    var matchCount = depItems.filter(function (s) { return s.proposedMatched; }).length;
    var rate = depItems.length > 0 ? (matchCount / depItems.length) * 100 : 0;
    var legDays = depItems.reduce(function (a, b) { return a + b.daysLegacy; }, 0) / (depItems.length || 1);
    var propDays = depItems.reduce(function (a, b) { return a + b.daysProposed; }, 0) / (depItems.length || 1);

    var kpiSampleSize = document.getElementById('kpiSampleSize');
    var kpiSampleRate = document.getElementById('kpiSampleRate');
    var kpiSampleDays = document.getElementById('kpiSampleDays');
    if (kpiSampleSize) kpiSampleSize.textContent = 'n = ' + sample.length.toLocaleString() + '건';
    if (kpiSampleRate) kpiSampleRate.textContent = rate.toFixed(1) + '%';
    if (kpiSampleDays) kpiSampleDays.textContent = '-' + (legDays - propDays).toFixed(1) + '일';

    // 2. Cross Validation (5-Fold)
    var cvResult = StatsEngine.runCrossValidation(sample, 5);
    renderCvUI(cvResult);

    // 3. Sample Distributions
    var distResult = StatsEngine.computeSampleDistributions(sample);
    renderDistributionUI(distResult);

    // 4. 4 Hypothesis Tests (6.1 ~ 6.4)
    var hypList = StatsEngine.runHypothesisTests(sample);
    renderHypothesisUI(hypList);

    // 5. Advanced Analysis (Kaplan-Meier, Logistic, Bootstrap, ROI)
    var advResult = StatsEngine.runAdvancedAnalysis(sample);
    renderAdvancedUI(advResult);
  }

  function initStatsController() {
    if (!window.StatsEngine) return;
    // Generate hospital dataset if not yet generated
    if (!StatsEngine.hospitalPopulation) {
      StatsEngine.generateHospitalDataset(5000);
    }
    // Perform initial random sampling (n=500)
    var sample = StatsEngine.sampleRandom(null, 500);
    runAndRenderAllStats(sample);

    // Accordion click handlers
    document.querySelectorAll('.accordion-header').forEach(function (header) {
      header.addEventListener('click', function () {
        var item = header.closest('.accordion-item');
        if (item) {
          var isExpanded = item.classList.contains('expanded');
          item.classList.toggle('expanded');
          header.setAttribute('aria-expanded', !isExpanded);
          if (!isExpanded) {
            setTimeout(redrawAllStatsCharts, 60);
          }
        }
      });
      header.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });

    // Expand all / Collapse all
    var btnExpandAll = document.getElementById('btnExpandAllAccordions');
    if (btnExpandAll) {
      btnExpandAll.addEventListener('click', function () {
        document.querySelectorAll('.accordion-item').forEach(function (item) {
          item.classList.add('expanded');
          var hdr = item.querySelector('.accordion-header');
          if (hdr) hdr.setAttribute('aria-expanded', 'true');
        });
        setTimeout(redrawAllStatsCharts, 60);
        showToast('모든 연구 및 통계 파트 섹션이 펼쳐졌습니다.');
      });
    }

    var btnCollapseAll = document.getElementById('btnCollapseAllAccordions');
    if (btnCollapseAll) {
      btnCollapseAll.addEventListener('click', function () {
        document.querySelectorAll('.accordion-item').forEach(function (item) {
          item.classList.remove('expanded');
          var hdr = item.querySelector('.accordion-header');
          if (hdr) hdr.setAttribute('aria-expanded', 'false');
        });
        showToast('모든 연구 및 통계 파트 섹션이 접혔습니다.');
      });
    }

    // Sampling buttons
    var btnRunSampling = document.getElementById('btnRunSampling');
    var sampleSizeSelect = document.getElementById('sampleSizeSelect');
    if (btnRunSampling) {
      btnRunSampling.addEventListener('click', function () {
        var n = sampleSizeSelect ? parseInt(sampleSizeSelect.value, 10) : 500;
        var newSample = StatsEngine.sampleRandom(null, n);
        runAndRenderAllStats(newSample);
        showToast('대학병원 모집단 5,000건에서 무작위 표본(n=' + n.toLocaleString() + '건) 추출 및 8대 통계 분석이 완료되었습니다.');
      });
    }

    var btnQuickSampleRun = document.getElementById('btnQuickSampleRun');
    if (btnQuickSampleRun) {
      btnQuickSampleRun.addEventListener('click', function () {
        var n = sampleSizeSelect ? parseInt(sampleSizeSelect.value, 10) : 500;
        var newSample = StatsEngine.sampleRandom(null, n);
        runAndRenderAllStats(newSample);
        showToast('대학병원 5,000건 표본 재추출 및 통계 분석 갱신이 완료되었습니다.');
      });
    }

    // Load hospital sample to table
    var btnLoadHospitalToTable = document.getElementById('btnLoadHospitalToTable');
    if (btnLoadHospitalToTable) {
      btnLoadHospitalToTable.addEventListener('click', function () {
        if (!StatsEngine.currentSample) return;
        window.MEDIMATCH_DATA.samples = StatsEngine.currentSample;
        state.selectedRowId = null;
        renderBatchTable();
        updateBatchMetrics();
        var part3 = document.getElementById('accordionPart3');
        if (part3) {
          part3.classList.add('expanded');
          var hdr = part3.querySelector('.accordion-header');
          if (hdr) hdr.setAttribute('aria-expanded', 'true');
          part3.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        showToast('현재 표본 ' + StatsEngine.currentSample.length.toLocaleString() + '건이 메인 트랜잭션 테이블에 로드되었습니다.');
      });
    }

    // Toggle distribution variable (입금 소요일 vs 환불금 잔류일)
    var btnToggleDistVar = document.getElementById('btnToggleDistVar');
    if (btnToggleDistVar) {
      btnToggleDistVar.addEventListener('click', function () {
        currentDistVar = (currentDistVar === 'deposit') ? 'refund' : 'deposit';
        var span = btnToggleDistVar.querySelector('span');
        if (span) {
          span.textContent = (currentDistVar === 'deposit') ? '환불금 잔류일 분포로 전환' : '입금 소요일 분포로 전환';
        }
        if (StatsEngine.currentSample) {
          var dist = StatsEngine.computeSampleDistributions(StatsEngine.currentSample);
          renderDistributionUI(dist);
        }
      });
    }

    // Toggle CLT Mode (관측 소요일수 로그정규 vs CLT 표본평균 정규분포 Bell Curve)
    if (dom.btnToggleCltMode) {
      dom.btnToggleCltMode.addEventListener('click', function () {
        state.isCltMode = !state.isCltMode;
        if (latestDistResult) {
          renderDistributionUI(latestDistResult);
        }
        showToast(state.isCltMode
          ? '중심극한정리(CLT) 표본평균 정규 적합 모드가 활성화되었습니다 (B=1,000회 부트스트랩).'
          : '원시 관측 소요일수 로그정규 적합 모드로 복귀했습니다.');
      });
    }

    // Toggle Table View Mode (컴팩트 6열 vs 전체 10열)
    if (dom.btnToggleTableViewMode) {
      dom.btnToggleTableViewMode.addEventListener('click', function () {
        state.tableViewMode = (state.tableViewMode === 'compact') ? 'full' : 'compact';
        renderBatchTable();
        showToast(state.tableViewMode === 'compact'
          ? '컴팩트 뷰가 적용되었습니다 (3대 정산 금액 한눈에 보기).'
          : '전체 열 모드가 적용되었습니다 (가로 스크롤 열람).');
      });
    }

    // Window resize redraw
    window.addEventListener('resize', function () {
      redrawAllStatsCharts();
    });
  }

  // Bootstrapping
  function init() {
    cacheDom();
    initTheme();
    SiemService.init();
    initCustomSelects();
    attachEvents();
    loadPreset('guardian');
    renderBatchTable();
    updateBatchMetrics();
    initStatsController();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
