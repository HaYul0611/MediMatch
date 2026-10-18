# -*- coding: utf-8 -*-
"""
과제 10 재현 패키지 실행 스크립트 (Python 버전)
실행 방법: python reproduce_analysis.py
"""

import os
import csv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, '..', 'data')
SAMPLE_FILE = os.path.join(DATA_DIR, 'raw_settlement_sample_150.csv')
HIRA_FILE = os.path.join(DATA_DIR, 'hira_refund_statistics_2020_2025.csv')

print("=" * 64)
print(" [과제 10] 의료기관 진료비 예외정산 재현 분석 프로그램")
print(" 연구자: 오하율 (2026-10-09)")
print("=" * 64 + "\n")

# 1. HIRA 통계 출력
print("1. [공공 데이터] 건강보험심사평가원 진료비 확인 환불 통계 (2020~2025)")
print("-" * 64)
with open(HIRA_FILE, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        year = row['year']
        app = int(row['refund_approved_cases'])
        amt = int(row['refund_amount_krw'])
        avg = int(row['avg_refund_krw'])
        rate = row['unclaimed_or_delayed_rate_pct']
        print(f"- {year}년: 환불결정 {app:,}건 (총액 {amt:,}원, 건당평균 {avg:,}원, 지연율 {rate}%)")
print("-" * 64 + "\n")

# 2. 모의 트랜잭션 150건 분석
deposit_count = 0
legacy_dep_matched = 0
proposed_dep_matched = 0
legacy_dep_days = 0
proposed_dep_days = 0

refund_count = 0
deceased_count = 0
legacy_ref_matched = 0
proposed_ref_matched = 0
legacy_ref_days = 0
proposed_ref_days = 0

with open(SAMPLE_FILE, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        c_type = row['case_type']
        leg_m = int(row['legacy_matched'])
        prop_m = int(row['proposed_matched'])
        is_dec = int(row['is_deceased'])
        d_leg = int(row['days_pending_legacy'])
        d_prop = int(row['days_pending_proposed'])

        if c_type == 'DEPOSIT':
            deposit_count += 1
            if leg_m == 1: legacy_dep_matched += 1
            if prop_m == 1: proposed_dep_matched += 1
            legacy_dep_days += d_leg
            proposed_dep_days += d_prop
        elif c_type == 'REFUND':
            refund_count += 1
            if is_dec == 1: deceased_count += 1
            if leg_m == 1: legacy_ref_matched += 1
            if prop_m == 1: proposed_ref_matched += 1
            legacy_ref_days += d_leg
            proposed_ref_days += d_prop

print("2. [실험 검증 결과] 기존 방식 vs 제안 공공관리 모형 비교 (표본: 150건)")
print("=" * 64)
print(f"[분석 대상] 미식별 입금: {deposit_count}건, 미수령/사망환자 환불금: {refund_count}건 (사망: {deceased_count}건)")
print("-" * 64)
print(f" 미식별 입금 식별 성공률 | {legacy_dep_matched/deposit_count*100:.1f}% ({legacy_dep_matched}/{deposit_count}) vs {proposed_dep_matched/deposit_count*100:.1f}% ({proposed_dep_matched}/{deposit_count})")
print(f" 미식별 입금 평균 처리일 | {legacy_dep_days/deposit_count:.1f}일 vs {proposed_dep_days/deposit_count:.1f}일 (단축: {legacy_dep_days/deposit_count - proposed_dep_days/deposit_count:.1f}일)")
print(f" 환불금 적격 수령 확인율 | {legacy_ref_matched/refund_count*100:.1f}% ({legacy_ref_matched}/{refund_count}) vs {proposed_ref_matched/refund_count*100:.1f}% ({proposed_ref_matched}/{refund_count})")
print(f" 환불금 평균 처리/잔류일 | {legacy_ref_days/refund_count:.1f}일 vs {proposed_ref_days/refund_count:.1f}일 (단축: {legacy_ref_days/refund_count - proposed_ref_days/refund_count:.1f}일)")
print("=" * 64 + "\n")
