/**
 * FLOW HỆ THỐNG 001 — cấu hình sổ cấp số rồi kiểm cấp số tự động (một file cho cả luồng).
 *
 *   npm run cap-so:stg:ui     # Playwright UI, có ghi dữ liệu thật trên STG
 *   npm run cap-so:stg        # chạy nền
 *   node tools/lineage.js he-thong/flow-001-cap-so-tu-dong
 */
import { khaiLuong } from '../../../khung/luong';
import { CAI_DAT } from '../../../flows/he-thong/flow-001-cap-so-tu-dong/cai-dat';
import { FLOW_HT_001 } from '../../../flows/he-thong/flow-001-cap-so-tu-dong/flow';
import { DS_CASE } from '../../../data/he-thong/flow-001-cap-so-tu-dong/cases';

khaiLuong({
  flow: FLOW_HT_001,
  dsCase: DS_CASE,
  caiDat: CAI_DAT,
  // 'cauHinhSo' → tài khoản cấu hình; 'chanhAn' của các bước dùng lại → chánh án tòa sơ thẩm
  vai: (buoc, input) =>
    buoc.vai === 'cauHinhSo' ? input.vaiCauHinhSo : buoc.vai === 'chanhAn' ? input.vaiSoTham : buoc.vai,
});
