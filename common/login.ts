import { BrowserContext, Page, expect } from '@playwright/test';
import { ORIGIN } from '../playwright.config';
import { matKhauMacDinh } from '../account';

export { matKhauMacDinh };

export const DASHBOARD_URL = () => `${ORIGIN}/qla/dashboard`;

/** Chỉ tính dashboard đúng môi trường (QLA_ENV), không nhận nhầm qla-stg khi đang chạy dev */
const LA_DASHBOARD = { test: (u: string) => u.startsWith(`${ORIGIN}/qla/dashboard`) };
/**
 * Trang đăng nhập CỦA QLA (trước khi sang WSO2). Có HAI dạng:
 *   · cũ  `/qla/sso/login`
 *   · mới `/qla/login?redirect=…` — giao diện "Xác thực người dùng / Đăng nhập" có ô tên + mật khẩu và
 *     nút "Đăng nhập với Tòa án tối cao SSO". Bằng chứng: bundle STG `/qla/assets/index-BAtJArLm.js`
 *     (05/11/2026) khai `const h1="/login"` và hết phiên thì `window.location.replace(qa("/login")…)`.
 * Chỉ khớp `/sso/login` thì phiên hết hạn KHÔNG được đăng nhập lại: test đứng ở trang đăng nhập
 * rồi báo "Không thấy menu bên trái" sau 60 s (đo 05/11/2026, cap-so bước 01).
 */
const LA_SSO_LOCAL = /\/sso\/login|\/qla\/login(\?|$|\/)/;
/**
 * Trang đăng nhập WSO2. Ngoài host SSO của STG/DEV/UAT còn nhận theo ĐƯỜNG DẪN của WSO2
 * (/authenticationendpoint/, /oauth2/authorize) vì pre-prod (e-qlta-uat) có thể dùng host SSO khác:
 * qla/k8s/pre-prod/application-pre-prod.yml:51-60 lấy client-id/redirect-uri từ biến môi trường,
 * không hardcode sso.toaan.gov.vn như các môi trường còn lại.
 */
const LA_SSO_WSO2 = /sso\.toaan\.gov\.vn|\/authenticationendpoint\/|\/oauth2\/authorize/;
/**
 * BỎ MỐC "THAO TÁC CUỐI" CŨ khi nạp lại phiên đã lưu (storageState).
 *
 * App có tính năng tự đăng xuất sau 30 phút không thao tác. Bằng chứng: bundle STG
 * `/qla/assets/index-BuXrf_vF.js` (05/11/2026) khai `J1="qla:thao-tac-cuoi"`, `uV=30` phút. Lúc
 * mount, app làm như sau:
 *   `if (A.luc>0 && Date.now()-A.luc>=C4 && A.phien===$B()) { _(); return }`
 *   → `_()` gọi `ei()` → `DELETE /qtud/api/v1/work-context/current` + `POST /session/oauth2/logout`.
 * storageState lưu cả localStorage, nên mốc thao tác cuối của LẦN CHẠY TRƯỚC đi theo phiên. Chạy lại
 * sau hơn 30 phút thì app tự đăng xuất ~2 s sau khi vào dashboard. Lúc đó khung đã mở phiên xong nên
 * không đăng nhập lại, và bước báo "Không thấy menu bên trái" (trace 05/11/2026: mốc 10:02:11Z,
 * đăng xuất 10:34:11Z, đúng 32 phút sau).
 *
 * Chỉ xoá mốc MỘT LẦN cho mỗi tab, ở lần tải đầu (cờ sessionStorage). Sau đó app tự ghi mốc mới, và
 * tính năng tự đăng xuất khi không thao tác vẫn chạy bình thường trong lúc test.
 */
export async function boMocThaoTacCu(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      if (sessionStorage.getItem('pw-da-bo-moc-thao-tac')) return;
      sessionStorage.setItem('pw-da-bo-moc-thao-tac', '1');
      localStorage.removeItem('qla:thao-tac-cuoi');
    } catch {
      /* trang khác origin (SSO) không có localStorage của QLA — bỏ qua */
    }
  });
}

/** URL đang là trang đăng nhập (QLA cũ/mới hoặc WSO2) → phiên đã hết, phải gọi loginSSO */
export const laTrangDangNhap = (url: string) => LA_SSO_LOCAL.test(url) || LA_SSO_WSO2.test(url);

/** Lỗi 3.1: callback trả JSON {"error":"invalid_request",...} */
const LA_CALLBACK_LOI = /\/qla\/api\/v1\/session\/oauth2\/callback/;

export interface LoginOptions {
  /** Bỏ trống → Ta@<user> */
  pass?: string;
  /** Số lần thử lại khi callback lỗi / bị đá về /sso/login (mặc định 3) */
  soLanThu?: number;
  /**
   * Cách đăng nhập trên trang /qla/login:
   *   'sso'  (mặc định) bấm "Đăng nhập với Tòa án tối cao SSO" → form WSO2 sso.toaan.gov.vn
   *   'form' gõ thẳng vào "Tên đăng nhập" / "Mật khẩu" của chính trang QLA rồi bấm "Đăng nhập"
   * Hai cách dùng MẬT KHẨU KHÁC NHAU: đo dev 09/11/2026, TK 0241990xxxxx đăng nhập tay bằng form
   * được nhưng cùng mật khẩu đó qua SSO thì WSO2 trả authFailure (3 lần). Khai theo tài khoản
   * (`dangNhap` trong config/tai-khoan*.local.json) — KHÔNG thử lần lượt cả hai cách: mỗi lần sai
   * đều cộng vào bộ đếm khoá tài khoản (khoá sau 5 lần).
   */
  cachDangNhap?: 'sso' | 'form';
}

/** Form đăng nhập riêng của trang /qla/login (giao diện mới, 05/11/2026) — trả true nếu đã rời trang đăng nhập */
async function dangNhapBangForm(page: Page, user: string, pass: string) {
  const oTen = page.getByRole('textbox', { name: 'Tên đăng nhập' });
  await expect(oTen, 'Trang đăng nhập không có form "Tên đăng nhập" (dangNhap: "form" trong config)').toBeVisible({
    timeout: 30_000,
  });
  await oTen.fill(user);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(pass);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const thongBaoLoi = page.locator('.ant-message-error, .ant-alert-error, .ant-form-item-explain-error, [role="alert"]').first();
  await Promise.race([
    page.waitForURL(u => !LA_SSO_LOCAL.test(u.href), { timeout: 60_000 }),
    thongBaoLoi.waitFor({ state: 'visible', timeout: 60_000 }),
  ]).catch(() => undefined);
  if (LA_SSO_LOCAL.test(page.url())) {
    const loi = (await thongBaoLoi.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    // Ném ngay, KHÔNG thử lại: thử lại là cộng thêm lần sai vào bộ đếm khoá tài khoản
    throw new Error(`Đăng nhập bằng form thất bại cho tài khoản ${user}: ${loi || '(không đọc được thông báo)'} — URL ${page.url()}`);
  }
}

/**
 * Đăng nhập SSO cho một tài khoản bất kỳ, kết thúc ở /qla/dashboard.
 * 1. Vào /qla/dashboard → hệ thống chuyển về /sso/login
 * 2. Bấm "Đăng nhập với Tòa án tối cao SSO" → sso.toaan.gov.vn (WSO2), nhập usernameUserInput/password
 * 3. Callback về /qla/dashboard; nếu rơi vào lỗi callback OAuth2 (invalid_request) thì tự chuyển về dashboard
 */
export async function loginSSO(page: Page, user: string, opts: LoginOptions = {}) {
  const pass = opts.pass || matKhauMacDinh(user);
  const soLanThu = opts.soLanThu ?? 5;

  await page.goto(DASHBOARD_URL());

  for (let lan = 1; lan <= soLanThu; lan++) {
    await page.waitForURL(u => [LA_DASHBOARD, LA_SSO_LOCAL, LA_SSO_WSO2, LA_CALLBACK_LOI].some(r => r.test(u.href)), {
      timeout: 60_000,
    });
    const url = page.url();

    if (LA_SSO_LOCAL.test(url) && opts.cachDangNhap === 'form') {
      // Trang cũ /sso/login không có form riêng → về /qla/login (giao diện mới) để dùng form
      if (!/\/qla\/login/.test(url)) await page.goto(`${ORIGIN}/qla/login?redirect=%2Fdashboard`);
      await dangNhapBangForm(page, user, pass);
    } else if (LA_SSO_LOCAL.test(url)) {
      /**
       * CÚ BẤM NÀY HAY TREO — và trước đây nó giết cả lượt chạy.
       *
       * `click()` tự chờ "scheduled navigations to finish"; SSO chập thì nó đứng tới hết giờ rồi NÉM
       * RA NGOÀI vòng `for`, nên `soLanThu` không có tác dụng: lượt chạy rụng ở một bước giữa chừng
       * chỉ vì mở phiên cho vai mới (đo 03/10/2026: hỏng ở bước 27 rồi bước 31, cùng một chỗ).
       * Giờ: hạn giờ ngắn, NUỐT lỗi, rồi tự chờ URL rời trang SSO; không rời được thì quay lại
       * dashboard để vòng sau thử lại từ đầu.
       */
      await page
        .getByRole('button', { name: /Đăng nhập với Tòa án tối cao SSO/ })
        .click({ timeout: 20_000 })
        .catch(() => undefined);
      // Phiên WSO2 còn hiệu lực thì WSO2 trả thẳng về callback, không hiện form
      const daRoiSso = await page
        .waitForURL(u => !LA_SSO_LOCAL.test(u.href), { timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (!daRoiSso) {
        /**
         * Bấm mà không rời được /sso/login: thường do phiên WSO2 cũ còn trong cookie và trang SSO cục
         * bộ quay vòng. Dọn cookie rồi vào lại từ đầu — không dọn thì thử bao nhiêu vòng cũng y hệt
         * (đo 03/10/2026: tài khoản 034179003391 hỏng cả 3 vòng, URL cuối vẫn /sso/login).
         */
        await page.context().clearCookies().catch(() => undefined);
        await page.goto(DASHBOARD_URL()).catch(() => undefined);
        continue;
      }
    }

    if (LA_SSO_WSO2.test(page.url())) {
      await page.locator('#usernameUserInput').fill(user);
      await page.locator('#password').fill(pass);
      await page.locator('#password').press('Enter');
      await page.waitForURL(u => !LA_SSO_WSO2.test(u.href) || /authFailure=true/.test(u.href), { timeout: 60_000 });
      if (/authFailure=true/.test(page.url())) {
        throw new Error(`Đăng nhập SSO thất bại cho tài khoản ${user} (sai tài khoản/mật khẩu?)`);
      }
    }

    // Lỗi 3.1: callback OAuth2 trả JSON lỗi → tự chuyển về dashboard
    if (LA_CALLBACK_LOI.test(page.url())) {
      await page.goto(DASHBOARD_URL());
    }

    // Chờ ổn định: nếu phiên chưa có, app sẽ đá về /sso/login → thử lại vòng sau
    await page.waitForURL(u => LA_DASHBOARD.test(u.href) || LA_SSO_LOCAL.test(u.href) || LA_SSO_WSO2.test(u.href), {
      timeout: 60_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    if (LA_DASHBOARD.test(page.url())) {
      await expect(page).toHaveURL(DASHBOARD_URL());
      return;
    }
  }
  throw new Error(`Không vào được ${DASHBOARD_URL()} sau ${soLanThu} lần thử (tài khoản ${user}), URL cuối: ${page.url()}`);
}
