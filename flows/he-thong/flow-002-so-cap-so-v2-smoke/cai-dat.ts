/**
 * FLOW HỆ THỐNG 002 · BẢNG CÀI ĐẶT: mã bước → thân (chỉ đọc).
 *
 * Bước 04–05 (TANDTC) chỉ được cài khi vai `quanTriTandtc` đã có CCCD trong
 * config/tai-khoan.dev.local.json; chưa có thì khung đánh `fixme` (không đỏ, không xanh giả).
 */
import { taiKhoan } from '../../../common/cau-hinh-luong';
import type { BangCaiDat } from '../../../khung/luong';
import type { INPUT } from '../../../data/he-thong/flow-002-so-cap-so-v2-smoke/case-001/input';
import { kiemChanDanhMuc, kiemMenuToaCapDuoi, moDanhMucTandtc, moSoDonVi } from './so-cap-so-v2.flow';

export type InputSoCapSoV2 = typeof INPUT;

const coTaiKhoan = (vai: string) => {
  try {
    return !!taiKhoan(vai).cccd;
  } catch {
    return false;
  }
};

const CAI_DAT_KV5: BangCaiDat<InputSoCapSoV2> = {
  '01-menu-kv5': async ({ page, ghi }) => ({ menuKv5: await kiemMenuToaCapDuoi(page, ghi) }),
  '02-so-don-vi-kv5': async ({ page, input, ghi }) => {
    const kq = await moSoDonVi(page, ghi, { maToa: input.maToaKv5, laToiCao: false });
    return { maToaKv5: kq.maToa, tabSoDonViKv5: kq.tab };
  },
  '03-chan-danh-muc-kv5': async ({ page, ghi }) => ({ chanDanhMucKv5: await kiemChanDanhMuc(page, ghi) }),
};

const CAI_DAT_TANDTC: BangCaiDat<InputSoCapSoV2> = {
  '04-danh-muc-tandtc': async ({ page, ghi }) => ({ tabDanhMucTandtc: await moDanhMucTandtc(page, ghi) }),
  '05-so-don-vi-tandtc': async ({ page, ghi }) => {
    const kq = await moSoDonVi(page, ghi, { laToiCao: true });
    return { phamViTandtc: `${kq.maToa} · xem ${kq.soToaXemDuoc} tòa · ${kq.tab}` };
  },
};

export const CAI_DAT: BangCaiDat<InputSoCapSoV2> = {
  ...CAI_DAT_KV5,
  ...(coTaiKhoan('quanTriTandtc') ? CAI_DAT_TANDTC : {}),
};
