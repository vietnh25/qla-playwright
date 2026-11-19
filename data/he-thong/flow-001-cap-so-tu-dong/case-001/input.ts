/**
 * CASE-CS-001 · cấp số tự động, tòa Hà Nội trên STG (diễn tập thí điểm 15/11/2026).
 *
 * Dữ liệu nghiệp vụ (đơn, đương sự, biểu mẫu 26/29/30-DS…) lấy NGUYÊN case-001 của luồng Dân sự;
 * ở đây chỉ thêm cấu hình sổ. Tên đương sự sinh theo mã case này nên không trùng vụ của luồng Dân sự.
 *
 * TÒA chạy = tòa của tài khoản vai `vaiSoTham` (config/tai-khoan.local.json). Sổ cấp số là sổ CỦA
 * TÒA đăng nhập, nên bước cấu hình (vai `cauHinhSo`) phải dùng cùng tài khoản/tòa với bước thụ lý.
 */
import type { DinhDanhCase } from '../../../../khung/case-state';
import { tenDuongSu } from '../../../../khung/ten-viet';
import { FLOW_HT_001 } from '../../../../flows/he-thong/flow-001-cap-so-tu-dong/flow';
import { INPUT as INPUT_DS } from '../../../dan-su/flow-001-st-pt/case-001/input';

export const CASE_ID = 'case-cs-001';

export const DD: DinhDanhCase = {
  phanHe: FLOW_HT_001.phanHe,
  flow: FLOW_HT_001.flow,
  caseId: CASE_ID,
  module: FLOW_HT_001.module,
  rootCaseKey: `${FLOW_HT_001.module}|${FLOW_HT_001.flow}|${CASE_ID}`,
};

const NGUYEN_DON = tenDuongSu(CASE_ID, 'nguyenDon');
const BI_DON = tenDuongSu(CASE_ID, 'biDon', 'nu');

export const INPUT = {
  ...INPUT_DS,
  nguyenDon: { ...INPUT_DS.nguyenDon, nguyenVan: NGUYEN_DON, hoTen: NGUYEN_DON },
  biDon: { ...INPUT_DS.biDon, nguyenVan: BI_DON, hoTen: BI_DON },
  noiDungYeuCau: `Đề nghị Tòa án giải quyết tranh chấp hợp đồng vay tài sản giữa ${NGUYEN_DON} và ${BI_DON}.`,

  /**
   * Tòa Hà Nội: KV9 Hà Nội (D01.131.09, Nguyễn Mậu Trường — vai chanhAnDanSu). Vai chanhAnDanSuVuAn
   * của luồng Dân sự là tòa D01.133, không phải Hà Nội.
   */
  vaiSoTham: 'chanhAnDanSu',
  /** Tài khoản cấu hình sổ — trùng tài khoản tòa sơ thẩm (cùng tòa, dùng chung phiên) */
  vaiCauHinhSo: 'chanhAnDanSu',

  /** Sổ thụ lý: tòa đã có sổ 999 Dân sự (Sơ thẩm hoặc Mọi cấp) thì dùng sổ đó, không tạo thêm */
  soThuLy: {
    ten: 'Sổ thụ lý - Dân sự sơ thẩm',
    ma: '999',
    loaiAn: 'Dân sự',
    capXetXu: 'Sơ thẩm',
    soCapTiepTheo: 1,
  },

  /** Sổ văn bản riêng của luồng — mã cố định để chạy lại thì tìm thấy, không tạo trùng */
  soVanBan: {
    ten: 'PW - Sổ quyết định phân công Dân sự',
    ma: 'PW-QDPC-DS',
    loaiAn: 'Dân sự',
    capXetXu: '',
    soCapTiepTheo: 500,
  },

  /** QĐ phân công Thẩm phán giải quyết đơn — MaBieuMauEnum.DS001 (qla-webapp/src/types/enums.d.ts) */
  maBieuMauGan: '55-DS.TC01-2026',

  /**
   * 55-DS đang ở sổ khác cùng loại án, cùng cấp của tòa thì có chuyển sang sổ PW không.
   * true: QĐ phân công DS của CẢ TÒA trên STG sẽ lấy số từ sổ PW từ đây về sau (số cũ giữ nguyên).
   */
  choPhepChuyenSo: true,
};
