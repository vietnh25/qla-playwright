/**
 * FLOW HỆ THỐNG 001 · thao tác trên màn Sổ cấp số (Hệ thống › Cấu hình › Sổ cấp số).
 *
 * Selector đối chiếu code FE nhánh staging/1.4.0 ngày 05/11/2026:
 *   · `src/pages/SoCapSo/index.tsx`            — bảng nhóm sổ, menu ⋮, ModalForm thêm nhóm sổ
 *   · `src/pages/SoCapSo/GanBieuMauHangLoatModal.tsx` — gắn biểu mẫu, chuyển sổ có xác nhận
 *   · `src/pages/SoCapSo/CauHinhBieuMauSoModal.tsx`   — kích hoạt cấu hình cấp số (UC196)
 *
 * Màn này PHẢI vào bằng menu: gõ thẳng URL /qla/cau-hinh/so-cap-so ra trang 404 (đo STG 14/10/2026).
 */
import { Locator, Page, expect, test } from '@playwright/test';
import { choHetSpin, chonSelect, hienTrong, nghi, toastDaHien } from '../../../common/antd';
import { khungMenu, moMenu } from '../../../common/menu';
import { veTrangChu } from '../../../common/vai';

export type GhiChu = (nhan: string, mo: string) => void;

export interface CauHinhSo {
  ten: string;
  ma: string;
  /** nhãn loại án đúng như ô Loại án, vd. 'Dân sự' */
  loaiAn: string;
  /** nhãn cấp xét xử, vd. 'Sơ thẩm'; rỗng = dùng chung mọi cấp */
  capXetXu: string;
  /** "Số cấp tiếp theo" khi phải tạo sổ mới */
  soCapTiepTheo: number;
}

export interface KetQuaSo {
  ten: string;
  /** "Đã cấp đến số" trước khi luồng lấy số; 0 nếu sổ chưa cấp số nào */
  daCapDen: number;
  moiTao: boolean;
}

/** Số thứ tự đầu chuỗi số văn bản: "12/2026/QĐ-PCTP" → 12, "65501315/2026/TLST-DS" → 65501315 */
export function soThuTu(so: string): number {
  const m = so.trim().match(/^(\d+)/);
  if (!m) throw new Error(`Không tách được số thứ tự từ "${so}"`);
  return Number(m[1]);
}

const NUT_THEM = (page: Page) => page.getByRole('button', { name: /Thêm nhóm sổ/ });

export async function moManSoCapSo(page: Page, ghi: GhiChu) {
  if (await hienTrong(NUT_THEM(page), 2_000)) return;
  await veTrangChu(page);
  // Bấm link trong menu (điều hướng trong SPA) — không page.goto vì URL trực tiếp ra 404
  const link = khungMenu(page).locator('a[href*="/cau-hinh/so-cap-so"]').first();
  if (await link.count()) {
    await link.evaluate(a => (a as HTMLAnchorElement).click());
  } else {
    await moMenu(page, ['Cấu hình', 'Sổ cấp số']);
  }
  await choHetSpin(page);
  await expect(
    NUT_THEM(page),
    'Không mở được màn Sổ cấp số — tài khoản cần quyền menu Hệ thống › Cấu hình › Sổ cấp số',
  ).toBeVisible({ timeout: 60_000 });
  ghi('màn sổ cấp số', page.url());
}

/** Các dòng nhóm sổ của bảng sau khi tìm nhanh theo mã/tên */
async function timNhanh(page: Page, tuKhoa: string): Promise<Locator> {
  const o = page.getByPlaceholder('Tìm mã hoặc tên nhóm sổ...').first();
  await o.fill('');
  await o.fill(tuKhoa);
  await o.press('Enter');
  await choHetSpin(page);
  await nghi(page, 800, 1200);
  return page.locator('.ant-table-tbody > tr.ant-table-row');
}

/** Đọc "Đã cấp đến số" của một dòng ('-' = chưa cấp → 0) */
async function daCapDen(dong: Locator): Promise<number> {
  const chu = (await dong.innerText()).replace(/\s+/g, ' ');
  const m = chu.match(/Đã cấp đến số:\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** Ô ProForm theo name — ModalForm không đặt tên form nên id = name */
const oForm = (modal: Locator, name: string) => modal.locator(`#${name}`);

/**
 * Dùng helper chung (R9). Bản tự viết trước đây hỏng ở STG 05/11/2026 (Timeout 30 s khi bấm "Dân sự"):
 *   · `.ant-select-dropdown:visible` không gắn với ô đang mở — bắt cả dropdown đang chạy hiệu ứng mở,
 *     nên form trong modal "intercepts pointer events" rồi mục "not stable";
 *   · `fill()` đổi từ khoá → ProFormSelectCustom debounce 400 ms rồi gọi lại API, vẽ lại danh sách
 *     ngay lúc đang bấm (R12) → mục bị thay, "not visible" tới hết 30 s;
 *   · Escape sau khi chọn: dropdown đã đóng thì Escape đóng luôn modal Thêm nhóm sổ.
 * `chonSelect` lấy đúng dropdown của ô, chờ danh sách ổn định, thử lại 3 lần, và throw ngay kèm
 * danh sách mục đang có nếu không có "Dân sự".
 */
async function chonTrongSelect(page: Page, o: Locator, nhan: string) {
  await chonSelect(page, o, nhan);
}

/**
 * Dòng của sổ khớp mã + loại án + cấp. Sổ 999 thì cấp xét xử phải ĐÚNG cấp cần (sổ "Mọi cấp" vẫn
 * được BE dùng khi không có sổ đúng cấp — nhận làm phương án hai).
 */
/**
 * Vị trí cột theo TIÊU ĐỀ, không theo số thứ tự cứng. Bảng có cột "STT" đứng đầu
 * (STT | Tên | Mã | Loại án | Cấp xét xử | …); bản cũ đếm từ Tên nên đọc lệch một cột, không bao giờ
 * khớp sổ có sẵn → bấm "Thêm nhóm sổ" và máy chủ trả SO_THU_LY_LOAI_AN_DA_TON_TAI
 * (đo STG 05/11/2026: sổ Test01 · 999 · maLoaiAn 002 · SO_THAM có từ 23/10 mà không được nhận).
 */
async function cotTheoTieuDe(page: Page): Promise<Record<'ten' | 'ma' | 'loaiAn' | 'cap', number>> {
  const tieuDe = (await page.locator('.ant-table-thead > tr').first().locator('th').allInnerTexts()).map(s =>
    s.replace(/\s+/g, ' ').trim(),
  );
  const tim = (mau: RegExp) => {
    const i = tieuDe.findIndex(t => mau.test(t));
    if (i < 0) throw new Error(`Bảng nhóm sổ không có cột ${mau}. Đang có: ${tieuDe.join(' | ')}`);
    return i;
  };
  return { ten: tim(/^Tên nhóm sổ/), ma: tim(/^Mã nhóm sổ/), loaiAn: tim(/^Loại án/), cap: tim(/^Cấp xét xử/) };
}

async function timDongSo(page: Page, so: CauHinhSo, theoTen = false): Promise<Locator | null> {
  const dong = await timNhanh(page, theoTen ? so.ten : so.ma);
  const n = await dong.count();
  if (!n) return null;
  const c = await cotTheoTieuDe(page);
  let duPhong: Locator | null = null;
  for (let i = 0; i < n; i++) {
    const d = dong.nth(i);
    const o = (await d.locator('td').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
    if (theoTen && o[c.ten] !== so.ten) continue;
    // Loại án so KHỚP NGUYÊN VĂN: "Dân sự" không được nhận nhầm "Hôn nhân và gia đình"/"Hình sự"
    if (o[c.ma] !== so.ma || o[c.loaiAn] !== so.loaiAn) continue;
    if (!so.capXetXu || o[c.cap] === so.capXetXu) return d;
    if (o[c.cap] === 'Mọi cấp') duPhong = d;
  }
  return duPhong;
}

/** Tên sổ của một dòng (cột "Tên nhóm sổ cấp số", không phải cột STT đầu dòng) */
async function tenCuaDong(page: Page, dong: Locator): Promise<string> {
  const c = await cotTheoTieuDe(page);
  return (await dong.locator('td').nth(c.ten).innerText()).trim();
}

export async function timHoacTaoSo(page: Page, so: CauHinhSo, ghi: GhiChu): Promise<KetQuaSo> {
  await moManSoCapSo(page, ghi);
  const coSan = await timDongSo(page, so);
  if (coSan) {
    const ten = await tenCuaDong(page, coSan);
    const den = await daCapDen(coSan);
    ghi('sổ có sẵn', `${so.ma} · ${ten} · đã cấp đến ${den || '(chưa cấp)'}`);
    return { ten, daCapDen: den, moiTao: false };
  }

  await test.step(`Thêm nhóm sổ ${so.ma} · ${so.loaiAn} · ${so.capXetXu || 'mọi cấp'}`, async () => {
    await NUT_THEM(page).click();
    const modal = page.locator('.ant-modal:visible').filter({ hasText: 'Thêm nhóm sổ cấp số' }).first();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await oForm(modal, 'tenSoCapSo').fill(so.ten);
    await oForm(modal, 'loaiSoCapSo').fill(so.ma);
    await nghi(page, 400, 700); // ô Loại án / Cấp xét xử đổi theo mã sổ (ProFormDependency)
    await chonTrongSelect(page, oForm(modal, 'maLoaiAn'), so.loaiAn);
    if (so.capXetXu) await chonTrongSelect(page, oForm(modal, 'capXetXu'), so.capXetXu);
    await oForm(modal, 'soCapTu').fill(String(so.soCapTiepTheo));
    await modal.getByRole('button', { name: /Thêm mới/ }).click();
    await toastDaHien(page, /Tạo nhóm sổ thành công/, 30_000, /Không thể lưu nhóm sổ|đã tồn tại/i);
    await choHetSpin(page);
  });

  const moi = await timDongSo(page, so, true);
  expect(moi, `Đã báo tạo nhóm sổ nhưng bảng không có sổ "${so.ten}"`).not.toBeNull();
  ghi('sổ mới tạo', `${so.ma} · ${so.ten} · số cấp tiếp theo ${so.soCapTiepTheo}`);
  return { ten: so.ten, daCapDen: 0, moiTao: true };
}

/** Mở menu ⋮ của sổ (tìm theo tên) rồi chọn một mục */
async function chonThaoTac(page: Page, tenSo: string, muc: RegExp) {
  const dong = (await timNhanh(page, tenSo)).filter({ hasText: tenSo }).first();
  await expect(dong, `Bảng nhóm sổ không có "${tenSo}"`).toBeVisible({ timeout: 30_000 });
  await dong.locator('td').last().getByRole('button').click();
  const item = page.locator('.ant-dropdown:visible .ant-dropdown-menu-item').filter({ hasText: muc }).first();
  await expect(item, `Menu ⋮ của sổ "${tenSo}" không có mục ${muc}`).toBeVisible({ timeout: 10_000 });
  await item.click();
  await choHetSpin(page);
}

export async function ganBieuMau(
  page: Page,
  tenSo: string,
  maBieuMau: string,
  choPhepChuyenSo: boolean,
  ghi: GhiChu,
): Promise<string> {
  await moManSoCapSo(page, ghi);
  await chonThaoTac(page, tenSo, /Gắn biểu mẫu hàng loạt/);
  const modal = page.locator('.ant-modal:visible').filter({ hasText: /Gắn biểu mẫu vào sổ/ }).first();
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await modal.getByPlaceholder('Mã hoặc tên biểu mẫu').fill(maBieuMau);
  await choHetSpin(page);
  await nghi(page, 600, 1000);
  const dong = modal.locator('.ant-table-tbody > tr.ant-table-row').filter({
    has: page.locator('td', { hasText: new RegExp(`^${maBieuMau.replace(/\./g, '\\.')}$`) }),
  });
  await expect(dong.first(), `Danh sách biểu mẫu không có mã ${maBieuMau}`).toBeVisible({ timeout: 30_000 });
  await dong.first().locator('.ant-checkbox-input').check({ force: true });
  await nghi(page, 400, 700);

  const canhBao = modal.locator('.ant-alert').filter({ hasText: /đang thuộc sổ khác|sẽ được chuyển/ });
  if (await hienTrong(canhBao, 1_500)) {
    if (!choPhepChuyenSo) {
      throw new Error(
        `${maBieuMau} đang ở sổ khác cùng loại án, cùng cấp. Đặt input.choPhepChuyenSo = true để chuyển ` +
          `sang "${tenSo}" (số đã cấp ở sổ cũ giữ nguyên), hoặc gắn tay rồi chạy lại.`,
      );
    }
    await canhBao.locator('.ant-checkbox-input').check({ force: true });
    ghi('gắn biểu mẫu', `${maBieuMau} đang ở sổ khác → chuyển sang "${tenSo}"`);
  }

  await modal.getByRole('button', { name: /^Gắn 1 biểu mẫu$/ }).click();
  const xacNhan = page.locator('.ant-modal-confirm:visible').filter({ hasText: /Chuyển .* biểu mẫu/ });
  if (await hienTrong(xacNhan, 3_000)) await xacNhan.getByRole('button', { name: 'Chuyển sổ' }).click();

  await toastDaHien(page, /Đã gắn: \d+ mới, \d+ cập nhật, \d+ bỏ qua/, 30_000, /Không thể gắn biểu mẫu/);
  const kq = (await page.locator('.ant-message-notice').filter({ hasText: 'Đã gắn:' }).last().innerText().catch(() => '')).trim();
  ghi('gắn biểu mẫu', kq || 'đã gắn');
  await choHetSpin(page);
  return kq || `đã gắn ${maBieuMau}`;
}

export async function kichHoatCauHinh(page: Page, tenSo: string, maBieuMau: string, ghi: GhiChu): Promise<string> {
  await moManSoCapSo(page, ghi);
  await chonThaoTac(page, tenSo, /Kích hoạt cấu hình cấp số/);
  const modal = page.locator('.ant-modal:visible').filter({ hasText: 'Cấu hình cấp số văn bản' }).first();
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await choHetSpin(page);

  const dong = modal.locator('.ant-table-tbody > tr.ant-table-row').filter({ hasText: maBieuMau }).first();
  await expect(dong, `Sổ "${tenSo}" chưa gắn ${maBieuMau} — chạy lại bước 03`).toBeVisible({ timeout: 30_000 });

  if (!(await dong.getByText('Đang áp dụng').isVisible().catch(() => false))) {
    // Cột Thao tác: nút đầu là Kích hoạt (icon check-circle), nút sau là Lịch sử
    await dong.locator('button:has(.anticon-check-circle)').click();
    const hop = page.locator('.ant-modal:visible').filter({ hasText: 'Kích hoạt cấu hình cấp số' }).last();
    await hop.locator('textarea').fill('Playwright: kích hoạt trước thí điểm 15/11');
    await hop.getByRole('button', { name: /^Kích hoạt$/ }).click();
    await toastDaHien(page, /Kích hoạt cấu hình thành công/, 30_000, /thất bại/i);
    await choHetSpin(page);
  }
  await expect(dong.getByText('Đang áp dụng'), `${maBieuMau} vẫn chưa Đang áp dụng`).toBeVisible({ timeout: 30_000 });
  ghi('cấu hình cấp số', `${maBieuMau} · Đang áp dụng trong "${tenSo}"`);
  await modal.locator('.ant-modal-close').click();
  return 'Đang áp dụng';
}

/**
 * Kiểm số do hệ thống cấp:
 *   · sổ mới tạo   → số đầu tiên phải ĐÚNG "Số cấp tiếp theo"
 *   · sổ có sẵn    → số phải LỚN HƠN "Đã cấp đến số" đọc ở bước cấu hình (người khác có thể lấy số xen giữa)
 *   · cả hai       → sau khi lấy, "Đã cấp đến số" của sổ phải ≥ số đã nhận (số thật sự ghi vào sổ này)
 */
export async function kiemSoDaCap(
  page: Page,
  ghi: GhiChu,
  a: { tenSo: string; maSo: string; soNhan: string; daCapDenTruoc: number; moiTao: boolean; soCapTiepTheo: number },
): Promise<string> {
  const so = soThuTu(a.soNhan);
  if (a.moiTao) {
    expect(so, `Sổ "${a.tenSo}" mới tạo với Số cấp tiếp theo ${a.soCapTiepTheo} nhưng văn bản nhận ${a.soNhan}`).toBe(a.soCapTiepTheo);
  } else {
    expect(so, `Số ${a.soNhan} không lớn hơn "Đã cấp đến số" ${a.daCapDenTruoc} của sổ "${a.tenSo}"`).toBeGreaterThan(a.daCapDenTruoc);
  }

  await moManSoCapSo(page, ghi);
  const dong = (await timNhanh(page, a.tenSo)).filter({ hasText: a.tenSo }).first();
  await expect(dong).toBeVisible({ timeout: 30_000 });
  const sau = await daCapDen(dong);
  ghi('sổ sau khi lấy số', `"${a.tenSo}" đã cấp đến ${sau}`);
  expect(
    sau,
    `Văn bản nhận ${a.soNhan} nhưng sổ "${a.tenSo}" chỉ cấp đến ${sau} — số KHÔNG lấy từ sổ này ` +
      `(kiểm cấu hình tòa → D01 → DEFAULT của biểu mẫu)`,
  ).toBeGreaterThanOrEqual(so);
  return `${a.soNhan} ∈ ${a.maSo} "${a.tenSo}" (trước ${a.daCapDenTruoc}, sau ${sau})`;
}
