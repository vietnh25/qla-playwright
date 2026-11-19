/**
 * FLOW HỆ THỐNG 001 · DANH SÁCH CASE. Thêm tòa = thêm một case (input.ts với vaiSoTham khác),
 * không thêm file spec.
 */
import type { CaseChay } from '../../../khung/luong';
import type { InputCapSo } from '../../../flows/he-thong/flow-001-cap-so-tu-dong/cai-dat';
import { DD as DD_001, INPUT as INPUT_001 } from './case-001/input';

export const DS_CASE: CaseChay<InputCapSo>[] = [{ dd: DD_001, input: INPUT_001 }];
