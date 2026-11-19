/**
 * CASE-SC-001 · Sổ chờ tại TAND KV5 Bắc Ninh (QLN-13300) trên DEV. Ghi dữ liệu thật: số trong Sổ chờ của KV5 và
 * một sổ chính tạo từ dãy chờ (tên bắt đầu bằng `tenSoChinh` để dễ nhận ra trên Danh mục sổ cấp số).
 */
import type { DinhDanhCase } from '../../../../khung/case-state';
import { FLOW_HT_004 } from '../../../../flows/he-thong/flow-004-so-cho/flow';

export const CASE_ID = 'case-sc-001';

export const DD: DinhDanhCase = {
  phanHe: FLOW_HT_004.phanHe,
  flow: FLOW_HT_004.flow,
  caseId: CASE_ID,
  module: FLOW_HT_004.module,
  rootCaseKey: `${FLOW_HT_004.module}|${FLOW_HT_004.flow}|${CASE_ID}`,
};

export const INPUT = {
  /**
   * VAN_BAN = tự lấy số văn bản ở KV5 để sinh dãy (bước 02–04, 08). DAY_CO_SAN = dùng dãy chờ đã có, bỏ các bước đó.
   * 12/11/2026 dev: sổ mẫu VB-MAU-DEV nhận MỌI văn bản của KV5 (40/40 biểu mẫu thử DA_CHON) → văn bản không bao giờ
   * vào Sổ chờ. User chốt dùng dãy thụ lý có sẵn của KV5 (THA_THU_LY_BI_AN, 3 số, tạo 12/11/2026).
   */
  cheDo: 'DAY_CO_SAN' as 'VAN_BAN' | 'DAY_CO_SAN',
  dayCanTim: { loaiSo: 'THU_LY' as const, giaTri: { THU_TUC: ['THA_THU_LY_BI_AN'], LOAI_AN: ['012'] } as Record<string, string[]> },
  soCho: {
    maToa: 'D01.121.05', // TAND khu vực 5 - Bắc Ninh — tòa của vai thuKyKv5BacNinh
    /** thử trước các biểu mẫu này; trống = lấy từ Kiểm tra cấu hình (chưa có sổ / chưa thuộc sổ nào) */
    dsBieuMauUuTien: [] as string[],
    toiDaThu: 40,
  },
  tenSoChinh: 'PW QLN-13300 sổ từ Sổ chờ',
  /** vai lấy số ở bước 03/04/08 (null = theo flow.ts: Thư ký KV5) */
  vaiLaySo: null as string | null,
};
