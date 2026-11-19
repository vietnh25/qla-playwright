/**
 * FLOW HỆ THỐNG 003 · thân các bước golden (chỉ đọc: GET danh mục + POST thu-cap-so là XEM TRƯỚC).
 * Phạm vi và nguồn: xem đầu `flow.ts`.
 */
import fs from 'fs';
import path from 'path';
import { Page, Request } from '@playwright/test';
import { ROUTE_DANH_MUC, ROUTE_DON_VI, moQuaMenu } from '../flow-002-so-cap-so-v2-smoke/so-cap-so-v2.flow';
import type { NguCanhGolden } from '../../../data/he-thong/flow-003-golden-cap-so/case-001/input';

type GhiChu = (nhan: string, mo: string) => void;

const THU_MUC_GOLDEN = path.resolve(__dirname, '../../../data/he-thong/flow-003-golden-cap-so/golden');
const moiTruong = () => process.env.QLA_ENV || 'stg';
const fileGolden = (env: string) => path.join(THU_MUC_GOLDEN, `${env}.json`);

// ═══════════════════════ API của app, dùng đúng header app tự gửi ═══════════════════════

export interface ApiSoCapSo {
  get<T>(duongDan: string): Promise<T>;
  post<T>(duongDan: string, data: unknown): Promise<T>;
  put<T>(duongDan: string, data: unknown): Promise<T>;
  del<T>(duongDan: string): Promise<T>;
}

/**
 * Mở màn Danh mục sổ cấp số và mượn header của chính request app gửi (authorization, x-client-session,
 * x-work-context, x-menu-id, x-man-hinh). Thiếu x-work-context thì API trả 403 "Vui lòng chọn đơn vị và vai
 * trò làm việc" (đo dev 09/11/2026) — nên KHÔNG tự dựng header. Header không in, không ghi file.
 */
export async function moApiSoCapSo(page: Page, man: 'DANH_MUC' | 'DON_VI' = 'DANH_MUC'): Promise<ApiSoCapSo> {
  let header: Record<string, string> | undefined;
  // Tòa cấp dưới mượn header ở màn "Sổ cấp số của đơn vị" (màn của tòa), KHÔNG dựa vào việc vào được
  // màn Danh mục bằng URL — đó là lỗi phân quyền đã báo (flow-002 bước 03).
  const mauApi = man === 'DANH_MUC' ? /\/qla\/api\/v1\/(dm-so-cap-so|dm-diem-cap-so|dm-tieu-chi-cap-so)/ : /\/qla\/api\/v1\/so-cap-so-don-vi/;
  const nghe = (r: Request) => {
    if (mauApi.test(r.url()) && r.headers()['x-work-context']) header = r.headers();
  };
  page.on('request', nghe);
  try {
    if (man === 'DANH_MUC') await moQuaMenu(page, ROUTE_DANH_MUC, 'Danh mục sổ cấp số');
    else await moQuaMenu(page, ROUTE_DON_VI, 'Sổ cấp số của đơn vị');
    const hetHan = Date.now() + 20_000;
    while (!header && Date.now() < hetHan) await page.waitForTimeout(250);
  } finally {
    page.off('request', nghe);
  }
  if (!header) throw new Error(`Màn ${man} không gửi request nào có x-work-context — không mượn được phiên gọi API`);
  const giu = Object.fromEntries(Object.entries(header).filter(([k]) => !/^(:|host|content-length|cookie)/i.test(k)));
  const goc = `${new URL(page.url()).origin}/qla/api/v1`;
  const doc = async <T>(r: import('@playwright/test').APIResponse, moTa: string): Promise<T> => {
    const j = await r.json().catch(() => null);
    if (r.status() >= 400 || !j || j.success === false) {
      throw new Error(`${moTa} trả ${r.status()}: ${JSON.stringify(j).slice(0, 300)}`);
    }
    return j.data as T;
  };
  return {
    get: async <T>(d: string) => doc<T>(await page.request.get(`${goc}/${d}`, { headers: giu }), `GET ${d}`),
    post: async <T>(d: string, data: unknown) => doc<T>(await page.request.post(`${goc}/${d}`, { headers: giu, data }), `POST ${d}`),
    put: async <T>(d: string, data: unknown) => doc<T>(await page.request.put(`${goc}/${d}`, { headers: giu, data }), `PUT ${d}`),
    del: async <T>(d: string) => doc<T>(await page.request.delete(`${goc}/${d}`, { headers: giu }), `DELETE ${d}`),
  };
}

// ═══════════════════════ 04–05 · tiêu chí 13: thử = cấp thật (KV5) ═══════════════════════

export interface CauHinhTieuChi13 {
  maToa: string;
  /** biểu mẫu ứng viên — thuộc các sổ của tòa; bước 04 lọc ra những biểu mẫu bộ máy đang cấp vào sổ được chọn */
  dsBieuMau: string[];
}

/** Kết quả thử của một biểu mẫu, bàn giao từ bước 04 sang 05 (JSON trong state) */
export interface DuKienTieuChi13 {
  maBieuMau: string;
  maSo: string;
  soDuKien: number;
  soDayDu: string;
}

/**
 * 04 · Thử cấp số ở điểm Giữ số trước (CHUNG.GIU_SO_TRUOC) cho từng ứng viên — chỉ xem trước.
 * Giữ ứng viên DA_CHON + toaDaCoSo: bộ máy (xemTruocThat) chọn đúng sổ đó, tức cấp thật sẽ vào sổ này
 * (KiemTraCauHinhCapSoService.java:340-343). toaDaCoSo=false nghĩa là chức năng còn cấp theo cách cũ → bỏ.
 */
export async function thuCapSoTieuChi13(page: Page, ghi: GhiChu, ch: CauHinhTieuChi13): Promise<DuKienTieuChi13[]> {
  const api = await moApiSoCapSo(page);
  const giu: DuKienTieuChi13[] = [];
  for (const maBieuMau of ch.dsBieuMau) {
    const r = await api.post<ThuCapSoVO>('dm-so-cap-so/thu-cap-so', {
      maToa: ch.maToa,
      loaiSo: 'VAN_BAN',
      maDiem: 'CHUNG.GIU_SO_TRUOC',
      maBieuMau,
      giaTri: {},
    });
    const dung = r.ketQua === 'DA_CHON' && r.toaDaCoSo && r.soDuKien != null && !!r.soDayDu;
    ghi(
      `thử · ${maBieuMau}`,
      `${r.ketQua} · ${r.maSo ?? '-'} (${r.tenSo ?? ''}) · ${r.soDayDu ?? r.thongBao ?? ''} · toaDaCoSo=${r.toaDaCoSo}${dung ? '' : ' → bỏ'}`,
    );
    if (dung) giu.push({ maBieuMau, maSo: r.maSo!, soDuKien: r.soDuKien!, soDayDu: r.soDayDu! });
  }
  if (!giu.length) {
    throw new Error(`Không biểu mẫu ứng viên nào được bộ máy cấp vào sổ của ${ch.maToa} (DA_CHON + toaDaCoSo) — thêm ứng viên`);
  }
  return giu;
}

/** Một dòng "Số đã cấp" — qla-webapp types/so-cap-so-don-vi.d.ts:52-68 */
interface SoDaCapVO {
  id: string;
  so: string;
  soThuTu?: number;
  maSo: string;
  maDiemCapSo?: string;
}

interface GiuSoCapSoVO {
  idCapSo?: string;
  so?: string;
  soThuTu?: number;
  nam?: number;
}

/**
 * 05 · KV5 giữ số THẬT (POST /cap-so/giu-so) lần lượt theo danh sách bước 04:
 *   · bị từ chối (vd. BIEU_MAU_KHONG_LAY_SO_TU_DONG) → LỆCH tiêu chí 13 (thử ra số, cấp thật không ra), không tạo số;
 *   · cấp được → so số thứ tự + số đầy đủ với bản thử, rồi LUÔN trả số (huy-so-giu, CapSoServiceImpl.java:2064-2075);
 *     dừng ở biểu mẫu cấp được đầu tiên để chỉ phát sinh MỘT số trên môi trường.
 * Có lệch nào thì bước đỏ — kể cả khi đã có một biểu mẫu khớp — vì tiêu chí 13 áp cho mọi ngữ cảnh.
 */
export async function giuSoThatTieuChi13(
  page: Page,
  ghi: GhiChu,
  ch: CauHinhTieuChi13,
  dsDuKien: DuKienTieuChi13[],
): Promise<{ khop: string; lech: string[] }> {
  const api = await moApiSoCapSo(page, 'DON_VI');
  const lech: string[] = [];
  let khop = '';
  for (const dk of dsDuKien) {
    const q = new URLSearchParams({ maBieuMau: dk.maBieuMau }).toString();
    let r: GiuSoCapSoVO;
    try {
      r = await api.post<GiuSoCapSoVO>(`cap-so/giu-so?${q}`, undefined);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const ma = /"code":"([A-Z_]+)"/.exec(m)?.[1] ?? '(không rõ mã)';
      /**
       * Chẩn đoán (chỉ đọc) đúng câu FE hỏi khi mở biểu mẫu (qla-webapp services/van-ban.ts:105-116):
       * true = công tắc QTUD "Nhập số thủ công" đang bật cho biểu mẫu này (CheDoCapSo.java:143-152),
       * false = do cờ BieuMau.laySoTuDong=false (CapSoServiceImpl.validateBieuMauLaySoTuDong).
       */
      const congTac = await api
        .get<boolean>(`van-ban/nhap-so-thu-cong?${new URLSearchParams({ maBieuMau: dk.maBieuMau })}`)
        .then(v => (v ? 'công tắc QTUD "Nhập số thủ công" đang BẬT' : 'biểu mẫu đặt lấy số thủ công (laySoTuDong=false)'))
        .catch(() => 'không hỏi được công tắc');
      lech.push(`${dk.maBieuMau}: thử ra "${dk.soDayDu}" (sổ ${dk.maSo}) nhưng cấp thật bị từ chối ${ma} — ${congTac}`);
      ghi(`giữ số · ${dk.maBieuMau}`, `từ chối ${ma} (${congTac}) — không tạo số`);
      continue;
    }
    if (!r?.idCapSo) throw new Error(`giu-so ${dk.maBieuMau} không trả idCapSo: ${JSON.stringify(r)}`);
    ghi(`giữ số · ${dk.maBieuMau}`, `${r.so} · số thứ tự ${r.soThuTu} · năm ${r.nam} · idCapSo ${r.idCapSo}`);
    try {
      /**
       * KHÔNG so r.so với soDayDu của bản thử: giu-so trả CAP_SO.SO = số trần ("9"), còn Thử cấp số trả
       * SO_KY_HIEU_DAY_DU ("09/2026") — CapSo.java:41 vs :128-129, GiuSoCapSoVO.java:13,
       * KiemTraCauHinhCapSoService.java:352 (đo dev 09/11/2026: thử "09/2026", giữ "9", số thứ tự cùng 9).
       * Đọc lại CHÍNH dòng vừa giữ ở "Số đã cấp" (trước khi trả số) để so sổ, số thứ tự, số đầy đủ, mã điểm.
       */
      const duongDanSoDaCap = `so-cap-so-don-vi/${encodeURIComponent(ch.maToa)}/so-da-cap?${new URLSearchParams({
        maSo: dk.maSo,
        nam: String(r.nam ?? new Date().getFullYear()),
        page: '1',
        size: '100',
      })}`;
      let trang: { content?: SoDaCapVO[]; data?: SoDaCapVO[] };
      try {
        trang = await api.get(duongDanSoDaCap);
      } catch (e) {
        /**
         * LỖI HỆ THỐNG (R6 nhóm 3), không vá vòng: "Số đã cấp" lỗi thì KHÔNG xác nhận được sổ. Vẫn báo phần đã kiểm
         * được (số thứ tự) để người đọc không nhầm là giữ số hỏng. Đo STG 09–10/11/2026: API này trả 500 liên tục.
         */
        const thuTu = r.soThuTu === dk.soDuKien ? `số thứ tự thật ${r.soThuTu} = thử` : `số thứ tự thử ${dk.soDuKien} ≠ thật ${r.soThuTu}`;
        throw new Error(
          `Tiêu chí 13 tại ${ch.maToa} · ${dk.maBieuMau}: ${thuTu}, nhưng KHÔNG đối chiếu được sổ ${dk.maSo} vì ` +
            `API "Số đã cấp" lỗi (lỗi hệ thống, số đã trả lại):\n  ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      const dong = (trang?.content ?? trang?.data ?? []).find(d => d.id === r.idCapSo);
      const l: string[] = [];
      if (r.soThuTu !== dk.soDuKien) l.push(`số thứ tự thử ${dk.soDuKien} ≠ thật ${r.soThuTu}`);
      if (!dong) {
        l.push(`không thấy dòng ${r.idCapSo} trong "Số đã cấp" của sổ ${dk.maSo} — số thật không nằm ở sổ đã thử?`);
      } else {
        ghi(`số đã cấp · ${dk.maBieuMau}`, `sổ ${dong.maSo} · ${dong.so} · số thứ tự ${dong.soThuTu} · điểm ${dong.maDiemCapSo ?? '(trống)'}`);
        if (dong.maSo !== dk.maSo) l.push(`sổ thử ${dk.maSo} ≠ sổ thật ${dong.maSo}`);
        if (dong.so.includes('/') && dong.so !== dk.soDayDu) l.push(`số đầy đủ thử "${dk.soDayDu}" ≠ thật "${dong.so}"`);
        /**
         * Ghi chú, KHÔNG tính vào tiêu chí 13 (cùng sổ + cùng số): mã điểm là tiêu chí 14 / ĐX-11, và "Số đã cấp"
         * chỉ trả số trần thì không đối chiếu được số đầy đủ. Đo dev 09/11/2026: maDiemCapSo trống, so="9".
         */
        if (dong.maDiemCapSo !== 'CHUNG.GIU_SO_TRUOC') {
          ghi('lưu ý · mã điểm', `dòng ${r.idCapSo} mang mã điểm ${dong.maDiemCapSo ?? '(trống)'}, mong đợi CHUNG.GIU_SO_TRUOC (tiêu chí 14)`);
        }
        if (!dong.so.includes('/')) {
          ghi('lưu ý · số đầy đủ', `"Số đã cấp" trả số trần "${dong.so}" — chưa đối chiếu được với bản thử "${dk.soDayDu}"`);
        }
      }
      if (l.length) lech.push(`${dk.maBieuMau}: ${l.join('; ')} (nếu có người lấy số chen giữa 04 và 05 thì chạy lại)`);
      else khop = `${dk.maBieuMau} → sổ ${dk.maSo}, số thứ tự ${r.soThuTu}${dong?.so.includes('/') ? `, "${dong.so}"` : ''} = bản thử`;
    } finally {
      await api.post(`cap-so/${r.idCapSo}/huy-so-giu`, undefined);
      ghi(`trả số · ${dk.maBieuMau}`, `huy-so-giu ${r.idCapSo} → OK`);
    }
    break; // chỉ phát sinh một số thật
  }
  if (lech.length || !khop) {
    throw new Error(
      `Tiêu chí 13 tại ${ch.maToa}: ${khop ? `khớp ${khop}; ` : 'không biểu mẫu nào cấp thật được; '}` +
        `${lech.length} lệch:\n  ${lech.join('\n  ')}`,
    );
  }
  return { khop, lech };
}

// ═══════════════════════ 01 · danh mục điểm cấp số ═══════════════════════

interface DiemCapSoVO {
  maDiem: string;
  tenDiem: string;
  nhomSoChoPhep?: string;
  dangDung: boolean;
}

export async function kiemDiemCapSo(page: Page, ghi: GhiChu, dsGolden: string[]): Promise<string> {
  const api = await moApiSoCapSo(page);
  const ds = (await api.get<DiemCapSoVO[]>('dm-diem-cap-so')).filter(d => d.dangDung).map(d => d.maDiem).sort();
  ghi('điểm cấp số đang dùng', `${ds.length}: ${ds.join(', ')}`);
  const thieu = dsGolden.filter(m => !ds.includes(m));
  const moi = ds.filter(m => !dsGolden.includes(m));
  if (thieu.length || moi.length) {
    throw new Error(
      `Danh mục điểm cấp số lệch tập golden (${moiTruong()}).` +
        (thieu.length ? `\n  Mất / ngưng dùng: ${thieu.join(', ')}` : '') +
        (moi.length ? `\n  Điểm mới chưa có ngữ cảnh golden: ${moi.join(', ')} → thêm ngữ cảnh + cập nhật dsDiemGolden` : ''),
    );
  }
  return ds.join(', ');
}

// ═══════════════════════ 02 · golden ngữ cảnh → sổ → số ═══════════════════════

interface ThuCapSoVO {
  ketQua: string;
  thongBao?: string;
  maSo?: string;
  tenSo?: string;
  soSoKhop: number;
  tenDay?: string;
  soDuKien?: number;
  soDayDu?: string;
  toaDaCoSo: boolean;
}

/** Một dòng golden — chỉ giữ thứ BỀN theo thời gian (số thứ tự đổi khi có người cấp số → so theo MẪU) */
export interface DongGolden {
  ketQua: string;
  maSo: string | null;
  tenDay: string | null;
  /** soDayDu với số thứ tự thay bằng {so}, vd. "{so}/2026/TLST-HNGĐ" */
  mauSo: string | null;
  soSoKhop: number;
  toaDaCoSo: boolean;
}

/** "07/2026/QĐ" với số thứ tự 7 → "{so}/2026/QĐ" */
export function mauCuaSo(soDayDu?: string, soDuKien?: number): string | null {
  if (!soDayDu) return null;
  if (soDuKien == null) return soDayDu;
  return soDayDu.replace(new RegExp(`(^|\\D)0*${soDuKien}(?=\\D|$)`), (_, truoc: string) => `${truoc}{so}`);
}

function soSanh(a: DongGolden, b: DongGolden): string[] {
  return (Object.keys(a) as (keyof DongGolden)[])
    .filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map(k => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}`);
}

export async function chayGolden(
  page: Page,
  ghi: GhiChu,
  dsNguCanh: NguCanhGolden[],
): Promise<{ tomTat: string; ketQua: Record<string, DongGolden> }> {
  const env = moiTruong();
  const api = await moApiSoCapSo(page);
  const ketQua: Record<string, DongGolden> = {};
  const soThuTu: Record<string, number | undefined> = {};
  const loi: string[] = [];

  for (const nc of dsNguCanh) {
    const r = await api.post<ThuCapSoVO>('dm-so-cap-so/thu-cap-so', {
      maToa: nc.maToa,
      loaiSo: nc.loaiSo,
      maDiem: nc.maDiem,
      ngay: nc.ngay,
      maBieuMau: nc.maBieuMau,
      giaTri: nc.giaTri ?? {},
    });
    const dong: DongGolden = {
      ketQua: r.ketQua,
      maSo: r.maSo ?? null,
      tenDay: r.tenDay ?? null,
      mauSo: mauCuaSo(r.soDayDu, r.soDuKien),
      soSoKhop: r.soSoKhop,
      toaDaCoSo: r.toaDaCoSo,
    };
    ketQua[nc.id] = dong;
    soThuTu[nc.id] = r.soDuKien;
    ghi(
      `golden · ${nc.id}`,
      `${r.ketQua} · ${r.maSo ?? '-'} ${r.tenSo ? `(${r.tenSo})` : ''} · ${r.soDayDu ?? r.thongBao ?? ''}`.trim(),
    );
    // Kỳ vọng cứng của ĐÚNG môi trường đang chạy (mã mẫu sổ HT- khác nhau giữa môi trường — xem input.ts)
    for (const [k, v] of Object.entries(nc.kyVong?.[env as 'dev' | 'stg' | 'preprod'] ?? {})) {
      const thuc = (dong as unknown as Record<string, unknown>)[k];
      if (v !== undefined && thuc !== v) loi.push(`${nc.id}: ${k} mong đợi ${v}, thực tế ${thuc ?? '(trống)'} — ${r.thongBao ?? ''}`);
    }
  }

  // Bất biến: các điểm cùng ngữ cảnh ra cùng sổ + cùng số dự kiến (xem = cấp = giữ trước; DS/KDTM cùng dãy)
  for (const nc of dsNguCanh.filter(n => n.cungKetQuaVoi)) {
    const a = ketQua[nc.id];
    const b = ketQua[nc.cungKetQuaVoi!];
    if (!b) {
      loi.push(`${nc.id}: cungKetQuaVoi="${nc.cungKetQuaVoi}" không có trong danh sách ngữ cảnh`);
      continue;
    }
    const lech = soSanh(a, b);
    if (soThuTu[nc.id] !== soThuTu[nc.cungKetQuaVoi!]) lech.push(`soDuKien: ${soThuTu[nc.cungKetQuaVoi!]} → ${soThuTu[nc.id]}`);
    if (lech.length) loi.push(`${nc.id} ≠ ${nc.cungKetQuaVoi}: ${lech.join('; ')}`);
  }

  // Baseline của môi trường
  const tep = fileGolden(env);
  const ghiMoi = process.env.QLA_GOLDEN_GHI === '1';
  if (!fs.existsSync(tep) || ghiMoi) {
    fs.mkdirSync(THU_MUC_GOLDEN, { recursive: true });
    fs.writeFileSync(
      tep,
      JSON.stringify({ moiTruong: env, ghiLuc: new Date().toISOString(), ketQua }, null, 2) + '\n',
    );
    ghi('baseline', `đã ghi ${path.relative(process.cwd(), tep)} (${Object.keys(ketQua).length} ngữ cảnh)`);
    loi.push(
      `Baseline golden ${env} vừa được ${ghiMoi ? 'GHI LẠI' : 'tạo mới'}: ${path.relative(process.cwd(), tep)}. ` +
        'Duyệt từng dòng (sổ đúng nghiệp vụ chưa?) rồi chạy lại — baseline chưa duyệt không được tính là xanh.',
    );
  } else {
    const cu = JSON.parse(fs.readFileSync(tep, 'utf8')).ketQua as Record<string, DongGolden>;
    for (const [id, dong] of Object.entries(ketQua)) {
      if (!cu[id]) {
        loi.push(`${id}: ngữ cảnh mới, chưa có trong baseline ${env} → chạy với QLA_GOLDEN_GHI=1 rồi duyệt`);
        continue;
      }
      const lech = soSanh(dong, cu[id]);
      if (lech.length) loi.push(`${id} lệch baseline ${env}: ${lech.join('; ')}`);
    }
    for (const id of Object.keys(cu).filter(i => !ketQua[i])) loi.push(`${id}: có trong baseline nhưng đã bỏ khỏi danh sách ngữ cảnh`);
  }

  if (loi.length) throw new Error(`Golden ngữ cảnh → sổ → số (${env}): ${loi.length} điểm lệch\n  ${loi.join('\n  ')}`);
  const dem = Object.values(ketQua).reduce<Record<string, number>>((m, d) => ((m[d.ketQua] = (m[d.ketQua] || 0) + 1), m), {});
  return { tomTat: `${dsNguCanh.length} ngữ cảnh khớp baseline ${env} · ${JSON.stringify(dem)}`, ketQua };
}

// ═══════════════════════ 03 · D14 đối chiếu giữa môi trường ═══════════════════════

export function doiChieuMoiTruong(ghi: GhiChu): { tomTat: string; coMoiTruongKhac: boolean } {
  const env = moiTruong();
  const cua = (e: string) => JSON.parse(fs.readFileSync(fileGolden(e), 'utf8')).ketQua as Record<string, DongGolden>;
  const khac = fs
    .readdirSync(THU_MUC_GOLDEN)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .filter(e => e !== env);
  if (!fs.existsSync(fileGolden(env))) {
    // Môi trường đang chạy chưa có baseline (bước 02 chưa ghi được) → không có gì để đối chiếu.
    // Đo STG 09/11/2026: thu-cap-so / dm-tieu-chi-cap-so / dm-so-cap-so trả 500 nên bước 02 không ghi được.
    return {
      tomTat: `${env} chưa có baseline golden/${env}.json (bước 02 trên ${env} chưa ghi được) — đang có: ${khac.join(', ') || '(không)'}`,
      coMoiTruongKhac: false,
    };
  }
  if (!khac.length) return { tomTat: `chỉ có baseline ${env}`, coMoiTruongKhac: false };
  const nay = cua(env);
  const dong: string[] = [];
  for (const e of khac) {
    const kia = cua(e);
    const chung = Object.keys(nay).filter(id => kia[id]);
    const lech = chung
      .map(id => ({ id, l: soSanh(nay[id], kia[id]).filter(x => /^(ketQua|maSo|tenDay|mauSo)/.test(x)) }))
      .filter(x => x.l.length);
    dong.push(`${env} ↔ ${e}: ${chung.length} ngữ cảnh chung, ${lech.length} lệch`);
    for (const x of lech) ghi(`D14 · ${e} → ${env} · ${x.id}`, x.l.join('; '));
  }
  // Báo cáo, không chặn: cấu hình hai môi trường được phép khác (D14 là để THẤY lệch, người duyệt quyết)
  return { tomTat: dong.join(' · '), coMoiTruongKhac: true };
}
