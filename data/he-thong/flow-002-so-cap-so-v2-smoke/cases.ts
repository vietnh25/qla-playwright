/** FLOW HỆ THỐNG 002 · DANH SÁCH CASE (thêm tòa = thêm case, không thêm file spec) */
import type { CaseChay } from '../../../khung/luong';
import type { InputSoCapSoV2 } from '../../../flows/he-thong/flow-002-so-cap-so-v2-smoke/cai-dat';
import { DD as DD_001, INPUT as INPUT_001 } from './case-001/input';

export const DS_CASE: CaseChay<InputSoCapSoV2>[] = [{ dd: DD_001, input: INPUT_001 }];
