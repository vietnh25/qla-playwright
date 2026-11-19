/**
 * FLOW HỆ THỐNG 001 · CẤP SỐ TỰ ĐỘNG — bản đồ bước.
 *
 * Mục đích: diễn tập trên STG việc tòa Hà Nội tự cấu hình sổ cấp số trước thí điểm 15/11/2026 rồi
 * kiểm hệ thống cấp số ĐÚNG SỔ khi làm nghiệp vụ thật:
 *
 *   A. CẤU HÌNH (màn Hệ thống › Cấu hình › Sổ cấp số — `qla-webapp/src/pages/SoCapSo/index.tsx`)
 *      01 sổ thụ lý mã 999 · Dân sự · Sơ thẩm          (tìm, chưa có thì tạo)
 *      02 sổ văn bản riêng của luồng · Dân sự · mọi cấp  (tìm, chưa có thì tạo, đặt "Số cấp tiếp theo")
 *      03 gắn biểu mẫu QĐ phân công Thẩm phán giải quyết đơn (DS001 = 55-DS.TC01-2026) vào sổ 02
 *      04 kích hoạt cấu hình cấp số của biểu mẫu đó trong sổ 02
 *   B. NGHIỆP VỤ — dùng nguyên thân bước của luồng KDTM/Dân sự (không chép lại):
 *      05 tạo đơn · 06 phân công (Lấy số DS001) · 07 KIỂM sổ văn bản
 *      08 26-DS · 09 29-DS · 10 biên lai · 11 thụ lý 30-DS · 12 đọc số thụ lý · 13 KIỂM sổ thụ lý
 *
 * Bước 05→12 lấy định nghĩa từ FLOW_DS_001 (route, vào/ra, nguồn) và chỉ đổi mã bước, nên sửa ở
 * luồng gốc là luồng này nhận theo.
 */
import type { DinhNghiaBuoc, DinhNghiaFlow } from '../../../khung/flow';
import { FLOW_DS_001 } from '../../dan-su/flow-001-st-pt/flow';

const MAN_SO = 'Hệ thống › Cấu hình › Sổ cấp số';
const FE_SO = 'qla-webapp/src/pages/SoCapSo/index.tsx (staging/1.4.0, 05/11/2026)';

/** Ánh xạ mã bước của luồng này → mã bước gốc trong luồng Dân sự */
export const BUOC_DUNG_LAI: Record<string, string> = {
  '05-tao-don-khoi-kien': '01-tao-don-khoi-kien',
  '06-phan-cong-lay-so-ds001': '02-phan-cong-tham-phan-xu-ly-don',
  '08-thong-bao-sua-doi-26-ds': '03-thong-bao-sua-doi-bo-sung-26-ds',
  '09-tam-ung-an-phi-29-ds': '04-tam-ung-an-phi-29-ds',
  '10-xac-minh-bien-lai': '05-xac-minh-bien-lai',
  '11-thu-ly-vu-an-30-ds': '06-thu-ly-vu-an-30-ds',
  '12-doc-so-thu-ly': '07-so-tham-thu-ly',
};

function dungLai(ma: string): DinhNghiaBuoc {
  const goc = FLOW_DS_001.buoc.find(b => b.ma === BUOC_DUNG_LAI[ma]);
  if (!goc) throw new Error(`Luồng Dân sự không còn bước ${BUOC_DUNG_LAI[ma]} — cập nhật BUOC_DUNG_LAI`);
  // canTruoc bỏ đi: phụ thuộc tính lại theo thứ tự của luồng này
  return { ...goc, ma, canTruoc: undefined };
}

export const FLOW_HT_001: DinhNghiaFlow = {
  phanHe: 'he-thong',
  flow: 'flow-001-cap-so-tu-dong',
  module: 'HE_THONG_CAP_SO',
  ten: 'Cấu hình sổ cấp số (999 + sổ văn bản + gắn/kích hoạt biểu mẫu) → tạo đơn, phân công, thụ lý → kiểm số cấp đúng sổ',
  nguon: `${FE_SO} · luồng Dân sự flows/dan-su/flow-001-st-pt`,
  buoc: [
    {
      ma: '01-so-thu-ly-999',
      ten: 'Sổ thụ lý 999 · Dân sự · Sơ thẩm: tìm, chưa có thì Thêm nhóm sổ',
      manHinh: `${MAN_SO} · tab Số tự động`,
      route: '',
      vai: 'cauHinhSo',
      vao: [],
      ra: ['tenSoThuLy', 'soThuLyDaCapDen', 'soThuLyMoiTao'],
      nguon: 'BA 08/10 + 15/10: sổ 999 duy nhất theo loại án + cấp; cấp số chọn đúng cấp → sổ không ghi cấp',
      xacMinh: 'FE',
      bangChungXacMinh: `${FE_SO}: ModalForm tenSoCapSo/loaiSoCapSo/maLoaiAn/capXetXu/soCapTu`,
      canTruoc: null,
    },
    {
      ma: '02-so-van-ban',
      ten: 'Sổ văn bản của luồng · Dân sự · mọi cấp: tìm theo mã, chưa có thì tạo',
      manHinh: `${MAN_SO} · tab Số tự động`,
      route: '',
      vai: 'cauHinhSo',
      vao: [],
      ra: ['tenSoVanBan', 'soVanBanDaCapDen', 'soVanBanMoiTao'],
      nguon: 'BA 08/10: "Số cấp tiếp theo" nhập 20 thì văn bản đầu nhận 20',
      xacMinh: 'FE',
      bangChungXacMinh: FE_SO,
    },
    {
      ma: '03-gan-bieu-mau',
      ten: 'Gắn biểu mẫu hàng loạt: QĐ phân công Thẩm phán giải quyết đơn (DS001) vào sổ văn bản',
      manHinh: `${MAN_SO} · ⋮ › Gắn biểu mẫu hàng loạt`,
      route: '',
      vai: 'cauHinhSo',
      vao: ['tenSoVanBan'],
      ra: ['ketQuaGanBieuMau'],
      nguon: 'qla-webapp/src/pages/SoCapSo/GanBieuMauHangLoatModal.tsx',
      xacMinh: 'FE',
    },
    {
      ma: '04-kich-hoat-cau-hinh',
      ten: 'Kích hoạt cấu hình cấp số của DS001 trong sổ văn bản (Đang áp dụng)',
      manHinh: `${MAN_SO} · ⋮ › Kích hoạt cấu hình cấp số`,
      route: '',
      vai: 'cauHinhSo',
      vao: ['tenSoVanBan', 'ketQuaGanBieuMau'],
      ra: ['trangThaiCauHinh'],
      nguon: 'UC196 · qla-webapp/src/pages/SoCapSo/CauHinhBieuMauSoModal.tsx',
      xacMinh: 'FE',
    },
    dungLai('05-tao-don-khoi-kien'),
    dungLai('06-phan-cong-lay-so-ds001'),
    {
      ma: '07-kiem-so-van-ban',
      ten: 'KIỂM: số QĐ phân công lấy từ sổ văn bản, đúng số kế tiếp, sổ tăng "Đã cấp đến số"',
      manHinh: `${MAN_SO} · tab Số tự động`,
      route: '',
      vai: 'cauHinhSo',
      vao: ['soQuyetDinhPhanCongDon', 'tenSoVanBan', 'soVanBanDaCapDen', 'soVanBanMoiTao'],
      ra: ['ketQuaKiemSoVanBan'],
      nguon: 'CapSoServiceImpl: số = MAX(CAP_SO.SO_THUTU) của sổ + năm + 1; sổ mới bắt đầu từ Số cấp tiếp theo',
      xacMinh: 'FE',
    },
    dungLai('08-thong-bao-sua-doi-26-ds'),
    dungLai('09-tam-ung-an-phi-29-ds'),
    dungLai('10-xac-minh-bien-lai'),
    dungLai('11-thu-ly-vu-an-30-ds'),
    dungLai('12-doc-so-thu-ly'),
    {
      ma: '13-kiem-so-thu-ly',
      ten: 'KIỂM: số thụ lý lấy từ sổ 999 Dân sự sơ thẩm, đúng số kế tiếp',
      manHinh: `${MAN_SO} · tab Số tự động`,
      route: '',
      vai: 'cauHinhSo',
      vao: ['soThuLySoTham', 'tenSoThuLy', 'soThuLyDaCapDen', 'soThuLyMoiTao'],
      ra: ['ketQuaKiemSoThuLy'],
      nguon: 'BA 14/10: số thụ lý bắt buộc cấp tự động · CapSoServiceImpl.timSoThuLyTheoLoaiAn',
      xacMinh: 'FE',
    },
  ],
};
