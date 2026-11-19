/**
 * CASE-GCS-001 · golden ngữ cảnh → sổ → số (QLN-13201 · A8) trên cấu hình thật của môi trường.
 *
 * Ngữ cảnh dựng từ cấu hình DEV đọc ngày 09/11/2026 (GET /dm-so-cap-so, /dm-tieu-chi-cap-so, /dm-diem-cap-so),
 * cùng kiểu với `NguCanhMau` của BE (qla · socapso/golden/GoldenDoiChieuCuMoiIT, commit 64cc7d7ec72):
 * maDiem + maToa + loaiSo + maBieuMau + ngày + tiêu chí (giaTri).
 *
 * `kyVong` chỉ ghi khi cấu hình cho thấy chắc chắn (sổ duy nhất có biểu mẫu / điều kiện đó). Còn lại để trống:
 * kết quả lấy từ BASELINE của môi trường (golden/<env>.json) — lần đầu ghi baseline là ĐỎ "cần duyệt".
 *
 * `cungKetQuaVoi`: các điểm cùng ngữ cảnh phải ra cùng sổ, cùng số dự kiến (cấp / xem / giữ trước).
 */
import type { DinhDanhCase } from '../../../../khung/case-state';
import { FLOW_HT_003 } from '../../../../flows/he-thong/flow-003-golden-cap-so/flow';

export const CASE_ID = 'case-gcs-001';

export const DD: DinhDanhCase = {
  phanHe: FLOW_HT_003.phanHe,
  flow: FLOW_HT_003.flow,
  caseId: CASE_ID,
  module: FLOW_HT_003.module,
  rootCaseKey: `${FLOW_HT_003.module}|${FLOW_HT_003.flow}|${CASE_ID}`,
};

export interface NguCanhGolden {
  /** mã ổn định của ngữ cảnh — khoá trong baseline, KHÔNG đổi khi đã có baseline */
  id: string;
  moTa: string;
  maDiem: string;
  maToa: string;
  loaiSo: 'THU_LY' | 'TIEP_NHAN' | 'VAN_BAN';
  maBieuMau?: string;
  /** tiêu chí → giá trị (mã trong danh mục tiêu chí), như ô "Thử cấp số" gửi lên */
  giaTri?: Record<string, string[]>;
  /** ngày cấp số; bỏ trống = hôm nay */
  ngay?: string;
  /**
   * Kỳ vọng chắc chắn theo cấu hình, KHAI THEO MÔI TRƯỜNG (dev/stg/preprod); trường bỏ trống thì không so cứng.
   * Theo môi trường vì mã mẫu sổ hiện trạng = HT-<tòa>-<8 ký tự đầu SO_CAP_SO.ID> (06-b3…sql), mà ID sổ cũ mỗi
   * môi trường mỗi khác: kỳ vọng dev đặt lên STG là lệch chắc chắn (đo STG 09/11/2026).
   */
  kyVong?: Partial<Record<'dev' | 'stg' | 'preprod', { ketQua?: string; maSo?: string }>>;
  /** id ngữ cảnh khác phải ra cùng sổ + cùng số dự kiến */
  cungKetQuaVoi?: string;
}

const KV5 = 'D01.121.05'; // TAND khu vực 5 - Bắc Ninh — có sổ thụ lý "1" (HNGĐ) và "SỔ THỤ LÝ" (phá sản) đã chuyển bộ máy
const TC = 'D01'; // TAND tối cao

export const INPUT = {
  /**
   * Tiêu chí 13 tại TAND KV5 Bắc Ninh (user chốt 09/11/2026). Ứng viên = biểu mẫu thuộc các sổ của KV5
   * (aaa, aaaaa, aaa11111, BN-số HS — cấu hình dev 09/11). Bước 04 chỉ giữ ứng viên mà bộ máy đang cấp đúng
   * vào sổ được chọn (toaDaCoSo); bước 05 giữ số THẬT lần lượt, biểu mẫu nhập tay bị từ chối = lệch tiêu chí 13
   * (đo 09/11: 03-HC.TC01-2026 thử ra 09/2026 nhưng giu-so trả BIEU_MAU_KHONG_LAY_SO_TU_DONG).
   */
  tieuChi13: {
    maToa: KV5,
    dsBieuMau: [
      '03-HC.TC01-2026',
      '14-HC.NQ02-2017',
      '27A-DS.NQ01-2017',
      'BMG-HS-1621',
      'BMG-HS-8572',
      '08-VDS.NQ04-2018',
      'TTTTHCDK',
      '08-DT.TC01-2026',
      '09-DT.TC01-2026',
    ],
  },
  /** Danh mục điểm cấp số đang dùng phải đúng bằng tập này (thêm/bớt điểm → cập nhật có chủ đích) */
  dsDiemGolden: [
    'CHUNG.GIU_SO_TRUOC',
    'CHUNG.LAY_SO_VAN_BAN',
    'CHUNG.LUU_SO_NHAP_TAY',
    'CHUNG.NHAP_SO_LE',
    'THU_LY.CAP_SO_THU_LY',
    'THU_LY.XEM_SO_THU_LY',
  ],
  nguCanh: [
    // ───────── Sổ thụ lý (bộ chọn theo quy tắc, BR-3) ─────────
    {
      id: 'TL-KV5-HNGD-ST',
      moTa: 'Thụ lý sơ thẩm vụ án HNGĐ ở KV5 → sổ "1" (AN_VIEC=VU_AN, ST, 003)',
      maDiem: 'THU_LY.CAP_SO_THU_LY',
      maToa: KV5,
      loaiSo: 'THU_LY',
      giaTri: { AN_VIEC: ['VU_AN'], LOAI_AN: ['003'], CAP_XET_XU: ['ST'], LOAI_DOI_TUONG: ['VU_AN'] },
      kyVong: { dev: { ketQua: 'DA_CHON', maSo: 'HT-D01.121.05-4455D81D' } },
    },
    {
      id: 'TL-KV5-HNGD-ST-XEM',
      moTa: 'Cùng ngữ cảnh, điểm Xem số thụ lý → phải ra đúng sổ, đúng số như điểm cấp',
      maDiem: 'THU_LY.XEM_SO_THU_LY',
      maToa: KV5,
      loaiSo: 'THU_LY',
      giaTri: { AN_VIEC: ['VU_AN'], LOAI_AN: ['003'], CAP_XET_XU: ['ST'], LOAI_DOI_TUONG: ['VU_AN'] },
      cungKetQuaVoi: 'TL-KV5-HNGD-ST',
    },
    {
      id: 'TL-KV5-PHA-SAN-ST',
      moTa: 'Thụ lý phá sản ở KV5 → sổ "SỔ THỤ LÝ" (ST, 007)',
      maDiem: 'THU_LY.CAP_SO_THU_LY',
      maToa: KV5,
      loaiSo: 'THU_LY',
      giaTri: { AN_VIEC: ['VIEC'], LOAI_AN: ['007'], CAP_XET_XU: ['ST'], LOAI_DOI_TUONG: ['VU_AN'] },
      kyVong: { dev: { maSo: 'HT-D01.121.05-A40FD1F3' } },
    },
    {
      id: 'TL-KV5-HS-ST',
      moTa: 'Thụ lý sơ thẩm hình sự ở KV5 → có 2 sổ HS-ST (mẫu dev, TLHS) — baseline ghi sổ nào thắng',
      maDiem: 'THU_LY.CAP_SO_THU_LY',
      maToa: KV5,
      loaiSo: 'THU_LY',
      giaTri: { AN_VIEC: ['VU_AN'], LOAI_AN: ['001'], CAP_XET_XU: ['ST'], LOAI_DOI_TUONG: ['VU_AN'] },
    },
    {
      id: 'TL-KV5-DS-ST',
      moTa: 'Thụ lý sơ thẩm dân sự ở KV5 → dev chưa có sổ DS-ST (tiêu chí 8: chặn, không cấp từ sổ khác)',
      maDiem: 'THU_LY.CAP_SO_THU_LY',
      maToa: KV5,
      loaiSo: 'THU_LY',
      giaTri: { AN_VIEC: ['VU_AN'], LOAI_AN: ['002'], CAP_XET_XU: ['ST'], LOAI_DOI_TUONG: ['VU_AN'] },
    },
    {
      id: 'TL-TC-GDT-HS-DON',
      moTa: 'Thụ lý đơn GĐT-TT hình sự ở TANDTC → có 2 sổ GĐT hình sự khớp (GDT-HS, GDTTT hình sự)',
      maDiem: 'THU_LY.CAP_SO_THU_LY',
      maToa: TC,
      loaiSo: 'THU_LY',
      giaTri: { LOAI_AN: ['001'], CAP_XET_XU: ['GDT'], LUONG_THU_LY: ['DON'], LOAI_DOI_TUONG: ['DON'] },
    },
    // ───────── Sổ văn bản (biểu mẫu → sổ) ─────────
    {
      id: 'VB-KV5-03HC',
      moTa: 'Văn bản 03-HC.TC01-2026 ở KV5 → sổ "aaa" (sổ duy nhất có biểu mẫu này)',
      maDiem: 'CHUNG.LAY_SO_VAN_BAN',
      maToa: KV5,
      loaiSo: 'VAN_BAN',
      maBieuMau: '03-HC.TC01-2026',
      kyVong: { dev: { maSo: 'HT-D01.121.05-6B45763F' } },
    },
    {
      id: 'VB-KV5-03HC-GIU',
      moTa: 'Cùng ngữ cảnh, điểm Giữ số trước → cùng sổ, cùng số dự kiến',
      maDiem: 'CHUNG.GIU_SO_TRUOC',
      maToa: KV5,
      loaiSo: 'VAN_BAN',
      maBieuMau: '03-HC.TC01-2026',
      cungKetQuaVoi: 'VB-KV5-03HC',
    },
    {
      id: 'VB-KV5-47DS',
      moTa: '47-DS.TC01-2026 ở KV5 → "Sổ công văn" (sổ cấp TANDTC áp dụng mọi cấp tòa)',
      maDiem: 'CHUNG.LAY_SO_VAN_BAN',
      maToa: KV5,
      loaiSo: 'VAN_BAN',
      maBieuMau: '47-DS.TC01-2026',
      giaTri: { LOAI_AN: ['002'], CAP_XET_XU: ['ST'] },
    },
    {
      id: 'VB-KV5-47DS-KDTM',
      moTa: '47-DS cùng tòa, vụ KDTM → cùng sổ, cùng dãy với vụ DS (tiêu chí 2)',
      maDiem: 'CHUNG.LAY_SO_VAN_BAN',
      maToa: KV5,
      loaiSo: 'VAN_BAN',
      maBieuMau: '47-DS.TC01-2026',
      giaTri: { LOAI_AN: ['004'], CAP_XET_XU: ['ST'] },
      cungKetQuaVoi: 'VB-KV5-47DS',
    },
    {
      id: 'VB-TC-47DS',
      moTa: '47-DS.TC01-2026 ở TANDTC → cùng mẫu sổ, dãy riêng của tòa TC',
      maDiem: 'CHUNG.LAY_SO_VAN_BAN',
      maToa: TC,
      loaiSo: 'VAN_BAN',
      maBieuMau: '47-DS.TC01-2026',
      giaTri: { LOAI_AN: ['002'], CAP_XET_XU: ['ST'] },
    },
    {
      id: 'VB-KV5-KHONG-CO-SO',
      moTa: 'Biểu mẫu không gắn sổ nào → không được cấp (tiêu chí 8) — dev có sổ mẫu bắt mọi văn bản (VB-MAU-DEV)',
      maDiem: 'CHUNG.LAY_SO_VAN_BAN',
      maToa: KV5,
      loaiSo: 'VAN_BAN',
      maBieuMau: 'PW-KHONG-TON-TAI',
    },
  ] as NguCanhGolden[],
};
