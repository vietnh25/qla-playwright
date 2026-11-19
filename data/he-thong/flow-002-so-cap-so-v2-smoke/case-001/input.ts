/**
 * CASE-SCS2-001 · smoke quyền + mở màn sổ cấp số v2 trên DEV (QLN-13171).
 *
 * Tài khoản (CCCD) KHÔNG ghi ở đây — repo công khai: nằm ở config/tai-khoan.dev.local.json, vai
 * `thuKyKv5BacNinh` (Thư ký TAND KV5 Bắc Ninh) và `quanTriTandtc` (Ngô Hoài Thương, Cục CNTT).
 */
import type { DinhDanhCase } from '../../../../khung/case-state';
import { FLOW_HT_002 } from '../../../../flows/he-thong/flow-002-so-cap-so-v2-smoke/flow';

export const CASE_ID = 'case-scs2-001';

export const DD: DinhDanhCase = {
  phanHe: FLOW_HT_002.phanHe,
  flow: FLOW_HT_002.flow,
  caseId: CASE_ID,
  module: FLOW_HT_002.module,
  rootCaseKey: `${FLOW_HT_002.module}|${FLOW_HT_002.flow}|${CASE_ID}`,
};

export const INPUT = {
  /** Mã tòa của TAND khu vực 5 - Bắc Ninh — phải trùng maToaDangNhap của GET /so-cap-so-don-vi/pham-vi */
  maToaKv5: 'D01.121.05',
};
