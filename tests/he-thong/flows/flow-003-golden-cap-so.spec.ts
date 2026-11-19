/**
 * FLOW HỆ THỐNG 003 — golden ngữ cảnh → sổ → số cho các điểm cấp số (Jira QLN-13201 · A8). Chỉ đọc.
 *
 *   npm run golden-cap-so:dev            # so với baseline data/he-thong/flow-003-golden-cap-so/golden/dev.json
 *   npm run golden-cap-so:dev:ghi        # GHI LẠI baseline (QLA_GOLDEN_GHI=1) — sau đó phải duyệt
 *   npm run golden-cap-so:ui             # Playwright UI
 */
import { khaiLuong } from '../../../khung/luong';
import { CAI_DAT } from '../../../flows/he-thong/flow-003-golden-cap-so/cai-dat';
import { FLOW_HT_003 } from '../../../flows/he-thong/flow-003-golden-cap-so/flow';
import { DS_CASE } from '../../../data/he-thong/flow-003-golden-cap-so/cases';

khaiLuong({ flow: FLOW_HT_003, dsCase: DS_CASE, caiDat: CAI_DAT, phut: 5 });
