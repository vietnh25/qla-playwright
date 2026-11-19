/** FLOW HỆ THỐNG 003 · DANH SÁCH CASE */
import type { CaseChay } from '../../../khung/luong';
import type { InputGolden } from '../../../flows/he-thong/flow-003-golden-cap-so/cai-dat';
import { DD as DD_001, INPUT as INPUT_001 } from './case-001/input';

export const DS_CASE: CaseChay<InputGolden>[] = [{ dd: DD_001, input: INPUT_001 }];
