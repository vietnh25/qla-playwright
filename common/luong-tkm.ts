/**
 * Hạ tầng cho luồng "Luồng nhập data.txt" Bước 3–9: mỗi vai một phiên riêng, trạng thái giữa các
 * bước lưu ra file riêng (không dùng chung .run-state.json của luồng xuyên suốt cũ).
 */
import { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { VAI_TKM, VaiTKM, authFileVaiTKM, credentialsVaiTKM } from '../account';
import { taiKhoan } from './cau-hinh-luong';
import { ghiNhanToast } from './antd';
import { boMocThaoTacCu, laTrangDangNhap, loginSSO } from './login';
import { khungMenu } from './menu';
import { veTrangChu } from './vai';

/**
 * Trợ lý ảo nổi ở góc phải dưới che các nút ở cuối màn (vd. "Lưu mới" của đơn kháng cáo 24-HC):
 * lớp kéo-thả #qla-tro-ly-ao-lop-keo có z-index 10000 và pointer-events auto nên hứng hết click.
 * Ẩn đúng ba phần tử mà chính app đã ẩn khi in (styles/global.css, @media print).
 */
async function anTroLyAo(context: BrowserContext) {
  await context.addInitScript(() => {
    const CSS = '#botplatform_iframe,#chat-box-container,#qla-tro-ly-ao-lop-keo{display:none !important}';
    const dat = () => {
      if (!document.head || document.getElementById('pw-an-tro-ly-ao')) return;
      const the = document.createElement('style');
      the.id = 'pw-an-tro-ly-ao';
      the.textContent = CSS;
      document.head.appendChild(the);
    };
    dat();
    document.addEventListener('DOMContentLoaded', dat);
  });
}

/** Mở "tab trình duyệt" riêng cho một vai; phiên hết hạn thì tự đăng nhập lại và lưu lại */
export async function moTrangVaiTKM(browser: Browser, testInfo: TestInfo, vai: VaiTKM): Promise<{ page: Page; context: BrowserContext }> {
  const cred = credentialsVaiTKM(vai);
  if (!cred) throw new Error(`Thiếu tài khoản ${VAI_TKM[vai]} trong e2e/.env.${process.env.QLA_ENV || 'stg'}`);
  const use = testInfo.project.use;
  const file = authFileVaiTKM(vai);
  const context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport ?? { width: 1600, height: 900 },
    locale: use.locale,
    timezoneId: use.timezoneId,
    ignoreHTTPSErrors: true,
    storageState: fs.existsSync(file) ? file : undefined,
  });
  context.setDefaultTimeout(use.actionTimeout || 30_000);
  await anTroLyAo(context);
  await boMocThaoTacCu(context);
  const page = await context.newPage();
  await ghiNhanToast(page);
  await veTrangChu(page);
  if (laTrangDangNhap(page.url())) {
    await loginSSO(page, cred.user, { pass: cred.pass });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await context.storageState({ path: file });
  }
  return { page, context };
}

/** Trạng thái nối giữa các bước (mã đơn, số thụ lý, khoá phê duyệt…) theo từng môi trường */
const FILE = () => path.resolve(__dirname, `../.run-state-tkm.${process.env.QLA_ENV || 'stg'}.json`);

export interface TrangThaiTKM {
  maDon?: string;
  soThuLy?: string;
  nguoiDungDon?: string;
  thamPhan?: string;
  khoaToTrinh?: string;
  khoaThongBao?: string;
  [k: string]: string | undefined;
}

export const docTrangThaiTKM = (): TrangThaiTKM => (fs.existsSync(FILE()) ? JSON.parse(fs.readFileSync(FILE(), 'utf8')) : {});

export function ghiTrangThaiTKM(them: TrangThaiTKM) {
  const moi = { ...docTrangThaiTKM(), ...them };
  fs.writeFileSync(FILE(), JSON.stringify(moi, null, 2));
  return moi;
}

/**
 * Mở "tab trình duyệt" cho một vai khai trong config/luong-gdt.json (canBo, chanhVanPhong,
 * phoChanhAn, chanhAn, thuKyVu, vuTruong, thamTraVien). Session lưu riêng theo vai + môi trường.
 */
export async function moTrangVaiCauHinh(browser: Browser, testInfo: TestInfo, vai: string): Promise<{ page: Page; context: BrowserContext }> {
  const tk = taiKhoan(vai);
  const use = testInfo.project.use;
  const file = path.resolve(__dirname, `../playwright/.auth/ch-${vai}.${process.env.QLA_ENV || 'stg'}.json`);
  const context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport ?? { width: 1600, height: 900 },
    locale: use.locale,
    timezoneId: use.timezoneId,
    ignoreHTTPSErrors: true,
    storageState: fs.existsSync(file) ? file : undefined,
  });
  context.setDefaultTimeout(use.actionTimeout || 30_000);
  await anTroLyAo(context);
  await boMocThaoTacCu(context);
  const page = await context.newPage();
  await ghiNhanToast(page);
  await veTrangChu(page);
  if (laTrangDangNhap(page.url())) {
    await loginSSO(page, tk.cccd, { pass: tk.matKhau, cachDangNhap: tk.dangNhap });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await context.storageState({ path: file });
  }
  await chonNguCanhLamViec(page, vai);
  return { page, context };
}

/**
 * HỘP "Chọn đơn vị và vai trò làm việc" — phải trả lời thì phiên mới có ngữ cảnh làm việc.
 *
 * Tài khoản có NHIỀU đơn vị hoặc nhiều vai trò thì `app.tsx` bật `WorkContextSelector` ngay sau khi
 * vào app (tiêu đề "Chọn đơn vị và vai trò làm việc", hoặc "Chọn vai trò làm việc" khi chỉ một đơn
 * vị). Chưa chọn thì MỌI cú lưu bị máy chủ từ chối với đúng câu đó — kịch bản báo "Chờ 'Lưu văn bản
 * thành công' nhưng gặp lỗi: Vui lòng chọn đơn vị và vai trò làm việc" (đo 03/10/2026, KDTM bước 26).
 *
 * Chọn MỤC ĐẦU của từng ô rồi "Tiếp tục" — tất định, và ghi ra log để biết phiên đang ở ngữ cảnh nào.
 * (Vai trò quyết định quyền chức năng và phạm vi dữ liệu, nên dòng log này là dữ kiện cần khi một
 * bước báo thiếu quyền.)
 */
export async function chonNguCanhLamViec(page: Page, vai = ''): Promise<void> {
  /**
   * Tiêu đề hộp đổi theo bản FE: cũ "Chọn (đơn vị và) vai trò làm việc", mới "Xác nhận thông tin làm việc"
   * (qla-webapp 7343a69204 · components/WorkContextSelector/index.tsx; đo STG 09/11/2026, TK thư ký KV5 Bắc Ninh).
   */
  const hop = page
    .locator('.ant-modal')
    .filter({ hasText: /Chọn (đơn vị và )?vai trò làm việc|Xác nhận thông tin làm việc/ })
    .first();
  // isVisible() KHÔNG chờ: hộp hiện sau khi app gọi xong danh sách ngữ cảnh → chờ MENU hoặc HỘP, cái nào tới trước
  const toi = await Promise.race([
    hop.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'hop' as const),
    khungMenu(page).waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'menu' as const),
  ]).catch(() => 'khong' as const);
  if (toi !== 'hop') return;

  let chonVaiTro: string | undefined;
  try {
    chonVaiTro = vai ? taiKhoan(vai).chonVaiTro : undefined;
  } catch {
    chonVaiTro = undefined;
  }

  // Ô đang khoá (tòa đã chọn sẵn vì chỉ có một tòa) thì bỏ qua
  const dsO = hop.locator('.ant-select:not(.ant-select-disabled) [role="combobox"]');
  const daChon: string[] = [];
  const soO = await dsO.count();
  for (let i = 0; i < soO; i++) {
    const laOVaiTro = i === soO - 1; // ô cuối luôn là vai trò (FE: tòa trước, vai trò sau)
    await dsO.nth(i).click().catch(() => undefined);
    const dsMuc = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    await dsMuc.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
    const nhan = (await dsMuc.allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    let idx = 0;
    if (laOVaiTro && chonVaiTro) {
      idx = nhan.findIndex(t => t.toLowerCase().includes(chonVaiTro!.toLowerCase()));
      if (idx < 0) {
        throw new Error(
          `Hộp "${(await hop.locator('.ant-modal-title, h4').first().innerText().catch(() => ''))}" không có vai trò ` +
            `"${chonVaiTro}" (config chonVaiTro của vai ${vai}). Vai trò đang có: ${nhan.join(' | ') || '(trống)'}`,
        );
      }
    }
    if (nhan.length) {
      daChon.push(nhan[idx].slice(0, 60));
      await dsMuc.nth(idx).click().catch(() => undefined);
    }
    await page.waitForTimeout(400);
  }
  await hop.getByRole('button', { name: /Tiếp tục/ }).first().click().catch(() => undefined);
  if (!(await hop.waitFor({ state: 'hidden', timeout: 20_000 }).then(() => true).catch(() => false))) {
    throw new Error(
      `Hộp chọn ngữ cảnh làm việc vẫn mở sau khi bấm "Tiếp tục" (vai ${vai || '?'}, đã chọn: ${daChon.join(' / ') || 'không ô nào'}). ` +
        `Khai "chonVaiTro" cho vai này trong config/tai-khoan*.local.json.`,
    );
  }
  console.log(`    · ngữ cảnh làm việc${vai ? ` (${vai})` : ''}: ${daChon.join(' / ') || '(tòa, vai trò chọn sẵn)'}`);
}
