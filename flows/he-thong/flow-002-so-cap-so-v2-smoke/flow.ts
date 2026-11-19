/**
 * FLOW HỆ THỐNG 002 · SỔ CẤP SỐ V2 (QLN-13171) — SMOKE QUYỀN + MỞ MÀN, CHỈ ĐỌC, MÔI TRƯỜNG DEV.
 *
 * Kiểm hai màn mới của nhóm B (Epic QLN-4985) theo đúng phân quyền BA chốt:
 *   · "Danh mục sổ cấp số" (QTUD 5.1.9)   — CHỈ cấp TANDTC (SIEU_QUYEN / Chánh án test - Cục CNTT)
 *   · "Sổ cấp số của đơn vị" (QTUD 5.1.10) — mọi tòa; tòa cấp dưới chỉ xem tòa mình
 *
 * Không bước nào ghi dữ liệu: không đặt mốc, không nhập hồi tố, không bấm Thử cấp số.
 *
 * Nguồn FE (qla-webapp, nhánh feat so-cap-so a7 dựng trên develop 7343a69204, 09/11/2026):
 *   src/router/routes.ts:86-99   route /cau-hinh/danh-muc-so-cap-so, /cau-hinh/so-cap-so-don-vi,
 *                                 cả hai permissions ['qla:so_cap_so:xem']
 *   src/pages/SoCapSoDonVi/index.tsx   5 tab: Tất cả sổ · Số đã cấp · Hồi tố và gián đoạn ·
 *                                      Bất thường dãy số · Nhật ký sửa, xóa số; GET /so-cap-so-don-vi/pham-vi
 *   src/pages/DanhMucSoCapSo/index.tsx 4 tab: Tất cả sổ · Thử cấp số · Kiểm tra cấu hình · Danh mục
 *                                      (Danh mục có 7 tab con)
 * Bản deploy dev có thể khác nhánh trên: bước nào lệch thì thông báo lỗi liệt kê thứ ĐANG CÓ.
 */
import type { DinhNghiaFlow } from '../../../khung/flow';

const FE = 'qla-webapp feat so-cap-so-a7 trên develop 7343a69204 (09/11/2026)';
const MAN_DON_VI = 'Hệ thống › Cấu hình chung › Sổ cấp số của đơn vị (5.1.10)';
const MAN_DANH_MUC = 'Hệ thống › Cấu hình chung › Danh mục sổ cấp số (5.1.9)';
const CAN_CCCD_TANDTC =
  'cần CCCD vai quanTriTandtc (Ngô Hoài Thương, Cục CNTT) trong config/tai-khoan.dev.local.json';

export const FLOW_HT_002: DinhNghiaFlow = {
  phanHe: 'he-thong',
  flow: 'flow-002-so-cap-so-v2-smoke',
  module: 'HE_THONG_SO_CAP_SO_V2',
  ten: 'Sổ cấp số v2 (QLN-13171): quyền menu + mở màn Sổ cấp số của đơn vị / Danh mục sổ cấp số, chỉ đọc',
  nguon: `C:/Users/GTEL ICT/qla/specs/qln-13171-so-cap-so/spec.md BR-7 · ${FE}`,
  buoc: [
    // ───────── Tòa cấp khu vực: Thư ký TAND KV5 Bắc Ninh (D01.121.05) ─────────
    {
      ma: '01-menu-kv5',
      ten: 'KV5 Bắc Ninh: có menu "Sổ cấp số của đơn vị", KHÔNG có menu "Danh mục sổ cấp số"',
      manHinh: 'Menu chính (Menu V3)',
      route: '',
      vai: 'thuKyKv5BacNinh',
      vao: [],
      ra: ['menuKv5'],
      nguon: 'BA 09/11: Danh mục sổ cấp số chỉ dành cho cấp TANDTC',
      xacMinh: 'FE',
      bangChungXacMinh: `${FE}: routes.ts:86-99`,
      canTruoc: null,
    },
    {
      ma: '02-so-don-vi-kv5',
      ten: 'KV5 Bắc Ninh: mở "Sổ cấp số của đơn vị", phạm vi = tòa mình, đi qua 5 tab',
      manHinh: MAN_DON_VI,
      route: '',
      vai: 'thuKyKv5BacNinh',
      vao: [],
      ra: ['maToaKv5', 'tabSoDonViKv5'],
      nguon: 'spec.md BR-7 · B4 QLN-13205',
      xacMinh: 'FE',
      bangChungXacMinh: `${FE}: pages/SoCapSoDonVi/index.tsx, services/so-cap-so-don-vi.ts:45-46 (GET pham-vi)`,
      canTruoc: null,
    },
    {
      ma: '03-chan-danh-muc-kv5',
      ten: 'KV5 Bắc Ninh: gõ thẳng URL Danh mục sổ cấp số → KHÔNG vào được màn',
      manHinh: MAN_DANH_MUC,
      route: '',
      vai: 'thuKyKv5BacNinh',
      vao: [],
      ra: ['chanDanhMucKv5'],
      nguon: 'BA 09/11 + routes.ts permissions qla:so_cap_so:xem',
      xacMinh: 'FE',
      bangChungXacMinh: `${FE}: routes.ts:86-92`,
      canTruoc: null,
    },
    // ───────── TANDTC: Ngô Hoài Thương (Cục CNTT) ─────────
    {
      ma: '04-danh-muc-tandtc',
      ten: 'TANDTC: mở "Danh mục sổ cấp số", đi qua 4 tab + 7 tab con của Danh mục',
      manHinh: MAN_DANH_MUC,
      route: '',
      vai: 'quanTriTandtc',
      vao: [],
      ra: ['tabDanhMucTandtc'],
      nguon: `spec.md BR-7 · B1/B2/B6 · ${CAN_CCCD_TANDTC}`,
      xacMinh: 'FE',
      bangChungXacMinh: `${FE}: pages/DanhMucSoCapSo/index.tsx`,
      canTruoc: null,
    },
    {
      ma: '05-so-don-vi-tandtc',
      ten: 'TANDTC: "Sổ cấp số của đơn vị" xem được nhiều tòa (laToiCao)',
      manHinh: MAN_DON_VI,
      route: '',
      vai: 'quanTriTandtc',
      vao: [],
      ra: ['phamViTandtc'],
      nguon: `spec.md BR-7 · B4 phạm vi xem theo cấp tòa · ${CAN_CCCD_TANDTC}`,
      xacMinh: 'FE',
      bangChungXacMinh: `${FE}: pages/SoCapSoDonVi/index.tsx (Select "Xem tòa" theo phamVi.dsToa)`,
      canTruoc: null,
    },
  ],
};
