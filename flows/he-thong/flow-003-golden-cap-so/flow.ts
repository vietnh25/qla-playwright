/**
 * FLOW HỆ THỐNG 003 · GOLDEN NGỮ CẢNH → SỔ → SỐ CHO CÁC ĐIỂM CẤP SỐ (Jira QLN-13201 · [Sổ cấp số][A8]).
 *
 * Bổ sung cho golden phía BE (qla commit 64cc7d7ec72, đã merge develop):
 *   · GoldenCapSoTest       — cấu hình GIẢ trong bộ nhớ (tòa T01/T02), chứng minh LOGIC bộ máy.
 *   · GoldenDoiChieuCuMoiIT — DB chỉ đọc, cũ ↔ mới (D1, D14), cần JDBC.
 * Luồng này chạy qua HTTP trên CẤU HÌNH THẬT của môi trường (API "Thử cấp số" = xem trước, không cấp số),
 * nên bắt được lệch cấu hình giữa DEV / STG / production (D14) mà không cần quyền DB.
 *
 *   01 danh mục điểm cấp số đang dùng = tập golden            (ĐX-11 ở mức dữ liệu: điểm mới/điểm mất lộ ra)
 *   02 golden ngữ cảnh → sổ → số + bất biến cùng-kết-quả         (D1, D14; tiêu chí 2, 8)
 *   03 đối chiếu baseline giữa các môi trường                  (D14)
 *   04–05 mô phỏng = cấp thật tại KV5 Bắc Ninh               (tiêu chí 13) — GIỮ SỐ THẬT rồi trả lại ngay
 *
 * Tiêu chí 14 (quét lời gọi bắt buộc mã điểm) là unit test mã nguồn BE (MaDiemCapSoTest), không thuộc E2E.
 *
 * Nguồn FE: qla-webapp develop 7343a69204 (09/11/2026) · services/dm-so-cap-so.ts:83-84 (GET /dm-diem-cap-so),
 * :180-181 (POST /dm-so-cap-so/thu-cap-so), types/dm-so-cap-so.d.ts:251-274 (ThuCapSoDTO/VO).
 */
import type { DinhNghiaFlow } from '../../../khung/flow';

const FE = 'qla-webapp develop 7343a69204 · services/dm-so-cap-so.ts';
const MAN = 'Hệ thống › Cấu hình chung › Danh mục sổ cấp số · tab Thử cấp số (API)';

export const FLOW_HT_003: DinhNghiaFlow = {
  phanHe: 'he-thong',
  flow: 'flow-003-golden-cap-so',
  module: 'HE_THONG_GOLDEN_CAP_SO',
  ten: 'Golden ngữ cảnh → sổ → số cho các điểm cấp số trên cấu hình thật (QLN-13201 · A8)',
  nguon: 'Jira QLN-13201 · SRS QLN-13171 §9 tiêu chí 2, 8, 13; rủi ro D1, D14; ĐX-11',
  buoc: [
    {
      ma: '01-diem-cap-so',
      ten: 'Danh mục điểm cấp số đang dùng khớp tập golden',
      manHinh: `${MAN} · GET /dm-diem-cap-so`,
      route: '',
      vai: 'quanTriTandtc',
      vao: [],
      ra: ['dsDiemCapSo'],
      nguon: 'SRS ĐX-11, BR-6.1-02',
      xacMinh: 'RUNTIME',
      bangChungXacMinh: `${FE}:83-84 · dev 09/11/2026 trả 6 điểm đang dùng`,
      canTruoc: null,
    },
    {
      ma: '02-golden-ngu-canh',
      ten: 'Golden: mỗi ngữ cảnh mẫu → sổ, dãy, số dự kiến khớp baseline + kỳ vọng cứng + cùng-kết-quả',
      manHinh: `${MAN} · POST /dm-so-cap-so/thu-cap-so`,
      route: '',
      vai: 'quanTriTandtc',
      vao: [],
      ra: ['ketQuaGolden'],
      nguon: 'SRS rủi ro D1, D14; §9 tiêu chí 2, 8',
      xacMinh: 'RUNTIME',
      bangChungXacMinh: `${FE}:180-181 · dev 09/11/2026 trả THIEU_DU_LIEU kèm tiêu chí còn thiếu`,
      canTruoc: null,
    },
    {
      ma: '03-doi-chieu-moi-truong',
      ten: 'D14: đối chiếu baseline golden giữa các môi trường (dev / stg / preprod)',
      manHinh: 'data/he-thong/flow-003-golden-cap-so/golden/*.json',
      route: '',
      vai: 'quanTriTandtc',
      // Đọc FILE baseline của các môi trường, không đọc state bước 02: lần đầu chạy ở môi trường mới bước 02
      // luôn đỏ ("baseline mới, cần duyệt") — phụ thuộc 02 thì bước này không bao giờ chạy được.
      vao: [],
      ra: ['doiChieuMoiTruong'],
      nguon: 'SRS rủi ro D14',
      xacMinh: 'RUNTIME',
      canTruoc: null,
    },
    /**
     * TIÊU CHÍ 13 tại TAND KV5 Bắc Ninh (user chốt 09/11/2026). Hai bước vì hai vai:
     * Thử cấp số là màn của TANDTC; giữ số cấp cho TÒA ĐANG ĐĂNG NHẬP (CapSoServiceImpl.java:2004 lấy
     * userInfo.getMaToaAn()) nên phải đăng nhập KV5. Số giữ được TRẢ LẠI ngay (huy-so-giu) dù khớp hay lệch.
     */
    {
      ma: '04-thu-cap-so-kv5',
      ten: 'Tiêu chí 13 (1/2): Thử cấp số điểm Giữ số trước tại KV5 cho các biểu mẫu ứng viên → sổ + số dự kiến',
      manHinh: `${MAN} · POST /dm-so-cap-so/thu-cap-so (maDiem CHUNG.GIU_SO_TRUOC, maToa D01.121.05)`,
      route: '',
      vai: 'quanTriTandtc',
      vao: [],
      ra: ['dsDuKienKv5'],
      nguon: 'SRS §9 tiêu chí 13',
      xacMinh: 'FE',
      bangChungXacMinh: `${FE}:180-181`,
      canTruoc: null,
    },
    {
      ma: '05-giu-so-that-kv5',
      ten: 'Tiêu chí 13 (2/2): KV5 giữ số THẬT ngay sau → đúng số đã thử; rồi trả số (huy-so-giu)',
      manHinh: 'POST /cap-so/giu-so (điểm CHUNG.GIU_SO_TRUOC) · POST /cap-so/{id}/huy-so-giu',
      route: '',
      vai: 'thuKyKv5BacNinh',
      vao: ['dsDuKienKv5'],
      ra: ['tieuChi13Kv5'],
      nguon: 'SRS §9 tiêu chí 13 · GHI SỐ THẬT (user đồng ý 09/11/2026), trả số ngay',
      xacMinh: 'FE',
      bangChungXacMinh:
        'qla feat a7 b679da6958: CapSoController.java:165-180, CapSoServiceImpl.java:1999-2030 (giữ số qua bộ máy khi sổ đã chuyển), :2064-2075 (huỷ số giữ)',
    },
  ],
};
