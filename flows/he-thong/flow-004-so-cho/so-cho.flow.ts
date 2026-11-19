/**
 * FLOW HỆ THỐNG 004 · thân các bước Sổ chờ (QLN-13300). Phạm vi và nguồn: xem đầu `flow.ts`.
 * Gọi API bằng header app tự gửi (moApiSoCapSo của flow-003) — không tự dựng header, không in header.
 */
import { Page, test } from '@playwright/test';
import { choHetSpin } from '../../../common/antd';
import { veTrangChu } from '../../../common/vai';
import { moApiSoCapSo, type ApiSoCapSo } from '../flow-003-golden-cap-so/golden.flow';
import { ROUTE_DANH_MUC, phaiLaDev } from '../flow-002-so-cap-so-v2-smoke/so-cap-so-v2.flow';

type GhiChu = (nhan: string, mo: string) => void;

/**
 * Sổ chờ trong danh sách sổ của tòa. Từ qla 4bc6e7b0f3 (13/11/2026) chỉ còn MỘT mẫu `SO_CHO` nhận mọi loại số;
 * môi trường chưa gộp vẫn có 3 mẫu `SO_CHO_THU_LY|TIEP_NHAN|VAN_BAN` thì lọc theo loại số.
 */
const laSoCho = (s: { maSo: string; loaiSo: string }, loaiSo: string) =>
  s.maSo === 'SO_CHO' || (/^SO_CHO_/.test(s.maSo) && s.loaiSo === loaiSo);

const loi = (e: unknown) => (e instanceof Error ? e.message : String(e));
const maLoi = (e: unknown) => /"code":"([A-Z_0-9]+)"/.exec(loi(e))?.[1] ?? '(không rõ mã)';
const homNay = () => new Date().toISOString().slice(0, 10);

// ═══════════════════════ Kiểu dữ liệu — qla develop 04c604fa42 ═══════════════════════

/** SoChoDtos.java:22-27 */
export interface DayChoVO {
  idDay: string;
  loaiSo: string;
  maToa: string;
  ky: number;
  khoaTachDay: string;
  giaTriTach: Record<string, string[]>;
  soLuong: number;
  soNhoNhat?: number;
  soLonNhat?: number;
  ngayDau?: string;
  ngayCuoi?: string;
  trangThai: 'CHO' | 'DA_GAN' | 'DA_VO_HIEU';
  idPhienBanNhan?: string;
  tenSoNhan?: string;
  /** SC-17: nguồn hệ thống ngoài (qla 460f5aa9b4) */
  nguon?: string | null;
}
interface DanhSachDayChoVO {
  dsDay: DayChoVO[];
  soDayCho: number;
  soDayDaGan: number;
}
interface GoiYSoVO {
  loaiSo: string;
  dieuKien: Record<string, string[]>;
  dsCapToa: string[];
  danhSoRiengTheo: string[];
  ngayDauTien?: string;
  soLuong: number;
}
interface LoiChuyenVO {
  idDay?: string;
  maToa?: string;
  so?: string;
  noiDung: string;
}
interface KiemTraChuyenVO {
  chuyenDuoc: boolean;
  soLuong: number;
  dsLoi: LoiChuyenVO[];
  dsCanhBao?: LoiChuyenVO[];
}
interface MauSoVO {
  id: string;
  maSo: string;
  phienBan: number;
  trangThai: string;
  nguoiLap?: string;
  noiDung: { tenSo: string; ngayApDungTu?: string; dieuKien: Record<string, string[]> };
}
/** CapSoController.java:171-178 · vo/GiuSoCapSoVO.java */
interface GiuSoVO {
  idCapSo?: string;
  so?: string;
  soThuTu?: number;
  nam?: number;
}
/** SoCapSoDonViDtos.java:44-50 */
interface SoDaCapVO {
  id: string;
  so: string;
  soThuTu?: number;
  maSo: string;
  tenSo?: string;
  maBieuMau?: string;
  daHuy: boolean;
  laSoCho: boolean;
}
interface SoDonViVO {
  maSo: string;
  tenSo: string;
  loaiSo: string;
  daCap: number;
}
interface ThuCapSoVO {
  ketQua: string;
  thongBao?: string;
  maSo?: string;
  tenSo?: string;
}
interface ToHopVO {
  loaiSo: string;
  maToa?: string;
  giaTri: Record<string, string>;
  ketQua: string;
}
/** HoTroSoCapSoController nhat-ky-sua-xoa-so · NhatKySoVO */
interface NhatKySoVO {
  phanLoai: string;
  soTruoc?: string;
  soSau?: string;
  lyDo?: string;
  idCapSo?: string;
}
interface ChuaNoiVO {
  loai: string;
  ma: string;
  ten: string;
  lyDo: string;
}

// ═══════════════════════ Hàm dùng chung ═══════════════════════

/** Giữ số (điểm CHUNG.GIU_SO_TRUOC) cho tòa của tài khoản đang đăng nhập. */
async function giuSo(api: ApiSoCapSo, maBieuMau: string): Promise<Required<Pick<GiuSoVO, 'idCapSo' | 'so'>> & GiuSoVO> {
  const r = await api.post<GiuSoVO>(`cap-so/giu-so?${new URLSearchParams({ maBieuMau, ngayQuyetDinh: homNay() })}`, undefined);
  if (!r?.idCapSo || !r.so) throw new Error(`giu-so ${maBieuMau} không trả idCapSo/số: ${JSON.stringify(r)}`);
  return r as Required<Pick<GiuSoVO, 'idCapSo' | 'so'>> & GiuSoVO;
}

/** "Số đã cấp" trả `{data: [...]}` (đo dev 12/11/2026), không phải `content` của Spring Page. */
type TrangSoDaCap = { data?: SoDaCapVO[]; content?: SoDaCapVO[] };
const dongTrang = (t: TrangSoDaCap | null | undefined) => t?.data ?? t?.content ?? [];

/** Đọc lại đúng các dòng số vừa cấp ở tab "Số đã cấp" của tòa (lọc theo sổ, năm). */
async function docSoDaCap(api: ApiSoCapSo, maToa: string, maSo: string, dsId: string[]): Promise<Map<string, SoDaCapVO>> {
  const q = new URLSearchParams({ maSo, nam: String(new Date().getFullYear()), page: '1', size: '200' });
  const ds = dongTrang(await api.get<TrangSoDaCap>(`so-cap-so-don-vi/${encodeURIComponent(maToa)}/so-da-cap?${q}`));
  return new Map(ds.filter(d => dsId.includes(d.id)).map(d => [d.id, d]));
}

async function danhSachDay(api: ApiSoCapSo, q: Record<string, string>): Promise<DanhSachDayChoVO> {
  return api.get<DanhSachDayChoVO>(`dm-so-cap-so/so-cho?${new URLSearchParams(q)}`);
}

async function timDay(api: ApiSoCapSo, idDay: string): Promise<DayChoVO> {
  const ds = await danhSachDay(api, {});
  const d = ds.dsDay.find(x => x.idDay === idDay);
  if (!d) {
    throw new Error(
      `Không thấy dãy ${idDay} trong danh sách Sổ chờ (${ds.dsDay.length} dãy: ` +
        ds.dsDay.slice(0, 10).map(x => `${x.maToa}/${x.trangThai}/${x.idDay.slice(0, 8)}`).join(', ') + ')',
    );
  }
  return d;
}

const dsLoiChuyen = (kq: KiemTraChuyenVO) => kq.dsLoi.map(l => `${l.maToa ?? ''} ${l.so ?? ''}: ${l.noiDung}`).join('; ');

// ═══════════════════════ 01 · bản triển khai ═══════════════════════

/**
 * Bản dev có QLN-13300 chưa: API `so-cho/cung-truong-hop` (SC-31, commit 5a6a5e1c82) chỉ có ở bản mới — bản cũ trả
 * 404. Gọi với idDay giả: bản mới trả lỗi nghiệp vụ (không phải 404). Danh sách Sổ chờ đọc được = API có, quyền đủ.
 */
export async function kiemTrienKhai(page: Page, ghi: GhiChu): Promise<string> {
  phaiLaDev();
  const api = await moApiSoCapSo(page);
  const ds = await danhSachDay(api, {});
  ghi('Sổ chờ', `${ds.dsDay.length} dãy · Chờ xử lý ${ds.soDayCho} · Đã gắn ${ds.soDayDaGan}`);
  const dem = new Map<string, number>();
  for (const d of ds.dsDay) dem.set(`${d.loaiSo}/${d.trangThai}`, (dem.get(`${d.loaiSo}/${d.trangThai}`) ?? 0) + 1);
  ghi('theo loại', [...dem].map(([k, v]) => `${k} ${v}`).join(' · '));
  // Dấu hiệu bản deploy (qla develop 13/11/2026): DayChoVO có trường `nguon` (SC-17, 460f5aa9b4)
  ghi('bản deploy', ds.dsDay.length ? ('nguon' in ds.dsDay[0] ? 'có trường nguon (≥ 460f5aa9b4)' : 'CHƯA có trường nguon (< 460f5aa9b4)') : '(không có dãy để nhận biết)');
  try {
    await api.get(`dm-so-cap-so/so-cho/cung-truong-hop?idDay=00000000-kiem-tra-trien-khai`);
  } catch (e) {
    if (/ trả 404/.test(loi(e))) {
      throw new Error(`Dev CHƯA deploy bản có QLN-13300: GET so-cho/cung-truong-hop trả 404 — ${loi(e)}`);
    }
    ghi('cung-truong-hop', `có API (idDay giả → ${maLoi(e)})`);
  }
  return `${ds.dsDay.length} dãy (${ds.soDayCho} chờ, ${ds.soDayDaGan} đã gắn)`;
}

// ═══════════════════════ 02 · biểu mẫu chưa có sổ tại KV5 ═══════════════════════

export interface CauHinhSoCho {
  maToa: string;
  /** biểu mẫu ưu tiên thử trước (bỏ trống = lấy từ Kiểm tra cấu hình) */
  dsBieuMauUuTien: string[];
  /** tối đa số biểu mẫu thử ở Thử cấp số */
  toiDaThu: number;
}

/**
 * Ứng viên: biểu mẫu ưu tiên + biểu mẫu "chưa thuộc sổ nào" và tổ hợp CHUA_CO_SO có BIEU_MAU của Kiểm tra cấu hình
 * (KiemTraCauHinhDtos.java:59-65). Xác nhận bằng Thử cấp số tại đúng KV5, điểm Giữ số trước: ketQua CHUA_CO_SO.
 */
export async function timBieuMauThieuSo(page: Page, ghi: GhiChu, ch: CauHinhSoCho): Promise<[string, string]> {
  const api = await moApiSoCapSo(page);
  const kt = await api.get<{ chuaCoSo: ToHopVO[]; chuaNoi: ChuaNoiVO[] }>(
    `dm-so-cap-so/kiem-tra-cau-hinh?${new URLSearchParams({ loaiSo: 'VAN_BAN' })}`,
  );
  const tuToHop = kt.chuaCoSo.filter(t => t.loaiSo === 'VAN_BAN' && t.giaTri?.BIEU_MAU).map(t => t.giaTri.BIEU_MAU);
  const tuChuaNoi = kt.chuaNoi.filter(c => /bi[eể]u m[aẫ]u/i.test(c.loai) && /s[oổ]/i.test(c.lyDo)).map(c => c.ma);
  /**
   * Bỏ mã toàn chữ số (vd. "00001", "001"): mã không có trong enum MaBieuMau bị BE quy im lặng về BM000 "000"
   * (MaBieuMau.java:2790-2818 forCode … orElse(BM000)) → mọi biểu mẫu lạ dồn vào một dãy "000" (đo dev 12/11/2026).
   */
  const daCoDay = new Set(
    (await danhSachDay(api, { maToa: ch.maToa, loaiSo: 'VAN_BAN' })).dsDay.flatMap(d => d.giaTriTach?.BIEU_MAU ?? []),
  );
  // Biểu mẫu đã có dãy chờ ở tòa là dãy của người khác (QC đang test trên dev) — không dùng, kẻo bước 06 lấy mất dãy đó.
  const ungVien = [...new Set([...ch.dsBieuMauUuTien, ...tuToHop, ...tuChuaNoi])]
    .filter(m => /[A-Za-z]/.test(m) && !daCoDay.has(m));
  if (daCoDay.size) ghi('bỏ qua', `${daCoDay.size} biểu mẫu đã có dãy chờ ở ${ch.maToa}`);
  ghi('ứng viên', `${ungVien.length} (ưu tiên ${ch.dsBieuMauUuTien.length}, tổ hợp chưa có sổ ${tuToHop.length}, chưa nối ${tuChuaNoi.length})`);
  const daThu: string[] = [];
  // Lấy HAI biểu mẫu: ca 3 kịch bản QC — hai biểu mẫu khác nhau không ra cùng chuỗi; dãy thứ hai dùng cho ca 9, 12, 16, 17.
  const chon: string[] = [];
  for (const maBieuMau of ungVien.slice(0, ch.toiDaThu)) {
    const r = await api.post<ThuCapSoVO>('dm-so-cap-so/thu-cap-so', {
      maToa: ch.maToa,
      loaiSo: 'VAN_BAN',
      maDiem: 'CHUNG.GIU_SO_TRUOC',
      maBieuMau,
      giaTri: {},
    });
    daThu.push(`${maBieuMau}=${r.ketQua}${r.maSo ? `→${r.maSo}` : ''}`);
    if (r.ketQua === 'CHUA_CO_SO') {
      ghi('chọn', `${maBieuMau} · Thử cấp số tại ${ch.maToa}: CHUA_CO_SO (${r.thongBao ?? ''})`);
      chon.push(maBieuMau);
      if (chon.length === 2) return [chon[0], chon[1]];
    }
  }
  throw new Error(`Cần 2 biểu mẫu CHUA_CO_SO tại ${ch.maToa}, có ${chon.length}. Đã thử: ${daThu.join(', ') || '(không có ứng viên)'}`);
}

// ═══════════════════════ 03 · TC1: KV5 lấy số → Sổ chờ ═══════════════════════

/**
 * Giữ số thật cho biểu mẫu chưa có sổ. SC-01/SC-10: KHÔNG bị chặn, trả số như thường. Sau đó đọc danh sách sổ của
 * tòa (SC-60: Sổ chờ hiện khi có số) và dòng số ở "Số đã cấp" (SC-61: laSoCho = true). KHÔNG trả số: số phải còn
 * trong dãy để bước 06–11 chuyển sang sổ chính.
 */
export async function capVaoSoCho(
  page: Page,
  ghi: GhiChu,
  maToa: string,
  maBieuMau: string,
  maBieuMau2: string,
): Promise<{ idCapSo1: string; so1: string; maSoCho: string; idCapSoB: string; soB: string }> {
  const api = await moApiSoCapSo(page, 'DON_VI');
  let r: Awaited<ReturnType<typeof giuSo>>;
  try {
    r = await giuSo(api, maBieuMau);
  } catch (e) {
    throw new Error(`TC1 KHÔNG ĐẠT: biểu mẫu chưa có sổ ${maBieuMau} bị chặn khi lấy số (${maLoi(e)}) — Sổ chờ chưa bật? ${loi(e)}`);
  }
  ghi('giữ số', `${r.so} · số thứ tự ${r.soThuTu} · năm ${r.nam} · idCapSo ${r.idCapSo}`);
  const dsSo = await api.get<{ dsSo: SoDonViVO[] }>(`so-cap-so-don-vi/${encodeURIComponent(maToa)}/so`);
  const soCho = dsSo.dsSo.filter(s => laSoCho(s, 'VAN_BAN'));
  ghi('sổ của tòa', dsSo.dsSo.map(s => `${s.tenSo} (${s.loaiSo}, ${s.daCap})`).join(' · '));
  if (!soCho.length) throw new Error(`SC-60: danh sách sổ của ${maToa} không có "Sổ chờ – số văn bản" sau khi cấp số`);
  const dong = (await docSoDaCap(api, maToa, soCho[0].maSo, [r.idCapSo])).get(r.idCapSo);
  if (!dong) throw new Error(`Số ${r.so} (${r.idCapSo}) không nằm ở ${soCho[0].tenSo} (${soCho[0].maSo}) — số vào sổ khác?`);
  ghi('số đã cấp', `${dong.so} · sổ ${dong.tenSo} · laSoCho=${dong.laSoCho} · biểu mẫu ${dong.maBieuMau}`);
  if (!dong.laSoCho) throw new Error(`SC-61: dòng số ${dong.so} ở Sổ chờ nhưng laSoCho=false (thiếu nhãn Sổ chờ)`);
  if (dong.maBieuMau !== maBieuMau) {
    await api.post(`cap-so/${r.idCapSo}/huy-so-giu`, undefined);
    throw new Error(`BE ghi biểu mẫu "${dong.maBieuMau}" thay vì "${maBieuMau}" (mã không có trong enum MaBieuMau?) — đã trả số, chọn biểu mẫu khác`);
  }
  // Ca 3: biểu mẫu thứ hai → dãy riêng, chuỗi khác (SC-07: chưa khai ký hiệu thì dùng mã biểu mẫu làm ký hiệu)
  const b = await giuSo(api, maBieuMau2);
  const dongB = (await docSoDaCap(api, maToa, soCho[0].maSo, [b.idCapSo])).get(b.idCapSo);
  if (!dongB) throw new Error(`Số ${b.so} của ${maBieuMau2} không nằm ở ${soCho[0].tenSo}`);
  if (dongB.maBieuMau !== maBieuMau2) {
    await api.post(`cap-so/${b.idCapSo}/huy-so-giu`, undefined);
    await api.post(`cap-so/${r.idCapSo}/huy-so-giu`, undefined);
    throw new Error(`BE ghi biểu mẫu "${dongB.maBieuMau}" thay vì "${maBieuMau2}" — đã trả cả hai số, chọn biểu mẫu khác`);
  }
  const kyHieu = (x: string) => x.split('/').slice(2).join('/');
  ghi('ca 3', `${maBieuMau} → "${dong.so}" (ký hiệu "${kyHieu(dong.so)}") · ${maBieuMau2} → "${dongB.so}" (ký hiệu "${kyHieu(dongB.so)}")`);
  if (dongB.so === dong.so) throw new Error(`Ca 3 KHÔNG ĐẠT: hai biểu mẫu ${maBieuMau}, ${maBieuMau2} ra cùng chuỗi "${dong.so}"`);
  if (!kyHieu(dong.so) || !kyHieu(dongB.so)) ghi('lưu ý ca 3', 'số không có phần ký hiệu sau năm — không đúng định dạng {SO:2}/{NAM}/{KY_HIEU}');
  return { idCapSo1: r.idCapSo, so1: dong.so, maSoCho: soCho[0].maSo, idCapSoB: b.idCapSo, soB: dongB.so };
}

// ═══════════════════════ 04 · TC12: hủy trong ngày → cấp lại ═══════════════════════

export async function huyCapLai(page: Page, ghi: GhiChu, maBieuMau: string, so1: string): Promise<{ idCapSo2: string; so2: string }> {
  const api = await moApiSoCapSo(page, 'DON_VI');
  const a = await giuSo(api, maBieuMau);
  ghi('giữ số 2', `${a.so} · số thứ tự ${a.soThuTu} (${a.idCapSo})`);
  if (a.so === so1) throw new Error(`Số thứ hai trùng số đầu "${so1}"`);
  await api.post(`cap-so/${a.idCapSo}/huy-so-giu`, undefined);
  ghi('trả số 2', `huy-so-giu ${a.idCapSo} → OK`);
  const b = await giuSo(api, maBieuMau);
  ghi('lấy lại', `${b.so} · số thứ tự ${b.soThuTu} (${b.idCapSo})`);
  if (b.soThuTu !== a.soThuTu) {
    throw new Error(`TC12 KHÔNG ĐẠT: trả số thứ tự ${a.soThuTu} rồi lấy lại trong ngày được ${b.soThuTu} ("${b.so}"), không phải số vừa trả`);
  }
  return { idCapSo2: b.idCapSo, so2: b.so };
}

// ═══════════════════════ 05 · TC1: TAND tối cao thấy dãy ═══════════════════════

/** Dãy chờ cần tìm: loại sổ + giá trị tách dãy phải chứa (vd. {THU_TUC: ['THA_THU_LY_BI_AN']}). */
export interface DayCanTim {
  loaiSo: 'THU_LY' | 'TIEP_NHAN' | 'VAN_BAN';
  giaTri: Record<string, string[]>;
}

/** Một số trong dãy chờ, bàn giao sang bước 11 (JSON trong state). */
export interface SoTrongDay {
  id: string;
  so: string;
  soThuTu?: number;
}

const khopGiaTri = (d: DayChoVO, gt: Record<string, string[]>) =>
  Object.entries(gt).every(([k, v]) => v.every(x => (d.giaTriTach?.[k] ?? []).includes(x)));

/**
 * TAND tối cao tìm đúng một dãy chờ Chờ xử lý của tòa, rồi đọc các số của dãy ở "Số đã cấp" của tòa (Sổ chờ cùng
 * loại, laSoCho = true) — đối chiếu số lượng với dãy, bàn giao id + chuỗi để bước 11 kiểm sau khi chuyển.
 */
export async function timDayChoTandtc(
  page: Page,
  ghi: GhiChu,
  maToa: string,
  can: DayCanTim,
): Promise<{ idDay: string; dsSoCho: SoTrongDay[] }> {
  const api = await moApiSoCapSo(page);
  const ds = await danhSachDay(api, { maToa, loaiSo: can.loaiSo });
  ghi('dãy của tòa', ds.dsDay.map(d => `${d.trangThai} ${JSON.stringify(d.giaTriTach)} ×${d.soLuong}`).join(' · ') || '(không có)');
  const cua = ds.dsDay.filter(d => d.trangThai !== 'DA_VO_HIEU' && khopGiaTri(d, can.giaTri));
  if (cua.length !== 1) {
    throw new Error(`Cần đúng 1 dãy chờ ${can.loaiSo} còn hiệu lực của ${maToa} khớp ${JSON.stringify(can.giaTri)}, thấy ${cua.length}`);
  }
  const d = cua[0];
  ghi('dãy', `${d.idDay} · ${d.trangThai} · ${d.soLuong} số (${d.soNhoNhat}–${d.soLonNhat}) · cấp đầu ${d.ngayDau} · kỳ ${d.ky}`);
  if (d.trangThai !== 'CHO') throw new Error(`Dãy ${d.idDay} đang ${d.trangThai} (đã gắn ${d.tenSoNhan ?? d.idPhienBanNhan}) — dọn bản nháp cũ rồi chạy lại`);

  const apiDv = await moApiSoCapSo(page, 'DON_VI');
  const dsSo = await apiDv.get<{ dsSo: SoDonViVO[] }>(`so-cap-so-don-vi/${encodeURIComponent(maToa)}/so`);
  const soCho = dsSo.dsSo.filter(s => laSoCho(s, can.loaiSo));
  ghi('Sổ chờ của tòa', soCho.map(s => `${s.tenSo} (${s.maSo}, đã cấp ${s.daCap})`).join(' · ') || '(không thấy — SC-60)');
  if (soCho.length !== 1) throw new Error(`SC-60: cần đúng 1 Sổ chờ ${can.loaiSo} trong danh sách sổ của ${maToa}, thấy ${soCho.length}`);
  const q = new URLSearchParams({ maSo: soCho[0].maSo, nam: String(d.ky ?? new Date().getFullYear()), page: '1', size: '200' });
  // Sổ chờ văn bản chứa nhiều dãy (mỗi biểu mẫu một dãy) → chỉ lấy số của biểu mẫu thuộc dãy này.
  const bmCuaDay = can.giaTri.BIEU_MAU;
  const dsSoCho = dongTrang(await apiDv.get<TrangSoDaCap>(`so-cap-so-don-vi/${encodeURIComponent(maToa)}/so-da-cap?${q}`))
    .filter(s => !s.daHuy && (!bmCuaDay?.length || bmCuaDay.includes(s.maBieuMau ?? '')))
    .map(s => ({ id: s.id, so: s.so, soThuTu: s.soThuTu, laSoCho: s.laSoCho }));
  ghi('số trong Sổ chờ', dsSoCho.map(s => `${s.so} (stt ${s.soThuTu}, laSoCho=${s.laSoCho})`).join(' · '));
  if (dsSoCho.some(s => !s.laSoCho)) throw new Error('SC-61: có số trong Sổ chờ mang laSoCho=false (thiếu nhãn Sổ chờ)');
  if (dsSoCho.length !== d.soLuong) {
    // Sổ chờ thụ lý của tòa có thể có nhiều dãy; chỉ chặn khi rõ ràng không đọc được số của dãy.
    ghi('lưu ý', `Sổ chờ có ${dsSoCho.length} số còn hiệu lực, dãy báo ${d.soLuong} — Sổ chờ có thể chứa nhiều dãy`);
  }
  if (!dsSoCho.length) {
    // Chẩn đoán: bỏ lọc sổ, xem số Sổ chờ của tòa đang mang mã sổ nào (SoCapSoDonViService.soDaCap lọc p.MA_SO).
    const q2 = new URLSearchParams({ nam: String(d.ky ?? new Date().getFullYear()), page: '1', size: '200' });
    const tatCa = dongTrang(await apiDv.get<TrangSoDaCap>(`so-cap-so-don-vi/${encodeURIComponent(maToa)}/so-da-cap?${q2}`));
    const cho = tatCa.filter(s => s.laSoCho);
    ghi('chẩn đoán', `không lọc sổ: ${tatCa.length} số, Sổ chờ ${cho.length}: ` +
      cho.map(s => `${s.so} (sổ ${s.maSo}/${s.tenSo}, stt ${s.soThuTu})`).join(' · '));
    throw new Error(
      `SC-61: danh sách sổ báo ${soCho[0].tenSo} (${soCho[0].maSo}) đã cấp ${soCho[0].daCap}, nhưng "Số đã cấp" lọc maSo=` +
        `${soCho[0].maSo} trả 0 dòng (không lọc sổ: ${cho.length} số Sổ chờ${cho.length ? `, mã sổ ${[...new Set(cho.map(s => s.maSo))]}` : ''})`,
    );
  }
  return { idDay: d.idDay, dsSoCho: dsSoCho.map(({ id, so, soThuTu }) => ({ id, so, soThuTu })) };
}

// ═══════════════════════ 06 · TC6: tạo bản nháp từ dãy ═══════════════════════

/**
 * Như nút "Tạo sổ" của tab Sổ chờ (qla-webapp pages/DanhMucSoCapSo/SoCho.tsx:204, soChoGoiY.ts goiYSangForm +
 * mauSo.ts macDinhSoMoi/formSangDto). Khác FE ở MỘT chỗ có chủ đích: ngày áp dụng = ngayDauTien của gợi ý (SC-29),
 * vì FE để mặc định "từ ngày mai" thì sổ không bao trọn ngày cấp số hôm nay và SC-47 chặn chuyển.
 */
export async function taoBanNhap(page: Page, ghi: GhiChu, idDay: string, tenSo: string): Promise<string> {
  const api = await moApiSoCapSo(page);
  const g = await api.get<GoiYSoVO>(`dm-so-cap-so/so-cho/goi-y?${new URLSearchParams({ dsIdDay: idDay })}`);
  ghi('gợi ý', `loại ${g.loaiSo} · điều kiện ${JSON.stringify(g.dieuKien)} · cấp tòa ${g.dsCapToa} · tách ${g.danhSoRiengTheo} · ngày đầu ${g.ngayDauTien} · ${g.soLuong} số`);
  if (!Object.keys(g.dieuKien ?? {}).length) throw new Error(`SC-24: gợi ý không có điều kiện nào: ${JSON.stringify(g.dieuKien)}`);
  const vanBan = g.loaiSo === 'VAN_BAN';
  if (!g.ngayDauTien) throw new Error('SC-29: gợi ý không có ngayDauTien');
  // mặc định theo loại sổ như FE (mauSo.ts:287-306 macDinhSoMoi, kyHieuMacDinh)
  const danhSoRiengTheo = [...new Set([...(vanBan ? ['BIEU_MAU'] : []), ...g.danhSoRiengTheo])];
  const dto = {
    tenSo,
    loaiSo: g.loaiSo,
    moTa: 'Playwright flow-004-so-cho (QLN-13300) — tạo từ dãy Sổ chờ',
    dsCapToa: g.dsCapToa,
    dsDonViApDung: [],
    ngayApDungTu: g.ngayDauTien,
    dieuKien: g.dieuKien,
    kyCapSo: 'NAM',
    soBatDau: 1,
    ghiNamTrongSo: true,
    danhSoRiengTheo,
    chinhSachTaiDung: 'TRONG_NGAY',
    thoiDiemCapSo: vanBan ? 'KHI_LAY_SO' : 'KHI_LUU',
    thoiDiemCapSoDuPhong: vanBan ? 'KHI_KY' : undefined,
    dinhDangSo: g.loaiSo === 'THU_LY' ? '{SO:2}/{NAM}/{THU_TUC}-{LINH_VUC}' : '{SO:2}/{NAM}/{KY_HIEU}',
    choDatMoc: true,
    choNhapTay: 'THEO_CONG_TAC_QTUD',
    keThuaDaySo: false,
    uuTien: 0,
    dsMaSoThayThe: [],
    dsGhiDe: [],
  };
  const so = await api.post<MauSoVO>('dm-so-cap-so', dto);
  ghi('bản nháp', `${so.maSo} v${so.phienBan} · ${so.trangThai} · id ${so.id} · người lập ${so.nguoiLap}`);
  const kq = await api.post<KiemTraChuyenVO>('dm-so-cap-so/so-cho/gan', { idPhienBan: so.id, dsIdDay: [idDay] });
  ghi('gắn dãy', `chuyenDuoc=${kq.chuyenDuoc} · ${kq.soLuong} số${kq.dsLoi.length ? ` · lỗi: ${dsLoiChuyen(kq)}` : ''}`);
  const d = await timDay(api, idDay);
  if (d.trangThai !== 'DA_GAN' || d.idPhienBanNhan !== so.id) {
    throw new Error(`Sau gắn, dãy ${idDay} là ${d.trangThai} / ${d.idPhienBanNhan}, mong đợi DA_GAN / ${so.id}`);
  }
  return so.id;
}

// ═══════════════════════ 07 · TC10: gỡ rồi gắn lại ═══════════════════════

export async function goGanLai(page: Page, ghi: GhiChu, idDay: string, idBanNhap: string): Promise<string> {
  const api = await moApiSoCapSo(page);
  await api.post('dm-so-cap-so/so-cho/go', { dsIdDay: [idDay] });
  const sauGo = await timDay(api, idDay);
  ghi('sau gỡ', `${sauGo.trangThai} · bản nhận ${sauGo.idPhienBanNhan ?? '(không)'}`);
  if (sauGo.trangThai !== 'CHO') throw new Error(`TC10 KHÔNG ĐẠT: gỡ xong dãy là ${sauGo.trangThai}, mong đợi CHO`);
  await api.post('dm-so-cap-so/so-cho/gan', { idPhienBan: idBanNhap, dsIdDay: [idDay] });
  const sauGan = await timDay(api, idDay);
  ghi('gắn lại', `${sauGan.trangThai} · ${sauGan.tenSoNhan ?? sauGan.idPhienBanNhan}`);
  if (sauGan.trangThai !== 'DA_GAN') throw new Error(`Gắn lại xong dãy là ${sauGan.trangThai}, mong đợi DA_GAN`);
  return `gỡ → CHO, gắn lại → DA_GAN (${sauGan.tenSoNhan ?? idBanNhap})`;
}

// ═══════════════════════ 08 · TC11: chờ duyệt vẫn nhận số ═══════════════════════

export async function capKhiChoDuyet(
  page: Page,
  ghi: GhiChu,
  maToa: string,
  maBieuMau: string,
  maSoCho: string,
): Promise<{ idCapSo3: string; so3: string }> {
  const api = await moApiSoCapSo(page, 'DON_VI');
  const r = await giuSo(api, maBieuMau);
  ghi('giữ số 3', `${r.so} · số thứ tự ${r.soThuTu} (${r.idCapSo})`);
  const dong = (await docSoDaCap(api, maToa, maSoCho, [r.idCapSo])).get(r.idCapSo);
  if (!dong) throw new Error(`TC11 KHÔNG ĐẠT: số ${r.so} không vào Sổ chờ ${maSoCho} khi bản nháp chưa duyệt`);
  ghi('số đã cấp', `${dong.so} · ${dong.tenSo} · laSoCho=${dong.laSoCho}`);
  return { idCapSo3: r.idCapSo, so3: dong.so };
}

// ═══════════════════════ 09 · SC-40: kiểm tra trước áp dụng ═══════════════════════

export async function kiemTraTruocApDung(page: Page, ghi: GhiChu, idBanNhap: string, idDay: string): Promise<string> {
  const api = await moApiSoCapSo(page);
  const d = await timDay(api, idDay);
  const kq = await api.get<KiemTraChuyenVO>(`dm-so-cap-so/so-cho/kiem-tra/${encodeURIComponent(idBanNhap)}`);
  ghi('kiểm tra', `chuyenDuoc=${kq.chuyenDuoc} · ${kq.soLuong} số · dãy có ${d.soLuong} số · cảnh báo ${kq.dsCanhBao?.length ?? 0}`);
  if (!kq.chuyenDuoc) throw new Error(`SC-40: bản nháp không chuyển được — ${dsLoiChuyen(kq)}`);
  if (kq.soLuong !== d.soLuong) throw new Error(`SC-40: kiểm tra báo ${kq.soLuong} số chuyển, dãy có ${d.soLuong}`);
  return `chuyển được ${kq.soLuong} số`;
}

// ═══════════════════════ 10 · TC6: áp dụng ═══════════════════════

export async function apDung(page: Page, ghi: GhiChu, idBanNhap: string): Promise<string> {
  const api = await moApiSoCapSo(page);
  let so: MauSoVO;
  try {
    so = await api.post<MauSoVO>(`dm-so-cap-so/${encodeURIComponent(idBanNhap)}/ap-dung`, undefined);
  } catch (e) {
    if (maLoi(e) === 'NGUOI_LAP_KHONG_TU_AP_DUNG') {
      throw new Error(`Vai duyetTandtc đang là CHÍNH người lập bản nháp — cần tài khoản TANDTC khác (${loi(e)})`);
    }
    throw e;
  }
  ghi('áp dụng', `${so.maSo} v${so.phienBan} · ${so.trangThai} · từ ${so.noiDung.ngayApDungTu}`);
  if (so.trangThai !== 'HIEU_LUC') throw new Error(`Áp dụng xong sổ ${so.maSo} ở trạng thái ${so.trangThai}, mong đợi HIEU_LUC`);
  return so.maSo;
}

// ═══════════════════════ 11 · TC6: sau áp dụng ═══════════════════════

/**
 * Vai TAND tối cao (xem được tòa cấp dưới). SC-42: mọi số của dãy nằm ở sổ chính, chuỗi giữ nguyên, hết nhãn Sổ chờ.
 * SC-43: "Thử cấp số" (chỉ xem trước, không ghi) cùng trường hợp tại tòa → DA_CHON vào sổ chính, số dự kiến =
 * số thứ tự lớn nhất đã chuyển + 1 (sổ chính mới tạo nên bộ đếm của nó bằng 0).
 */
export async function sauApDung(
  page: Page,
  ghi: GhiChu,
  maToa: string,
  can: DayCanTim,
  maSoChinh: string,
  dsTruoc: SoTrongDay[],
  maBieuMau?: string,
): Promise<string> {
  const lech: string[] = [];
  const apiDv = await moApiSoCapSo(page, 'DON_VI');
  const doc = await docSoDaCap(apiDv, maToa, maSoChinh, dsTruoc.map(x => x.id));
  for (const x of dsTruoc) {
    const d = doc.get(x.id);
    if (!d) lech.push(`SC-42: số ${x.so} (${x.id}) không có ở sổ chính ${maSoChinh}`);
    else {
      ghi(`số ${x.so}`, `→ ${d.tenSo} · "${d.so}" · stt ${d.soThuTu} · laSoCho=${d.laSoCho}`);
      if (d.so !== x.so) lech.push(`SC-42: chuỗi đổi "${x.so}" → "${d.so}"`);
      if (d.laSoCho) lech.push(`số ${d.so} vẫn mang nhãn Sổ chờ`);
    }
  }
  const api = await moApiSoCapSo(page);
  /**
   * Phải truyền điểm cấp số: thiếu maDiem thì BE dùng KHONG_XAC_DINH, bộ máy xem trước thật không chọn được sổ và API
   * trả soDuKien = số bắt đầu của sổ (KiemTraCauHinhCapSoService.java:348-355), không phải số kế tiếp thật.
   */
  const maDiem = can.loaiSo === 'THU_LY' ? 'THU_LY.CAP_SO_THU_LY' : 'CHUNG.GIU_SO_TRUOC';
  const r = await api.post<ThuCapSoVO & { soDuKien?: number; soDayDu?: string; toaDaCoSo?: boolean; ghiChu?: string }>(
    'dm-so-cap-so/thu-cap-so',
    { maToa, loaiSo: can.loaiSo, maDiem, maBieuMau, giaTri: maBieuMau ? {} : can.giaTri },
  );
  const lonNhat = Math.max(...dsTruoc.map(x => x.soThuTu ?? Number(/^(\d+)/.exec(x.so)?.[1] ?? 0)));
  ghi('thử cấp số sau', `${r.ketQua} · ${r.maSo ?? '-'} (${r.tenSo ?? ''}) · dự kiến ${r.soDayDu ?? r.soDuKien ?? r.thongBao} · lớn nhất đã chuyển ${lonNhat}`);
  ghi('thử cấp số · bộ máy', `điểm ${maDiem} · toaDaCoSo=${r.toaDaCoSo} · ${r.ghiChu ?? '(không ghi chú)'}`);
  if (r.ketQua !== 'DA_CHON' || r.maSo !== maSoChinh) lech.push(`lần cấp sau không vào sổ chính ${maSoChinh}: ${r.ketQua} → ${r.maSo ?? r.thongBao}`);
  else if (!r.toaDaCoSo) {
    // Bộ máy không xem trước được số thật → soDuKien chỉ là số bắt đầu, không kết luận được SC-43.
    lech.push(`SC-43 chưa kiểm được: bộ máy xem trước không chọn sổ ${maSoChinh} ở ${maToa} (${r.ghiChu ?? 'không ghi chú'})`);
  } else if (r.soDuKien !== lonNhat + 1) lech.push(`SC-43: số dự kiến ${r.soDuKien}, mong đợi ${lonNhat + 1}`);
  if (lech.length) throw new Error(`TC6 KHÔNG ĐẠT:\n  ${lech.join('\n  ')}`);
  return `${dsTruoc.length} số giữ chuỗi ở ${maSoChinh}; số kế tiếp ${r.soDuKien}`;
}

/** SC-45/SC-21: dãy đã chuyển hiện Đã vô hiệu kèm tên sổ nhận (vai TANDTC). */
export async function kiemDayVoHieu(page: Page, ghi: GhiChu, idDay: string): Promise<string> {
  const api = await moApiSoCapSo(page);
  const ds = await danhSachDay(api, { trangThai: 'DA_VO_HIEU' });
  const d = ds.dsDay.find(x => x.idDay === idDay);
  if (!d) {
    const conLai = (await danhSachDay(api, {})).dsDay.find(x => x.idDay === idDay);
    throw new Error(`SC-45 KHÔNG ĐẠT: dãy ${idDay} không ở trạng thái DA_VO_HIEU (hiện: ${conLai ? conLai.trangThai : 'không có trong danh sách'})`);
  }
  ghi('dãy', `${d.trangThai} · sổ nhận ${d.tenSoNhan}`);
  if (!d.tenSoNhan) throw new Error(`SC-21: dãy Đã vô hiệu nhưng không có tên sổ nhận`);
  return `${d.trangThai} → ${d.tenSoNhan}`;
}

// ═══════════════════════ 12 · TC13: tài khoản tỉnh → 403 ═══════════════════════

export async function quyenTinh(page: Page, ghi: GhiChu): Promise<string> {
  const api = await moApiSoCapSo(page, 'DON_VI');
  try {
    const ds = await danhSachDay(api, {});
    throw new Error(`TC13 KHÔNG ĐẠT: tài khoản tỉnh đọc được Sổ chờ (${ds.dsDay.length} dãy)`);
  } catch (e) {
    if (/KHÔNG ĐẠT/.test(loi(e))) throw e;
    if (!/ trả 403/.test(loi(e))) throw new Error(`TC13: mong đợi 403, nhận: ${loi(e)}`);
    ghi('so-cho', `403 — ${loi(e).slice(0, 160)}`);
    // Ca 5 (UI): mở thẳng URL Danh mục sổ cấp số — không được thấy tab "Sổ chờ"
    await veTrangChu(page);
    await page.goto(ROUTE_DANH_MUC.replace(/^\//, ''), { waitUntil: 'domcontentloaded' });
    await choHetSpin(page);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const tab = await page.locator('.ant-tabs-tab').allInnerTexts();
    ghi('UI danh mục', `tab đang có: ${tab.map(t => t.trim()).join(' | ') || '(không có)'}`);
    if (tab.some(t => /S[oổ] ch[oờ]/i.test(t))) throw new Error(`Ca 5 KHÔNG ĐẠT: tài khoản tỉnh thấy tab Sổ chờ (${tab.join(' | ')})`);
    return '403; không thấy tab Sổ chờ';
  }
}

// ═══════════════════════ 14 · ca 15: chọn mọi tòa cùng trường hợp ═══════════════════════

/** Chỉ đọc. Tìm nhóm dãy Chờ xử lý cùng loại sổ, kỳ, khoá tách dãy ở ≥ 2 tòa; cung-truong-hop phải trả đúng nhóm đó. */
export async function chonMoiToa(page: Page, ghi: GhiChu): Promise<string> {
  const api = await moApiSoCapSo(page);
  const ds = (await danhSachDay(api, { trangThai: 'CHO' })).dsDay;
  const nhom = new Map<string, DayChoVO[]>();
  for (const d of ds) {
    const k = `${d.loaiSo}|${d.ky}|${d.khoaTachDay}`;
    nhom.set(k, [...(nhom.get(k) ?? []), d]);
  }
  const g = [...nhom.values()].find(x => new Set(x.map(d => d.maToa)).size >= 2);
  if (!g) {
    test.skip(true, `Không có trường hợp nào đang chờ ở ≥ 2 tòa (${ds.length} dãy chờ) — không kiểm được ca 15`);
    return '';
  }
  ghi('nhóm', `${g[0].loaiSo} ${JSON.stringify(g[0].giaTriTach)} · ${g.map(d => d.maToa).join(', ')}`);
  const tra = await api.get<string[]>(`dm-so-cap-so/so-cho/cung-truong-hop?${new URLSearchParams({ idDay: g[0].idDay })}`);
  // SC-31 (qla ee7356c2a3): chỉ dãy CÒN CHỜ (chưa gắn, không vô hiệu) cùng loại sổ, kỳ, khoá — ở mọi tòa
  const tatCa = (await danhSachDay(api, {})).dsDay;
  const theoId = new Map(tatCa.map(d => [d.idDay, d]));
  const sai = tra.map(id => theoId.get(id)).filter(d => !d || d.trangThai !== 'CHO' || d.loaiSo !== g[0].loaiSo
    || d.ky !== g[0].ky || d.khoaTachDay !== g[0].khoaTachDay);
  if (sai.length) throw new Error(`Ca SC-31 KHÔNG ĐẠT: cung-truong-hop trả dãy không cùng trường hợp hoặc không còn chờ: ${JSON.stringify(sai.map(d => d && { toa: d.maToa, tt: d.trangThai, loai: d.loaiSo, khoa: d.khoaTachDay }))}`);
  const cungKhoaKhacTT = tatCa.filter(d => d.loaiSo === g[0].loaiSo && d.ky === g[0].ky && d.khoaTachDay === g[0].khoaTachDay && d.trangThai !== 'CHO');
  ghi('cùng khoá nhưng không còn chờ (phải bị loại)', cungKhoaKhacTT.map(d => `${d.maToa}/${d.trangThai}`).join(', ') || '(không có)');
  const mong = g.map(d => d.idDay).sort();
  const thuc = [...tra].sort();
  ghi('cung-truong-hop', `${thuc.length} dãy (mong đợi ${mong.length})`);
  if (JSON.stringify(mong) !== JSON.stringify(thuc)) {
    throw new Error(`Ca 15 KHÔNG ĐẠT: cung-truong-hop trả ${JSON.stringify(thuc)}, mong đợi ${JSON.stringify(mong)}`);
  }
  return `${thuc.length} dãy ở ${new Set(g.map(d => d.maToa)).size} tòa`;
}

// ═══════════════════════ 15 · ca 6: nhãn tab "Sổ chờ (n)" ═══════════════════════

export async function tabSoChoUi(page: Page, ghi: GhiChu): Promise<string> {
  const api = await moApiSoCapSo(page); // đang đứng ở màn Danh mục sổ cấp số
  const ds = await danhSachDay(api, {});
  const tab = page.locator('.ant-tabs-tab').filter({ hasText: /S[oổ] ch[oờ]/ }).first();
  await tab.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  const nhan = ((await tab.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  ghi('tab', `"${nhan}" · API soDayCho=${ds.soDayCho}`);
  if (!nhan) throw new Error(`Ca 6: màn Danh mục không có tab Sổ chờ. Tab đang có: ${(await page.locator('.ant-tabs-tab').allInnerTexts()).join(' | ')}`);
  const n = Number(/\((\d+)\)/.exec(nhan)?.[1] ?? NaN);
  if (n !== ds.soDayCho) throw new Error(`Ca 6 KHÔNG ĐẠT: nhãn "${nhan}", số dãy Chờ xử lý theo API là ${ds.soDayCho}`);
  return nhan;
}

// ═══════════════════════ 16 · ca 12 + ca 16: cảnh báo khi lưu nháp, xoá nháp ═══════════════════════

/**
 * Tạo bản nháp từ dãy B, sửa thu hẹp điều kiện BIEU_MAU sang biểu mẫu khác → kiểm tra (FE gọi sau khi lưu, SC-32)
 * phải báo dãy không còn khớp. Rồi xoá bản nháp → dãy B tự về Chờ xử lý (SC-27).
 */
export async function xoaNhapCanhBao(
  page: Page,
  ghi: GhiChu,
  idDayB: string,
  maBieuMauKhac: string,
  tenSo: string,
): Promise<string> {
  const idNhap = await taoBanNhap(page, ghi, idDayB, tenSo);
  const api = await moApiSoCapSo(page);
  const ct = await api.get<MauSoVO>(`dm-so-cap-so/${encodeURIComponent(idNhap)}`);
  await api.put(`dm-so-cap-so/${encodeURIComponent(idNhap)}`, {
    ...ct.noiDung,
    dieuKien: { ...ct.noiDung.dieuKien, BIEU_MAU: [maBieuMauKhac] },
    lyDo: 'Playwright QLN-13300 ca 16: thu hẹp điều kiện',
  });
  const kt = await api.get<KiemTraChuyenVO>(`dm-so-cap-so/so-cho/kiem-tra/${encodeURIComponent(idNhap)}`);
  ghi('ca 16 · kiểm tra sau lưu', `chuyenDuoc=${kt.chuyenDuoc} · ${dsLoiChuyen(kt) || '(không lỗi)'}`);
  const lech: string[] = [];
  if (kt.chuyenDuoc || !kt.dsLoi.length) lech.push('ca 16: thu hẹp điều kiện làm dãy không khớp nhưng kiểm tra không báo');
  await api.del(`dm-so-cap-so/${encodeURIComponent(idNhap)}`);
  const d = await timDay(api, idDayB);
  ghi('ca 12 · sau xoá nháp', `${d.trangThai} · bản nhận ${d.idPhienBanNhan ?? '(không)'}`);
  if (d.trangThai !== 'CHO') lech.push(`ca 12: xoá bản nháp xong dãy là ${d.trangThai}, mong đợi CHO`);
  if (lech.length) throw new Error(lech.join('\n'));
  return `cảnh báo: ${kt.dsLoi.length} lỗi; xoá nháp → CHO`;
}

// ═══════════════════════ 17–19 · ca 9 + ca 17: đưa vào sổ đã có, sửa hậu tố ═══════════════════════

/** Tạo bản sửa của sổ chính A, thêm biểu mẫu của dãy B vào điều kiện, gắn dãy B với hậu tố mới (SC-26, SC-48). */
export async function duaVaoSoDaCo(
  page: Page,
  ghi: GhiChu,
  maSoChinh: string,
  idDayB: string,
  maBieuMauB: string,
  hauToMoi: string,
): Promise<{ idBanSua: string; ketQuaHauTo: string }> {
  const api = await moApiSoCapSo(page);
  const pb = await api.get<MauSoVO[]>(`dm-so-cap-so/ma/${encodeURIComponent(maSoChinh)}/phien-ban`);
  const dangDung = pb.find(x => x.trangThai === 'HIEU_LUC');
  if (!dangDung) throw new Error(`Sổ ${maSoChinh} không có bản HIEU_LUC: ${pb.map(x => `v${x.phienBan} ${x.trangThai}`).join(', ')}`);
  // Mỗi sổ chỉ một bản sửa chờ áp dụng (MauSoCapSoService.taoBanSua): lần chạy trước đã tạo thì dùng lại.
  const nhapCu = pb.find(x => x.trangThai === 'NHAP');
  const sua = nhapCu ?? (await api.post<MauSoVO>(`dm-so-cap-so/${encodeURIComponent(dangDung.id)}/ban-sua`, undefined));
  if (nhapCu) ghi('bản sửa', `dùng lại bản sửa nháp v${nhapCu.phienBan} (${nhapCu.id})`);
  const g = await api.get<GoiYSoVO>(`dm-so-cap-so/so-cho/goi-y?${new URLSearchParams({ dsIdDay: idDayB })}`);
  const dk = { ...sua.noiDung.dieuKien };
  dk.BIEU_MAU = [...new Set([...(dk.BIEU_MAU ?? []), maBieuMauB])];
  await api.put(`dm-so-cap-so/${encodeURIComponent(sua.id)}`, {
    ...sua.noiDung,
    dieuKien: dk,
    ngayApDungTu: g.ngayDauTien ?? sua.noiDung.ngayApDungTu,
    lyDo: 'Playwright QLN-13300 ca 9: đưa dãy chờ vào sổ đã có',
  });
  ghi('bản sửa', `${sua.maSo} v${sua.phienBan} (${sua.id}) · BIEU_MAU ${JSON.stringify(dk.BIEU_MAU)}`);
  /**
   * Ca 17 thử trước: gắn KÈM hậu tố. Đo dev 12/11/2026: luôn 500 (gắn không hậu tố thì OK) — lỗi hệ thống, ghi kết quả
   * vào `ketQuaHauTo` để bước 21 báo đỏ riêng; ca 9 vẫn đi tiếp bằng gắn KHÔNG hậu tố.
   */
  let ketQuaHauTo = 'OK';
  let kq: KiemTraChuyenVO;
  try {
    kq = await api.post<KiemTraChuyenVO>('dm-so-cap-so/so-cho/gan', { idPhienBan: sua.id, dsIdDay: [idDayB], hauToMoi });
  } catch (e) {
    ketQuaHauTo = `LỖI: ${loi(e).slice(0, 300)}`;
    ghi('ca 17 · gắn có hậu tố', ketQuaHauTo);
    kq = await api.post<KiemTraChuyenVO>('dm-so-cap-so/so-cho/gan', { idPhienBan: sua.id, dsIdDay: [idDayB] });
  }
  ghi(
    'gắn dãy B',
    `hậu tố ${ketQuaHauTo === 'OK' ? `"${hauToMoi}"` : '(không — gắn có hậu tố lỗi)'} · chuyenDuoc=${kq.chuyenDuoc} · ${kq.soLuong} số` +
      ` · cảnh báo ${kq.dsCanhBao?.length ?? 0}${kq.dsLoi.length ? ` · lỗi ${dsLoiChuyen(kq)}` : ''}`,
  );
  if (!kq.chuyenDuoc) throw new Error(`Ca 9: gắn dãy B vào bản sửa không chuyển được — ${dsLoiChuyen(kq)}`);
  return { idBanSua: sua.id, ketQuaHauTo };
}

/** Sau áp dụng bản sửa: số của dãy B ở sổ A, số thứ tự + năm giữ, hậu tố mới; Lịch sử số giữ chuỗi cũ; dãy B vô hiệu. */
export async function sauBanSua(
  page: Page,
  ghi: GhiChu,
  maToa: string,
  maSoChinh: string,
  idDayB: string,
  soB: { id: string; so: string },
  hauToMoi: string | null,
): Promise<string> {
  const lech: string[] = [];
  const apiDv = await moApiSoCapSo(page, 'DON_VI');
  const d = (await docSoDaCap(apiDv, maToa, maSoChinh, [soB.id])).get(soB.id);
  // Không có hậu tố (gắn có hậu tố lỗi ở bước 17) → chuỗi phải giữ nguyên (SC-42)
  // Quy tắc BE (SoChoService.doiHauTo, qla develop 13/11): có năm 4 chữ số sau số thứ tự thì giữ "NN/YYYY/",
  // không có năm (sổ mặc định không ghi năm, 6f07bb3565) thì giữ "NN/" — rồi nối hậu tố mới, viết hoa.
  const giuLai = /^[^/]+\/\d{4}\//.exec(soB.so)?.[0] ?? /^[^/]+\//.exec(soB.so)?.[0] ?? '';
  const mong = hauToMoi ? `${giuLai}${hauToMoi}`.toUpperCase() : soB.so;
  ghi('số dãy B', d ? `"${soB.so}" → ${d.tenSo} · "${d.so}" (mong đợi "${mong}") · laSoCho=${d.laSoCho}` : 'không có ở sổ chính');
  if (!d) lech.push(`ca 9: số ${soB.so} không chuyển sang sổ ${maSoChinh}`);
  else if (d.so !== mong) lech.push(`ca 17: chuỗi sau chuyển "${d.so}", mong đợi "${mong}"`);
  const nk = await apiDv.get<{ data?: NhatKySoVO[]; content?: NhatKySoVO[] }>(
    `so-cap-so-don-vi/nhat-ky-sua-xoa-so?${new URLSearchParams({ maToa, idCapSo: soB.id, page: '1', size: '50' })}`,
  );
  const dong = nk?.data ?? nk?.content ?? [];
  ghi('lịch sử số B', dong.map(n => `${n.phanLoai} ${n.soTruoc ?? ''}→${n.soSau ?? ''}`).join(' · ') || '(trống)');
  // Chuỗi cũ trong Lịch sử số kiểm ở bước 21 (đo dev 13/11: nhật ký chỉ có số trần — lỗi hệ thống, không chặn ca 9)
  const api = await moApiSoCapSo(page);
  const day = (await danhSachDay(api, { trangThai: 'DA_VO_HIEU' })).dsDay.find(x => x.idDay === idDayB);
  ghi('dãy B', day ? `${day.trangThai} → ${day.tenSoNhan}` : 'không ở trạng thái Đã vô hiệu');
  if (!day) lech.push('ca 9: dãy B không chuyển sang Đã vô hiệu');
  if (lech.length) throw new Error(`KHÔNG ĐẠT:\n  ${lech.join('\n  ')}`);
  return `"${soB.so}" → "${d!.so}" ở ${maSoChinh}`;
}

// ═══════════════════════ 20 · ca 7: Lịch sử số có "Chuyển từ Sổ chờ" ═══════════════════════

/**
 * Như màn Số đã cấp › Lịch sử số (qla-webapp SoDaCap.tsx:315-318 → GET nhat-ky-sua-xoa-so?idCapSo=).
 * Đo dev 12/11/2026: TRỐNG — BE ghi CAP_SO_LOG.PHAN_LOAI = 'CHUYEN_TU_SO_CHO' (SoChoService.java:373,
 * NhatKyThaoTacSo.java:27-45) nhưng API chỉ lấy PHAN_LOAI IN DS_PHAN_LOAI (NhatKySoCapSoService.java:31-34, 44),
 * danh sách này không có CHUYEN_TU_SO_CHO. Lỗi hệ thống — không vá trong test.
 */
export async function lichSuChuyen(page: Page, ghi: GhiChu, maToa: string, so: SoTrongDay): Promise<string> {
  const apiDv = await moApiSoCapSo(page, 'DON_VI');
  const nk = await apiDv.get<{ data?: NhatKySoVO[]; content?: NhatKySoVO[] }>(
    `so-cap-so-don-vi/nhat-ky-sua-xoa-so?${new URLSearchParams({ maToa, idCapSo: so.id, page: '1', size: '50' })}`,
  );
  const dong = nk?.data ?? nk?.content ?? [];
  ghi('lịch sử số', `${so.so}: ` + (dong.map(n => `${n.phanLoai} (${n.soTruoc ?? ''}→${n.soSau ?? ''}, ${n.lyDo ?? ''})`).join(' · ') || '(trống)'));
  const co = dong.find(n => /CHUYEN_TU_SO_CHO|S[oổ] ch[oờ]/i.test(`${n.phanLoai} ${n.lyDo ?? ''}`));
  if (!co) {
    throw new Error(
      `Ca 7 KHÔNG ĐẠT (lỗi hệ thống): Lịch sử số của ${so.so} không có dòng "Chuyển từ Sổ chờ" — API nhat-ky-sua-xoa-so ` +
        'lọc PHAN_LOAI IN DS_PHAN_LOAI (NhatKySoCapSoService.java:31-34) thiếu CHUYEN_TU_SO_CHO',
    );
  }
  return `${co.phanLoai}: ${co.lyDo ?? ''}`;
}

// ═══════════════════════ 22–23 · SC-50: thông báo dãy mới ═══════════════════════

interface ThongBaoVO {
  id: string;
  tieuDe?: string;
  noiDung?: string;
  redirectUrl?: string;
  ngayGui?: string;
}

async function thongBaoSoCho(api: ApiSoCapSo, tuLuc: string): Promise<ThongBaoVO[]> {
  // ThongBaoController.java:31-38 · GET /notices (trang của người đang đăng nhập)
  const t = await api.get<{ data?: ThongBaoVO[]; content?: ThongBaoVO[] }>(
    `notices?${new URLSearchParams({ keyword: 'Sổ chờ', fromTime: tuLuc, page: '1', size: '50' })}`,
  );
  return (t?.data ?? t?.content ?? []).filter(x => /S[oổ] ch[oờ]/i.test(`${x.tieuDe} ${x.noiDung}`));
}

/**
 * SC-50 (qla c9566d02bf, webapp cd58c559e3): dãy chờ mới phát sinh (bước 03) → quản trị TAND tối cao nhận thông báo
 * "Sổ chờ có dãy mới" kèm tòa + trường hợp; liên kết ?tab=CHO&trangThai=CHO&tuKhoa=<tòa>&loaiSo=<loại> mở thẳng tab
 * Sổ chờ đã lọc (SoChoThongBao.java:103-113).
 */
export async function thongBaoTandtc(page: Page, ghi: GhiChu, maToa: string, tuNgay: string): Promise<string> {
  const api = await moApiSoCapSo(page);
  const ds = await thongBaoSoCho(api, `${tuNgay}T00:00:00`);
  ghi('thông báo Sổ chờ', ds.map(x => `${x.ngayGui} · ${x.tieuDe} · ${x.noiDung} → ${x.redirectUrl}`).join(' | ') || '(không có)');
  const tb = ds.find(x => /d[aã]y m[oớ]i/i.test(x.tieuDe ?? '') && (x.redirectUrl ?? '').includes(`tuKhoa=${encodeURIComponent(maToa)}`));
  if (!tb) {
    // Người nhận = cán bộ TANDTC có vai QTUD ADMINISTRATOR | 000 | TC_CAU_HINH_BIEU_MAU_CAP_SO (SoChoThongBao.java:132-145,
    // VaiTroQuanTriHeThongQtud.java:27-28). Vai chạy bước này phải có một trong các vai đó thì mới kết luận được.
    throw new Error(
      `SC-50 CHƯA KẾT LUẬN: tài khoản vai này không có thông báo "Sổ chờ có dãy mới" cho ${maToa} từ ${tuNgay}. ` +
        'Nếu tài khoản có vai QTUD ADMINISTRATOR/000/TC_CAU_HINH_BIEU_MAU_CAP_SO thì là lỗi; nếu không thì cần tài khoản có vai đó.',
    );
  }
  const url = new URL(tb.redirectUrl!, 'http://x');
  const lech: string[] = [];
  if (url.searchParams.get('tab') !== 'CHO') lech.push(`liên kết thiếu tab=CHO: ${tb.redirectUrl}`);
  if (url.searchParams.get('trangThai') !== 'CHO') lech.push(`liên kết thiếu trangThai=CHO: ${tb.redirectUrl}`);
  // Mở liên kết như bấm vào thông báo: tab đang chọn phải là Sổ chờ
  await veTrangChu(page);
  await page.goto(tb.redirectUrl!.replace(/^\//, ''), { waitUntil: 'domcontentloaded' });
  await choHetSpin(page);
  const tabChon = page.locator('.ant-tabs-tab-active').first();
  await tabChon.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
  const nhan = ((await tabChon.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const oTim = await page.locator('input[value]').evaluateAll(xs => xs.map(x => (x as HTMLInputElement).value).filter(Boolean));
  ghi('mở liên kết', `${page.url()} · tab đang chọn "${nhan}" · ô đã điền: ${oTim.join(' | ') || '(trống)'}`);
  if (!/S[oổ] ch[oờ]/i.test(nhan)) lech.push(`mở liên kết nhưng tab đang chọn là "${nhan}", không phải Sổ chờ`);
  if (!oTim.some(v => v.includes(maToa))) lech.push(`tab Sổ chờ chưa lọc sẵn tòa ${maToa}`);
  if (lech.length) throw new Error(`SC-50 KHÔNG ĐẠT:\n  ${lech.join('\n  ')}`);
  return `${tb.tieuDe}: ${tb.noiDung}`;
}

/** SC-50: tài khoản không phải quản trị TAND tối cao (TAND tỉnh) không nhận thông báo Sổ chờ. */
export async function thongBaoTinh(page: Page, ghi: GhiChu, tuNgay: string): Promise<string> {
  const api = await moApiSoCapSo(page, 'DON_VI');
  const ds = await thongBaoSoCho(api, `${tuNgay}T00:00:00`);
  ghi('thông báo Sổ chờ của TK tỉnh', ds.map(x => `${x.tieuDe} · ${x.noiDung}`).join(' | ') || '(không có)');
  if (ds.length) throw new Error(`SC-50 KHÔNG ĐẠT: tài khoản TAND tỉnh nhận ${ds.length} thông báo Sổ chờ`);
  return 'không nhận';
}

// ═══════════════════════ 24 · SC-16: KNTT / GQTC / KNHC vào Sổ chờ (quan sát dữ liệu dev) ═══════════════════════

/**
 * Chỉ đọc. Không tự tạo đơn KNTT/GQTC/KNHC (cần luồng nghiệp vụ riêng) — quan sát các dãy chờ ĐÃ phát sinh trên dev
 * (do QC/người khác) có thủ tục / biểu mẫu thuộc các phân hệ này, và đọc số của dãy ở Số đã cấp của tòa.
 */
export async function quanSatSc16(page: Page, ghi: GhiChu): Promise<string> {
  const api = await moApiSoCapSo(page);
  const ds = (await danhSachDay(api, {})).dsDay;
  const nhom: Record<string, DayChoVO[]> = {
    'KNTT thụ lý': ds.filter(d => d.loaiSo === 'THU_LY' && (d.giaTriTach?.THU_TUC ?? []).some(t => /KNTT/i.test(t))),
    'GQTC thụ lý': ds.filter(d => d.loaiSo === 'THU_LY' && (d.giaTriTach?.THU_TUC ?? []).some(t => /GQTC|TO_CAO/i.test(t))),
    'KNHC thụ lý': ds.filter(d => d.loaiSo === 'THU_LY' && (d.giaTriTach?.THU_TUC ?? []).some(t => /KNHC|KHIEU_NAI_HANH_CHINH/i.test(t))),
    'KNTT văn bản': ds.filter(d => d.loaiSo === 'VAN_BAN' && (d.giaTriTach?.BIEU_MAU ?? []).some(t => /KNTT/i.test(t))),
    'GQTC văn bản': ds.filter(d => d.loaiSo === 'VAN_BAN' && (d.giaTriTach?.BIEU_MAU ?? []).some(t => /GQTC|TO_CAO/i.test(t))),
  };
  const apiDv = await moApiSoCapSo(page, 'DON_VI');
  const tom: string[] = [];
  for (const [ten, dsDay] of Object.entries(nhom)) {
    if (!dsDay.length) {
      tom.push(`${ten}: chưa có dãy`);
      continue;
    }
    const d = dsDay[0];
    const q = new URLSearchParams({ maSo: 'SO_CHO', nam: String(d.ky), page: '1', size: '200' });
    const so = dongTrang(await apiDv.get<TrangSoDaCap>(`so-cap-so-don-vi/${encodeURIComponent(d.maToa)}/so-da-cap?${q}`))
      .filter(x => x.laSoCho && (d.loaiSo !== 'VAN_BAN' || (d.giaTriTach.BIEU_MAU ?? []).includes(x.maBieuMau ?? '')));
    ghi(ten, `${dsDay.length} dãy · vd ${d.maToa} ${JSON.stringify(d.giaTriTach)} · số: ${so.slice(0, 5).map(x => x.so).join(', ') || '(không đọc được)'}`);
    tom.push(`${ten}: ${dsDay.length} dãy`);
  }
  return tom.join(' · ');
}

/**
 * Ca 17 / SC-48: sau khi chuyển kèm hậu tố mới, Lịch sử số phải giữ CHUỖI CŨ. Đo dev 13/11/2026: dòng CHUYEN_TU_SO_CHO
 * chỉ có số trần ("1→1") — NhatKyThaoTacSo.anhChup (java:62-72) không chụp soKyHieuDayDu, SQL_GHI lưu
 * SO_VAN_BAN_MOI = capSo.getSo() (java:50); NhatKySoCapSoService.java:124-127 đọc soTruoc từ đó.
 */
export async function chuoiCuTrongLichSu(page: Page, ghi: GhiChu, maToa: string, soB: SoTrongDay): Promise<string> {
  const apiDv = await moApiSoCapSo(page, 'DON_VI');
  const nk = await apiDv.get<{ data?: NhatKySoVO[]; content?: NhatKySoVO[] }>(
    `so-cap-so-don-vi/nhat-ky-sua-xoa-so?${new URLSearchParams({ maToa, idCapSo: soB.id, page: '1', size: '50' })}`,
  );
  const dong = nk?.data ?? nk?.content ?? [];
  ghi('lịch sử số B', dong.map(n => `${n.phanLoai} "${n.soTruoc ?? ''}"→"${n.soSau ?? ''}" · ${n.lyDo ?? ''}`).join(' | ') || '(trống)');
  if (!dong.some(n => `${n.soTruoc ?? ''} ${n.soSau ?? ''} ${n.lyDo ?? ''}`.includes(soB.so))) {
    throw new Error(`Ca 17 KHÔNG ĐẠT (lỗi hệ thống): Lịch sử số không hiện chuỗi cũ "${soB.so}" sau khi đổi hậu tố — nhật ký CHUYEN_TU_SO_CHO chỉ ghi số trần (NhatKyThaoTacSo.java:50, 62-72)`);
  }
  return `có chuỗi cũ "${soB.so}"`;
}
