/**
 * FLOW HỆ THỐNG 002 · thao tác CHỈ ĐỌC trên hai màn sổ cấp số v2 (QLN-13171).
 * Nguồn FE và phạm vi: xem đầu `flow.ts`.
 *
 * Mỗi hàm trả về BẰNG CHỨNG đọc từ hệ thống (dữ liệu API, danh sách tab đang có) — không trả "ok".
 * Chỗ nào lệch kỳ vọng thì ném lỗi KÈM thứ đang có (R11), không chờ hết giờ.
 */
import { Page, Response, expect } from '@playwright/test';
import { choHetSpin, toastGanDay } from '../../../common/antd';
import { khungMenu } from '../../../common/menu';
import { veTrangChu } from '../../../common/vai';

type GhiChu = (nhan: string, mo: string) => void;

export const ROUTE_DON_VI = '/cau-hinh/so-cap-so-don-vi';
export const ROUTE_DANH_MUC = '/cau-hinh/danh-muc-so-cap-so';

/** Chỉ chạy trên DEV: tài khoản của luồng này khai ở config/tai-khoan.dev.local.json */
export function phaiLaDev() {
  const env = process.env.QLA_ENV || 'stg';
  if (env !== 'dev') {
    throw new Error(`Luồng sổ cấp số v2 chỉ chạy trên dev (QLA_ENV=dev), đang là "${env}". Dùng: npm run so-cap-so-v2:dev`);
  }
}

/** Ghi lại mọi phản hồi API lỗi (≥ 400) của QLA trong lúc chạy `viec` */
async function ngheLoiApi<T>(page: Page, viec: () => Promise<T>): Promise<{ kq: T; loi: string[] }> {
  const loi: string[] = [];
  const nghe = (r: Response) => {
    if (r.status() >= 400 && /\/qla\/api\//.test(r.url())) {
      loi.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').replace(/\?.*/, '')}`);
    }
  };
  page.on('response', nghe);
  try {
    return { kq: await viec(), loi };
  } finally {
    page.off('response', nghe);
  }
}

/** Các link menu trỏ tới màn sổ cấp số (href), để báo đúng thứ đang có khi lệch */
async function linkSoCapSo(page: Page): Promise<string[]> {
  return khungMenu(page)
    .locator('a[href*="so-cap-so"]')
    .evaluateAll(as => as.map(a => `${(a.textContent || '').trim()} → ${a.getAttribute('href')}`));
}

/** Mở màn bằng link menu (SPA) — URL dựng từ menu nên vào bằng link, không page.goto */
export async function moQuaMenu(page: Page, route: string, tieuDe: string) {
  await veTrangChu(page);
  const link = khungMenu(page).locator(`a[href$="${route}"]`).first();
  // Phiên vừa đăng nhập còn ở màn "Đang tải dữ liệu" (khung xương, chưa có menu) — count() ngay lúc đó ra 0
  // dù menu có link (đo dev 09/11/2026, TK KV5). Chờ menu dựng xong rồi mới kết luận "không có".
  await expect(khungMenu(page), 'Menu bên trái không dựng xong').toBeVisible({ timeout: 60_000 });
  await link.waitFor({ state: 'attached', timeout: 15_000 }).catch(() => undefined);
  if (!(await link.count())) {
    throw new Error(`Menu không có link ${route}. Link sổ cấp số đang có: ${(await linkSoCapSo(page)).join(' | ') || '(không có)'}`);
  }
  /**
   * Đi theo href của link (như common/menu.ts · diTheoMuc), KHÔNG click bằng evaluate: đo dev
   * 09/11/2026 với TK TANDTC, link nằm trong nhóm "Cấu hình chung" đang đóng → click không điều hướng,
   * trang đứng ở Trang chủ. Tiêu đề chỉ tìm trong vùng nội dung (role main): menu cũng chứa đúng chữ
   * "Danh mục sổ cấp số" nên tìm toàn trang là qua giả.
   */
  const href = await link.getAttribute('href');
  await page.goto(href!, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(u => u.pathname.endsWith(route), { timeout: 30_000 });
  await choHetSpin(page);
  await expect(
    // `visible=true`: breadcrumb (ẩn trong main) cũng mang đúng chữ này và đứng trước tiêu đề
    page.getByRole('main').getByText(tieuDe, { exact: true }).locator('visible=true').first(),
    `Đã vào ${page.url()} nhưng vùng nội dung không có tiêu đề "${tieuDe}"`,
  ).toBeVisible({ timeout: 30_000 });
}

/** Danh sách tab ĐANG CÓ của một nhóm tab (lấy theo thứ tự trên màn) */
async function dsTab(page: Page, trongKhoi = page.locator('body')) {
  return (await trongKhoi.locator('.ant-tabs-tab').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * Bấm lần lượt từng tab, chờ tải xong, gom lỗi (toast, API ≥ 400, Alert error). Trả "tab: ok|lỗi…".
 * `khoiTab` = nhóm tab cần đi (Danh mục sổ cấp số có tab lồng nhau).
 */
async function diQuaTab(page: Page, ghi: GhiChu, nhan: string, mongDoi: string[], khoiTab = () => page.locator('.ant-tabs').first()) {
  const coSan = await dsTab(page, khoiTab().locator('> .ant-tabs-nav'));
  const thieu = mongDoi.filter(t => !coSan.includes(t));
  if (thieu.length) {
    throw new Error(`${nhan}: thiếu tab ${thieu.map(t => `"${t}"`).join(', ')}. Tab đang có: ${coSan.join(' | ')}`);
  }
  const ketQua: string[] = [];
  for (const ten of mongDoi) {
    const { loi } = await ngheLoiApi(page, async () => {
      await khoiTab().locator('> .ant-tabs-nav .ant-tabs-tab').filter({ hasText: new RegExp(`^${ten}$`) }).first().click();
      await choHetSpin(page);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await choHetSpin(page);
    });
    const toastLoi = (await toastGanDay(page, 8_000)).filter(t => /lỗi|không thể|thất bại|error|exception/i.test(t));
    const alertLoi = (await khoiTab().locator('.ant-tabs-tabpane-active .ant-alert-error').allInnerTexts()).map(s => s.trim());
    const tatCaLoi = [...loi, ...toastLoi, ...alertLoi];
    ketQua.push(`${ten}: ${tatCaLoi.length ? `LỖI (${tatCaLoi.join('; ')})` : 'ok'}`);
    ghi(`${nhan} · tab`, ketQua[ketQua.length - 1]);
  }
  const hong = ketQua.filter(k => k.includes('LỖI'));
  if (hong.length) throw new Error(`${nhan}: ${hong.length}/${mongDoi.length} tab lỗi khi tải:\n  ${hong.join('\n  ')}`);
  return ketQua;
}

// ═══════════════════════ BƯỚC ═══════════════════════

const TAB_DON_VI = ['Tất cả sổ', 'Số đã cấp', 'Hồi tố và gián đoạn', 'Bất thường dãy số', 'Nhật ký sửa, xóa số'];
const TAB_DANH_MUC = ['Tất cả sổ', 'Thử cấp số', 'Kiểm tra cấu hình', 'Danh mục'];
const TAB_CON_DANH_MUC = [
  'Danh sách lựa chọn',
  'Biểu mẫu',
  'Xác định loại hồ sơ',
  'Chức năng cấp số',
  'Đơn vị cấp số',
  'Tra theo biểu mẫu',
  'Nhật ký thay đổi',
];

/** 01 · tòa cấp dưới: có "Sổ cấp số của đơn vị", không có "Danh mục sổ cấp số" */
export async function kiemMenuToaCapDuoi(page: Page, ghi: GhiChu): Promise<string> {
  phaiLaDev();
  await veTrangChu(page);
  await expect(khungMenu(page), 'Không thấy menu bên trái').toBeVisible({ timeout: 60_000 });
  const ds = await linkSoCapSo(page);
  ghi('link sổ cấp số trong menu', ds.join(' | ') || '(không có)');
  const coDonVi = ds.some(l => l.endsWith(ROUTE_DON_VI));
  const coDanhMuc = ds.some(l => l.endsWith(ROUTE_DANH_MUC));
  const sai: string[] = [];
  if (!coDonVi) sai.push('THIẾU menu "Sổ cấp số của đơn vị" (5.1.10)');
  if (coDanhMuc) sai.push('CÓ menu "Danh mục sổ cấp số" (5.1.9) — menu này chỉ dành cho cấp TANDTC');
  if (sai.length) throw new Error(`${sai.join('; ')}. Link sổ cấp số đang có: ${ds.join(' | ') || '(không có)'}`);
  return `có ${ROUTE_DON_VI}, không có ${ROUTE_DANH_MUC}`;
}

/** 02/05 · "Sổ cấp số của đơn vị": đọc phạm vi xem từ API, đi qua 5 tab */
export async function moSoDonVi(
  page: Page,
  ghi: GhiChu,
  mongDoi: { maToa?: string; laToiCao: boolean },
): Promise<{ maToa: string; soToaXemDuoc: string; tab: string }> {
  phaiLaDev();
  const phamViP = page.waitForResponse(r => /\/so-cap-so-don-vi\/pham-vi/.test(r.url()), { timeout: 60_000 });
  await moQuaMenu(page, ROUTE_DON_VI, 'Sổ cấp số của đơn vị');
  const rPhamVi = await phamViP;
  const j = await rPhamVi.json().catch(() => null);
  if (rPhamVi.status() >= 400 || !j?.data) {
    throw new Error(`GET /so-cap-so-don-vi/pham-vi trả ${rPhamVi.status()}: ${JSON.stringify(j).slice(0, 300)}`);
  }
  const pv = j.data as { maToaDangNhap?: string; laToiCao?: boolean; dsToa?: { ma: string; ten: string; cuaMinh?: boolean }[] };
  const dsToa = pv.dsToa || [];
  ghi('phạm vi xem', `maToaDangNhap=${pv.maToaDangNhap} · laToiCao=${pv.laToiCao} · ${dsToa.length} tòa`);
  if (mongDoi.maToa && pv.maToaDangNhap !== mongDoi.maToa) {
    throw new Error(`Tòa đăng nhập là ${pv.maToaDangNhap}, mong đợi ${mongDoi.maToa}`);
  }
  if (!!pv.laToiCao !== mongDoi.laToiCao) {
    throw new Error(`laToiCao=${pv.laToiCao}, mong đợi ${mongDoi.laToiCao} (tòa ${pv.maToaDangNhap})`);
  }
  if (!mongDoi.laToiCao) {
    const toaKhac = dsToa.filter(t => t.ma !== pv.maToaDangNhap);
    if (toaKhac.length) {
      ghi('lưu ý phạm vi', `tòa cấp dưới xem được thêm ${toaKhac.length} tòa: ${toaKhac.map(t => t.ma).slice(0, 10).join(', ')}`);
    }
  } else if (dsToa.length < 2) {
    throw new Error(`Tài khoản TANDTC chỉ xem được ${dsToa.length} tòa — mong đợi xem được các tòa cấp dưới`);
  }
  const tab = await diQuaTab(page, ghi, 'Sổ cấp số của đơn vị', TAB_DON_VI);
  return { maToa: pv.maToaDangNhap || '', soToaXemDuoc: String(dsToa.length), tab: tab.join(' · ') };
}

/** 03 · tòa cấp dưới gõ thẳng URL Danh mục sổ cấp số → không được vào màn */
export async function kiemChanDanhMuc(page: Page, ghi: GhiChu): Promise<string> {
  phaiLaDev();
  await veTrangChu(page);
  await page.goto(ROUTE_DANH_MUC.replace(/^\//, ''), { waitUntil: 'domcontentloaded' });
  await choHetSpin(page);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const tieuDe = page.getByText('Danh mục sổ cấp số', { exact: true });
  const vaoDuoc = await page
    .locator('.ant-tabs-tab')
    .filter({ hasText: /^Thử cấp số$/ })
    .first()
    .isVisible()
    .catch(() => false);
  const thongBao = (
    await page
      .getByText(/không có quyền|403|Không tìm thấy trang|404|Rất tiếc/i)
      .first()
      .innerText()
      .catch(() => '')
  )
    .replace(/\s+/g, ' ')
    .trim();
  ghi('mở thẳng URL danh mục', `${page.url()} · ${thongBao || '(không có thông báo chặn)'}`);
  if (vaoDuoc) {
    throw new Error(
      `Tài khoản tòa cấp dưới VÀO ĐƯỢC màn Danh mục sổ cấp số bằng URL ${page.url()} (thấy tab "Thử cấp số"). ` +
        'Menu ẩn nhưng route chưa chặn quyền — lỗi hệ thống (R6 nhóm 3).',
    );
  }
  return thongBao || `không mở được màn (tiêu đề hiện: ${await tieuDe.count()})`;
}

/** 04 · TANDTC: Danh mục sổ cấp số, 4 tab + 7 tab con của "Danh mục" */
export async function moDanhMucTandtc(page: Page, ghi: GhiChu): Promise<string> {
  phaiLaDev();
  await moQuaMenu(page, ROUTE_DANH_MUC, 'Danh mục sổ cấp số');
  const ngoai = await diQuaTab(page, ghi, 'Danh mục sổ cấp số', TAB_DANH_MUC);
  // Đang đứng ở tab "Danh mục" (tab cuối) → nhóm tab con nằm trong pane đang mở
  const con = await diQuaTab(page, ghi, 'Danh mục › tab con', TAB_CON_DANH_MUC, () =>
    page.locator('.ant-tabs').first().locator('.ant-tabs-tabpane-active .ant-tabs').first(),
  );
  return [...ngoai, ...con.map(c => `Danh mục/${c}`)].join(' · ');
}
