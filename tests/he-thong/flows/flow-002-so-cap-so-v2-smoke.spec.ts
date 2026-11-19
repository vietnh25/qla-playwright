/**
 * FLOW HỆ THỐNG 002 — sổ cấp số v2 (QLN-13171): smoke quyền + mở màn, CHỈ ĐỌC, chỉ chạy trên DEV.
 *
 *   npm run so-cap-so-v2:dev           # chạy nền
 *   npm run so-cap-so-v2:dev:headed    # mở trình duyệt để xem
 */
import { khaiLuong } from '../../../khung/luong';
import { CAI_DAT } from '../../../flows/he-thong/flow-002-so-cap-so-v2-smoke/cai-dat';
import { FLOW_HT_002 } from '../../../flows/he-thong/flow-002-so-cap-so-v2-smoke/flow';
import { DS_CASE } from '../../../data/he-thong/flow-002-so-cap-so-v2-smoke/cases';

khaiLuong({ flow: FLOW_HT_002, dsCase: DS_CASE, caiDat: CAI_DAT, phut: 5 });
