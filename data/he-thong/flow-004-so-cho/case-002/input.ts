/**
 * CASE-SC-002 · Sổ chờ VĂN BẢN tại TAND tối cao (D01) theo kịch bản QC (Jira QLN-13300 comment 14900, 12/11/2026).
 * Lấy số ở D01 vì KV5 không dùng được: sổ mẫu VB-MAU-DEV nhận mọi văn bản của KV5 (đo dev 12/11/2026).
 * Người lấy số = quanTriTandtc (giu-so cấp cho tòa của tài khoản: CapSoServiceImpl userInfo.getMaToaAn()).
 */
import type { DinhDanhCase } from '../../../../khung/case-state';
import { FLOW_HT_004 } from '../../../../flows/he-thong/flow-004-so-cho/flow';
import type { InputSoCho } from '../../../../flows/he-thong/flow-004-so-cho/cai-dat';

export const CASE_ID = 'case-sc-002';

export const DD: DinhDanhCase = {
  phanHe: FLOW_HT_004.phanHe,
  flow: FLOW_HT_004.flow,
  caseId: CASE_ID,
  module: FLOW_HT_004.module,
  rootCaseKey: `${FLOW_HT_004.module}|${FLOW_HT_004.flow}|${CASE_ID}`,
};

export const INPUT: InputSoCho = {
  cheDo: 'VAN_BAN',
  dayCanTim: { loaiSo: 'THU_LY', giaTri: {} }, // không dùng ở chế độ VAN_BAN
  soCho: {
    maToa: 'D01',
    dsBieuMauUuTien: [],
    toiDaThu: 60,
  },
  tenSoChinh: 'PW QLN-13300 sổ VB từ Sổ chờ',
  vaiLaySo: 'quanTriTandtc',
};
