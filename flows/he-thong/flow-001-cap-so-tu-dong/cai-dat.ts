/**
 * FLOW HỆ THỐNG 001 · BẢNG CÀI ĐẶT: mã bước → thân nghiệp vụ.
 *
 * Bước 01–04, 07, 13: màn Sổ cấp số (`so-cap-so.flow.ts`).
 * Bước 05, 06, 08–12: gọi NGUYÊN thân bước của luồng KDTM/Dân sự theo `BUOC_DUNG_LAI` — không chép.
 */
import type { BangCaiDat, CaiDatBuoc } from '../../../khung/luong';
import { CAI_DAT as CAI_DAT_DS } from '../../dan-su/flow-001-st-pt/cai-dat';
import { BUOC_DUNG_LAI } from './flow';
import { ganBieuMau, kichHoatCauHinh, kiemSoDaCap, timHoacTaoSo } from './so-cap-so.flow';
import type { INPUT } from '../../../data/he-thong/flow-001-cap-so-tu-dong/case-001/input';

export type InputCapSo = typeof INPUT;

function goc(ma: string): CaiDatBuoc<InputCapSo> {
  const than = CAI_DAT_DS[BUOC_DUNG_LAI[ma]];
  if (!than) throw new Error(`Luồng Dân sự chưa cài đặt bước ${BUOC_DUNG_LAI[ma]}`);
  return than as unknown as CaiDatBuoc<InputCapSo>;
}

/**
 * Bước 06 bọc thêm một kiểm tra: công tắc "Nhập số thủ công" (QTUD.SETTING nhap-so-thu-cong) đang
 * BẬT thì mọi văn bản (trừ thụ lý, bản án) nhập số tay — không có gì để kiểm cấp số tự động.
 * FE hỏi công tắc qua GET /van-ban/nhap-so-thu-cong khi mở biểu mẫu; nghe chính câu trả lời đó.
 */
const phanCongCoKiemCongTac: CaiDatBuoc<InputCapSo> = async bc => {
  let congTacBat = false;
  const nghe = async (r: import('@playwright/test').Response) => {
    if (!/\/van-ban\/nhap-so-thu-cong/.test(r.url())) return;
    const j = await r.json().catch(() => null);
    if (j?.data === true) congTacBat = true;
  };
  bc.page.on('response', nghe);
  try {
    return await goc('06-phan-cong-lay-so-ds001')(bc);
  } catch (e) {
    if (congTacBat) {
      throw new Error(
        'Công tắc "Nhập số thủ công" đang BẬT trên môi trường này nên DS001 không có nút Lấy số. ' +
          'Tắt ở QTUD › Cấu hình đăng nhập rồi chạy lại bước 06.\n' + (e instanceof Error ? e.message : String(e)),
      );
    }
    throw e;
  } finally {
    bc.page.off('response', nghe);
  }
};

export const CAI_DAT: BangCaiDat<InputCapSo> = {
  // ═════════ A · CẤU HÌNH SỔ ═════════
  '01-so-thu-ly-999': async ({ page, input, ghi }) => {
    const kq = await timHoacTaoSo(page, input.soThuLy, ghi);
    return { tenSoThuLy: kq.ten, soThuLyDaCapDen: String(kq.daCapDen), soThuLyMoiTao: String(kq.moiTao) };
  },
  '02-so-van-ban': async ({ page, input, ghi }) => {
    const kq = await timHoacTaoSo(page, input.soVanBan, ghi);
    return { tenSoVanBan: kq.ten, soVanBanDaCapDen: String(kq.daCapDen), soVanBanMoiTao: String(kq.moiTao) };
  },
  '03-gan-bieu-mau': async ({ page, input, ghi, can }) => ({
    ketQuaGanBieuMau: await ganBieuMau(page, can('tenSoVanBan'), input.maBieuMauGan, input.choPhepChuyenSo, ghi),
  }),
  '04-kich-hoat-cau-hinh': async ({ page, input, ghi, can }) => ({
    trangThaiCauHinh: await kichHoatCauHinh(page, can('tenSoVanBan'), input.maBieuMauGan, ghi),
  }),

  // ═════════ B · NGHIỆP VỤ + KIỂM SỐ ═════════
  '05-tao-don-khoi-kien': goc('05-tao-don-khoi-kien'),
  '06-phan-cong-lay-so-ds001': phanCongCoKiemCongTac,
  '07-kiem-so-van-ban': async ({ page, input, ghi, can }) => ({
    ketQuaKiemSoVanBan: await kiemSoDaCap(page, ghi, {
      tenSo: can('tenSoVanBan'),
      maSo: input.soVanBan.ma,
      soNhan: can('soQuyetDinhPhanCongDon'),
      daCapDenTruoc: Number(can('soVanBanDaCapDen')),
      moiTao: can('soVanBanMoiTao') === 'true',
      soCapTiepTheo: input.soVanBan.soCapTiepTheo,
    }),
  }),
  '08-thong-bao-sua-doi-26-ds': goc('08-thong-bao-sua-doi-26-ds'),
  '09-tam-ung-an-phi-29-ds': goc('09-tam-ung-an-phi-29-ds'),
  '10-xac-minh-bien-lai': goc('10-xac-minh-bien-lai'),
  '11-thu-ly-vu-an-30-ds': goc('11-thu-ly-vu-an-30-ds'),
  '12-doc-so-thu-ly': goc('12-doc-so-thu-ly'),
  '13-kiem-so-thu-ly': async ({ page, input, ghi, can }) => ({
    ketQuaKiemSoThuLy: await kiemSoDaCap(page, ghi, {
      tenSo: can('tenSoThuLy'),
      maSo: input.soThuLy.ma,
      soNhan: can('soThuLySoTham'),
      daCapDenTruoc: Number(can('soThuLyDaCapDen')),
      moiTao: can('soThuLyMoiTao') === 'true',
      soCapTiepTheo: input.soThuLy.soCapTiepTheo,
    }),
  }),
};
