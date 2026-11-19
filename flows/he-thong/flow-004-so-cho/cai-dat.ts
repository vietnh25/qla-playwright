/**
 * FLOW HỆ THỐNG 004 · BẢNG CÀI ĐẶT — Sổ chờ (QLN-13300). CÓ GHI dữ liệu thật trên DEV (user chốt 12/11/2026).
 */
import { test } from '@playwright/test';
import type { BangCaiDat } from '../../../khung/luong';
import type { INPUT } from '../../../data/he-thong/flow-004-so-cho/case-001/input';
import {
  apDung,
  chonMoiToa,
  duaVaoSoDaCo,
  sauBanSua,
  tabSoChoUi,
  xoaNhapCanhBao,
  capKhiChoDuyet,
  capVaoSoCho,
  goGanLai,
  huyCapLai,
  kiemDayVoHieu,
  kiemTraTruocApDung,
  kiemTrienKhai,
  chuoiCuTrongLichSu,
  lichSuChuyen,
  quanSatSc16,
  thongBaoTandtc,
  thongBaoTinh,
  quyenTinh,
  sauApDung,
  taoBanNhap,
  timBieuMauThieuSo,
  timDayChoTandtc,
} from './so-cho.flow';

export type InputSoCho = typeof INPUT;

/** Hậu tố mới khi chuyển dãy B (QC ca 17, SC-48) */
const HAU_TO_MOI = 'PWHT';

/** Bước tự lấy số văn bản: chỉ chạy ở chế độ VAN_BAN (xem input.cheDo). */
const chiVanBan = (input: InputSoCho) =>
  test.skip(input.cheDo !== 'VAN_BAN', `Case dùng dãy chờ có sẵn (${input.cheDo}) — bước tự lấy số văn bản không áp dụng`);

export const CAI_DAT: BangCaiDat<InputSoCho> = {
  '01-trien-khai': async ({ page, ghi }) => ({ trienKhai: await kiemTrienKhai(page, ghi) }),
  '02-bieu-mau-thieu-so': async ({ page, input, ghi }) => {
    chiVanBan(input);
    const [maBieuMau, maBieuMau2] = await timBieuMauThieuSo(page, ghi, input.soCho);
    return { maBieuMau, maBieuMau2 };
  },
  '03-cap-vao-so-cho': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    return capVaoSoCho(page, ghi, input.soCho.maToa, can('maBieuMau'), can('maBieuMau2'));
  },
  '04-huy-cap-lai': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    return huyCapLai(page, ghi, can('maBieuMau'), can('so1'));
  },
  '05-day-cho-tandtc': async ({ page, input, ghi, duLieu }) => {
    // Chế độ VAN_BAN: dãy là dãy của biểu mẫu bước 02 (đọc duLieu, không bắt buộc — chế độ DAY_CO_SAN không có).
    const can = input.cheDo === 'VAN_BAN' && duLieu.maBieuMau
      ? { loaiSo: 'VAN_BAN' as const, giaTri: { BIEU_MAU: [duLieu.maBieuMau] } }
      : input.dayCanTim;
    const kq = await timDayChoTandtc(page, ghi, input.soCho.maToa, can);
    return { idDay: kq.idDay, dsSoCho: JSON.stringify(kq.dsSoCho) };
  },
  '06-tao-ban-nhap': async ({ page, input, ghi, can }) => ({
    idBanNhap: await taoBanNhap(page, ghi, can('idDay'), `${input.tenSoChinh} ${new Date().toISOString().slice(0, 16)}`),
  }),
  '07-go-gan-lai': async ({ page, ghi, can }) => ({ goGanLai: await goGanLai(page, ghi, can('idDay'), can('idBanNhap')) }),
  '08-cap-khi-cho-duyet': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    return capKhiChoDuyet(page, ghi, input.soCho.maToa, can('maBieuMau'), can('maSoCho'));
  },
  '09-kiem-tra-truoc-ap-dung': async ({ page, ghi, can }) => ({
    kiemTra: await kiemTraTruocApDung(page, ghi, can('idBanNhap'), can('idDay')),
  }),
  '10-ap-dung': async ({ page, ghi, can }) => ({ maSoChinh: await apDung(page, ghi, can('idBanNhap')) }),
  '11-sau-ap-dung': async ({ page, input, ghi, can, duLieu }) => {
    const ds = JSON.parse(can('dsSoCho')) as { id: string; so: string; soThuTu?: number }[];
    // VAN_BAN: số bước 08 cấp lúc bản nháp chờ duyệt cũng phải được chuyển (TC11 / QC ca 13)
    if (duLieu.idCapSo3 && !ds.some(x => x.id === duLieu.idCapSo3)) ds.push({ id: duLieu.idCapSo3, so: duLieu.so3 });
    const vanBan = input.cheDo === 'VAN_BAN';
    return {
      sauApDung: await sauApDung(page, ghi, input.soCho.maToa, vanBan ? { loaiSo: 'VAN_BAN', giaTri: {} } : input.dayCanTim,
        can('maSoChinh'), ds, vanBan ? duLieu.maBieuMau : undefined),
    };
  },
  '12-day-vo-hieu': async ({ page, ghi, can }) => ({ dayVoHieu: await kiemDayVoHieu(page, ghi, can('idDay')) }),
  '13-quyen-tinh': async ({ page, ghi }) => ({ quyenTinh: await quyenTinh(page, ghi) }),
  '14-chon-moi-toa': async ({ page, ghi }) => ({ chonMoiToa: await chonMoiToa(page, ghi) }),
  '15-tab-so-cho-ui': async ({ page, ghi }) => ({ nhanTab: await tabSoChoUi(page, ghi) }),
  '16-xoa-nhap-canh-bao': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    const b = await timDayChoTandtc(page, ghi, input.soCho.maToa, { loaiSo: 'VAN_BAN', giaTri: { BIEU_MAU: [can('maBieuMau2')] } });
    return {
      idDayB: b.idDay,
      xoaNhapCanhBao: await xoaNhapCanhBao(page, ghi, b.idDay, can('maBieuMau'), `${input.tenSoChinh} (nháp xoá) ${new Date().toISOString().slice(0, 16)}`),
    };
  },
  '17-dua-vao-so-da-co': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    return duaVaoSoDaCo(page, ghi, can('maSoChinh'), can('idDayB'), can('maBieuMau2'), HAU_TO_MOI);
  },
  '18-ap-dung-ban-sua': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    return { maSoSauSua: await apDung(page, ghi, can('idBanSua')) };
  },
  '19-sau-ban-sua': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    return {
      sauBanSua: await sauBanSua(page, ghi, input.soCho.maToa, can('maSoSauSua'), can('idDayB'),
        { id: can('idCapSoB'), so: can('soB') }, can('ketQuaHauTo') === 'OK' ? HAU_TO_MOI : null),
    };
  },
  '21-sua-hau-to': async ({ page, input, ghi, can }) => {
    chiVanBan(input);
    const kq = can('ketQuaHauTo');
    ghi('ca 17', kq);
    if (kq !== 'OK') throw new Error(`Ca 17 KHÔNG ĐẠT (lỗi hệ thống): gắn dãy vào bản nháp kèm hauToMoi "${HAU_TO_MOI}" — ${kq}`);
    return { suaHauTo: await chuoiCuTrongLichSu(page, ghi, input.soCho.maToa, { id: can('idCapSoB'), so: can('soB') }) };
  },
  '22-thong-bao-tandtc': async ({ page, input, ghi }) => {
    chiVanBan(input);
    return { thongBaoTandtc: await thongBaoTandtc(page, ghi, input.soCho.maToa, new Date().toISOString().slice(0, 10)) };
  },
  '23-thong-bao-tinh': async ({ page, ghi }) => ({ thongBaoTinh: await thongBaoTinh(page, ghi, new Date().toISOString().slice(0, 10)) }),
  '24-sc16-quan-sat': async ({ page, ghi }) => ({ sc16: await quanSatSc16(page, ghi) }),
  '20-lich-su-so': async ({ page, input, ghi, can }) => ({
    lichSuSo: await lichSuChuyen(page, ghi, input.soCho.maToa, JSON.parse(can('dsSoCho'))[0]),
  }),
};
