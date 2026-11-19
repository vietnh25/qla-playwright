/**
 * FLOW HỆ THỐNG 003 · BẢNG CÀI ĐẶT (chỉ đọc).
 * Bước 04 (tiêu chí 13) CỐ Ý chưa cài: phải cấp số thật → khung đánh `fixme` cho tới khi user chốt điểm/văn bản.
 */
import { test } from '@playwright/test';
import type { BangCaiDat } from '../../../khung/luong';
import type { INPUT } from '../../../data/he-thong/flow-003-golden-cap-so/case-001/input';
import { chayGolden, doiChieuMoiTruong, giuSoThatTieuChi13, kiemDiemCapSo, thuCapSoTieuChi13 } from './golden.flow';

export type InputGolden = typeof INPUT;

export const CAI_DAT: BangCaiDat<InputGolden> = {
  '01-diem-cap-so': async ({ page, input, ghi }) => ({
    dsDiemCapSo: await kiemDiemCapSo(page, ghi, input.dsDiemGolden),
  }),
  '02-golden-ngu-canh': async ({ page, input, ghi }) => {
    const kq = await chayGolden(page, ghi, input.nguCanh);
    return { ketQuaGolden: kq.tomTat };
  },
  '03-doi-chieu-moi-truong': async ({ ghi }) => {
    const kq = doiChieuMoiTruong(ghi);
    test.skip(!kq.coMoiTruongKhac, `D14 cần baseline của ít nhất 2 môi trường — hiện ${kq.tomTat}`);
    return { doiChieuMoiTruong: kq.tomTat };
  },
  '04-thu-cap-so-kv5': async ({ page, input, ghi }) => {
    const ds = await thuCapSoTieuChi13(page, ghi, input.tieuChi13);
    return { dsDuKienKv5: JSON.stringify(ds) };
  },
  '05-giu-so-that-kv5': async ({ page, input, ghi, can }) => {
    const kq = await giuSoThatTieuChi13(page, ghi, input.tieuChi13, JSON.parse(can('dsDuKienKv5')));
    return { tieuChi13Kv5: kq.khop };
  },
};
