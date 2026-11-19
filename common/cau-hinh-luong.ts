/**
 * Đọc cấu hình luồng GĐT/TT từ config/luong-gdt.json (tài khoản, tên người, giá trị nghiệp vụ).
 * Đổi dữ liệu chỉ cần sửa JSON, không phải sửa test.
 *
 * Thứ tự ưu tiên:
 *   1. Biến môi trường (QLA_TKM_USER, QLA_TKM_CVP_USER… — giữ tương thích với cách cũ)
 *   2. config/luong-gdt.<env>.json   (ghi đè theo môi trường: dev / stg / uat)
 *   3. config/tai-khoan.local.json   (CCCD/mật khẩu từng vai — không commit, mẫu tai-khoan.example.json)
 *   4. config/luong-gdt.json
 * Tài khoản được gộp theo từng vai (tầng sau chỉ ghi đè trường nó khai).
 */
import fs from 'fs';
import path from 'path';

export interface TaiKhoanCauHinh {
  cccd: string;
  ten: string;
  vaiTro?: string;
  /** Bỏ trống → Ta@<cccd> */
  matKhau?: string;
  /** "form" = đăng nhập bằng form riêng của /qla/login (mật khẩu QLA); bỏ trống = SSO (common/login.ts) */
  dangNhap?: "sso" | "form";
  /**
   * Vai trò cần chọn trong hộp "Xác nhận thông tin làm việc" khi tài khoản có nhiều vai trò ở tòa đó
   * (khớp một phần nhãn, không phân biệt hoa thường). Bỏ trống → chọn mục đầu.
   */
  chonVaiTro?: string;
}

export interface CauHinhLuong {
  taiKhoan: Record<string, TaiKhoanCauHinh>;
  nghiepVu: Record<string, string | string[]>;
}

const THU_MUC = path.resolve(__dirname, '../config');

const docJson = (ten: string): Partial<CauHinhLuong> => {
  const f = path.join(THU_MUC, ten);
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    throw new Error(`Cấu hình ${f} không phải JSON hợp lệ: ${e}`);
  }
};

let boNho: CauHinhLuong | undefined;

export function cauHinhLuong(): CauHinhLuong {
  if (boNho) return boNho;
  const env = process.env.QLA_ENV || 'stg';
  /**
   * Bốn lớp, lớp sau ghi đè lớp trước:
   *   1. `luong-gdt.json`                 — giá trị nghiệp vụ dùng chung, COMMIT
   *   2. `tai-khoan.local.json`           — CCCD/mật khẩu từng vai (STG), KHÔNG commit
   *   3. `tai-khoan.<env>.local.json`     — tài khoản RIÊNG của môi trường, KHÔNG commit
   *   4. `luong-gdt.<env>.json`           — giá trị nghiệp vụ riêng môi trường, COMMIT
   *
   * Lớp 3 thêm ngày 04/10/2026 khi mở môi trường pre-prod: tài khoản pre-prod là bộ khác hẳn STG,
   * mà lớp 4 là tệp ĐƯỢC COMMIT (`.gitignore` chỉ bỏ qua `config/*.local.json`) — nhét CCCD vào đó
   * là đẩy số định danh thật lên repo công khai.
   */
  const cacTang = [
    docJson('luong-gdt.json'),
    docJson('tai-khoan.local.json'),
    docJson(`tai-khoan.${env}.local.json`),
    docJson(`luong-gdt.${env}.json`),
  ];
  const taiKhoan: Record<string, TaiKhoanCauHinh> = {};
  for (const t of cacTang) {
    for (const [vai, v] of Object.entries(t.taiKhoan || {})) taiKhoan[vai] = { ...taiKhoan[vai], ...v };
  }
  boNho = {
    taiKhoan,
    nghiepVu: Object.assign({}, ...cacTang.map((t) => t.nghiepVu || {})),
  };
  return boNho;
}

/** Một giá trị nghiệp vụ (tên người ký, kết quả giải quyết…); thiếu thì báo lỗi rõ ràng */
export function giaTri(khoa: string): string {
  const v = cauHinhLuong().nghiepVu[khoa];
  if (typeof v !== 'string' || !v) throw new Error(`Thiếu "nghiepVu.${khoa}" trong config/luong-gdt.json`);
  return v;
}

/** Danh sách giá trị nghiệp vụ (vd. các biểu mẫu hội đồng xét xử) */
export function danhSach(khoa: string): string[] {
  const v = cauHinhLuong().nghiepVu[khoa];
  if (!Array.isArray(v)) throw new Error(`"nghiepVu.${khoa}" trong config/luong-gdt.json phải là mảng`);
  return v;
}

/**
 * Tài khoản theo vai. Biến môi trường (nếu có) được ưu tiên để giữ tương thích với .env.* hiện tại.
 *   canBo → QLA_TKM_USER | chanhVanPhong → QLA_TKM_CVP_USER | phoChanhAn → QLA_TKM_PCA_USER
 *   chanhAn → QLA_TKM_CHANHAN_USER | thuKyVu → QLA_TKM_THUKY_USER
 *   vuTruong → QLA_TKM_VU_USER | thamTraVien → QLA_TKM_TTV_USER
 */
const BIEN_ENV: Record<string, string> = {
  canBo: 'QLA_TKM_USER',
  chanhVanPhong: 'QLA_TKM_CVP_USER',
  phoChanhAn: 'QLA_TKM_PCA_USER',
  chanhAn: 'QLA_TKM_CHANHAN_USER',
  thuKyVu: 'QLA_TKM_THUKY_USER',
  vuTruong: 'QLA_TKM_VU_USER',
  thamTraVien: 'QLA_TKM_TTV_USER',
};

export function taiKhoan(vai: string): TaiKhoanCauHinh {
  const tu = cauHinhLuong().taiKhoan[vai];
  const bien = BIEN_ENV[vai];
  const cccdEnv = bien ? process.env[bien] : undefined;
  const cccd = cccdEnv || tu?.cccd;
  if (!cccd) {
    throw new Error(`Thiếu tài khoản cho vai "${vai}": khai trong config/tai-khoan.local.json hoặc biến ${bien || 'QLA_TKM_*'}`);
  }
  const matKhau = (bien && process.env[`${bien.replace(/_USER$/, '')}_PASS`]) || tu?.matKhau || `Ta@${cccd}`;
  return { cccd, ten: tu?.ten || '', vaiTro: tu?.vaiTro, matKhau, dangNhap: tu?.dangNhap, chonVaiTro: tu?.chonVaiTro };
}

/** Các vai khai trong cấu hình (dùng để đăng nhập sẵn) */
export const dsVai = () => Object.keys(cauHinhLuong().taiKhoan);
