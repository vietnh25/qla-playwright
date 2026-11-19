/** FLOW HỆ THỐNG 004 · DANH SÁCH CASE */
import type { CaseChay } from '../../../khung/luong';
import type { InputSoCho } from '../../../flows/he-thong/flow-004-so-cho/cai-dat';
import { DD as DD_001, INPUT as INPUT_001 } from './case-001/input';
import { DD as DD_002, INPUT as INPUT_002 } from './case-002/input';

export const DS_CASE: CaseChay<InputSoCho>[] = [
  { dd: DD_001, input: INPUT_001 },
  { dd: DD_002, input: INPUT_002 },
];
