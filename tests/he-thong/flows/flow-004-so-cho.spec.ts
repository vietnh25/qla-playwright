/**
 * FLOW HỆ THỐNG 004 — Sổ chờ (Jira QLN-13300). CÓ GHI dữ liệu thật trên DEV.
 *
 *   npm run so-cho:dev                         # CLI, toàn luồng
 *   node tools/chay-ui.js dev --ghi --cli --file=flow-004-so-cho --buoc=01..05
 */
import { khaiLuong } from '../../../khung/luong';
import { CAI_DAT } from '../../../flows/he-thong/flow-004-so-cho/cai-dat';
import { FLOW_HT_004 } from '../../../flows/he-thong/flow-004-so-cho/flow';
import { DS_CASE } from '../../../data/he-thong/flow-004-so-cho/cases';

/** Bước tự lấy số chạy bằng vai lấy số của case (case-002 lấy số tại TAND tối cao). */
const BUOC_LAY_SO = ['03-cap-vao-so-cho', '04-huy-cap-lai', '08-cap-khi-cho-duyet'];

khaiLuong({
  flow: FLOW_HT_004,
  dsCase: DS_CASE,
  caiDat: CAI_DAT,
  phut: 5,
  vai: (dn, input) => (input.vaiLaySo && BUOC_LAY_SO.includes(dn.ma) ? input.vaiLaySo : dn.vai),
});
