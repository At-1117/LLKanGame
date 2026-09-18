// diagrams.js — 生成作品集所需图表（SVG → PNG）
const { Resvg } = require('@resvg/resvg-js');

const FONT = 'Microsoft YaHei';

function render(svg, width) {
  const r = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: width } });
  return r.render().asPng();
}

function box(x, y, w, h, fill, stroke, rx = 14) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}
function text(x, y, s, size, fill = '#333', weight = 'normal', anchor = 'middle') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" font-family="${FONT}">${s}</text>`;
}
function line(x1, y1, x2, y2, color = '#666', width = 2.5, dash = '') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#arrow)"/>`;
}
function diamond(cx, cy, w, h, fill = '#FFF3CD', stroke = '#D9A13B') {
  return `<polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}
const ARROW_DEFS = `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#666"/></marker><marker id="arrowR" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#C62828"/></marker></defs>`;

// ============ 1. 格子状态机图 ============
function stateMachineSVG() {
  const W = 1500, H = 780;
  const bw = 250, bh = 96, ry1 = 160, ry2 = 460;
  const xs = [80, 430, 780, 1130];
  const labels = {
    l1: '消除相邻格子后解锁',
    l2: '玩家点击',
    l3: '配对成功',
    l4: '动画完成',
    l5: '取消选中 / 配对失败',
  };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ARROW_DEFS}`;
  s += box(0, 0, W, H, '#FAFBFD', '#E3E8F0', 0);
  s += text(W / 2, 52, '「消除解锁扩散」格子状态机（State Machine）', 34, '#1F3864', '700');
  s += text(W / 2, 92, '棋盘上的每个格子在同一时刻只处于一种状态，状态转换由玩家操作与游戏规则驱动', 20, '#666');

  // Row1: LOCKED → UNLOCKED → SELECTED
  s += box(xs[0], ry1, bw, bh, '#E0E0E0', '#757575');
  s += text(xs[0] + bw / 2, ry1 + 42, 'LOCKED', 24, '#424242', '700');
  s += text(xs[0] + bw / 2, ry1 + 68, '锁定（默认）', 18, '#616161');
  s += box(xs[1], ry1, bw, bh, '#C8E6C9', '#388E3C');
  s += text(xs[1] + bw / 2, ry1 + 42, 'UNLOCKED', 24, '#1B5E20', '700');
  s += text(xs[1] + bw / 2, ry1 + 68, '已解锁（可点击）', 18, '#2E7D32');
  s += box(xs[2], ry1, bw, bh, '#BBDEFB', '#1976D2');
  s += text(xs[2] + bw / 2, ry1 + 42, 'SELECTED', 24, '#0D47A1', '700');
  s += text(xs[2] + bw / 2, ry1 + 68, '选中（高亮）', 18, '#1565C0');
  // Row2: REMOVING → EMPTY
  s += box(xs[2], ry2, bw, bh, '#FFE0B2', '#EF6C00');
  s += text(xs[2] + bw / 2, ry2 + 42, 'REMOVING', 24, '#E65100', '700');
  s += text(xs[2] + bw / 2, ry2 + 68, '消除中（动画）', 18, '#EF6C00');
  s += box(xs[3], ry2, bw, bh, '#F5F5F5', '#9E9E9E');
  s += text(xs[3] + bw / 2, ry2 + 42, 'EMPTY', 24, '#616161', '700');
  s += text(xs[3] + bw / 2, ry2 + 68, '空格（终态）', 18, '#757575');

  // arrows row1
  s += line(xs[0] + bw, ry1 + 48, xs[1] - 4, ry1 + 48);
  s += text((xs[0] + bw + xs[1]) / 2, ry1 + 26, labels.l1, 17, '#2E7D32');
  s += line(xs[1] + bw, ry1 + 48, xs[2] - 4, ry1 + 48);
  s += text((xs[1] + bw + xs[2]) / 2, ry1 + 26, labels.l2, 17, '#1565C0');
  // arrow SELECTED -> REMOVING (down)
  s += line(xs[2] + bw / 2, ry1 + bh, xs[2] + bw / 2, ry2 - 4);
  s += text(xs[2] + bw / 2 + 40, (ry1 + bh + ry2) / 2, labels.l3, 17, '#EF6C00');
  // arrow REMOVING -> EMPTY (right)
  s += line(xs[2] + bw, ry2 + 48, xs[3] - 4, ry2 + 48);
  s += text((xs[2] + bw + xs[3]) / 2, ry2 + 26, labels.l4, 17, '#757575');
  // feedback arrow SELECTED -> UNLOCKED (curved back via polyline)
  s += `<path d="M ${xs[2]} ${ry1 + 20} C ${xs[2] + 120} ${ry1 - 60}, ${xs[1] + 60} ${ry1 - 60}, ${xs[1] + bw} ${ry1 + 20}" fill="none" stroke="#C62828" stroke-width="2.5" marker-end="url(#arrow)"/>`;
  s += text((xs[1] + bw + xs[2]) / 2 + 60, ry1 - 70, labels.l5, 17, '#C62828');

  s += text(60, H - 40, '说明：① 默认全部 LOCKED；② 消除一对格子后，其周围 8 方向（上/下/左/右 + 四斜角）的相邻 LOCKED 格子解锁为 UNLOCKED；', 18, '#555', '', 'start');
  s += text(60, H - 14, '③ SELECTED 在「配对成功」时进入消除流程，在「取消选中 / 配对失败」时回到 UNLOCKED；④ EMPTY 为终态，不再参与任何判定。', 18, '#555', '', 'start');
  s += `</svg>`;
  return render(s, 1500);
}

// ============ 2. 核心玩法流程图 ============
function flowchartSVG() {
  const W = 1560, H = 1720;
  const cx = 420; // main column center
  const bw = 240, bh = 64; // box
  const dw = 250, dh = 110; // diamond
  const rx2 = 1000, rw = 300; // right column
  const G = '#2E7D32', B = '#1565C0', R = '#C62828', O = '#EF6C00', N = '#757575', Y = '#D9A13B';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ARROW_DEFS}`;
  s += box(0, 0, W, H, '#FAFBFD', '#E3E8F0', 0);
  s += text(W / 2, 52, '「消除解锁扩散」核心玩法流程图', 34, '#1F3864', '700');
  s += text(W / 2, 88, '单次点击的处理链路：选择 → 配对 → 连通判定 → 消除 → 扩散 → 胜负结算', 20, '#666');

  const dtext = (x, y, t1, t2) => {
    s += text(x, y - 6, t1, 20, '#7A5B00', '700');
    if (t2) s += text(x, y + 22, t2, 17, '#7A5B00');
  };
  // 1 start
  s += box(cx - bw / 2, 120, bw, bh, '#C8E6C9', G);
  s += text(cx, 158, '玩家点击格子', 22, '#1B5E20', '700');
  // 2 diamond
  let y = 240;
  s += diamond(cx, y, dw, dh); dtext(cx, y, '游戏进行中？');
  s += line(cx, y + dh / 2, cx, y + dh / 2 + 34);
  // 3
  y += dh / 2 + 34 + dh / 2 + 14; // next diamond center
  // (compute sequential centers manually below)
  const centers = [];
  let cy = 300;
  const step = 165;
  for (let i = 0; i < 8; i++) { centers.push(cy); cy += step; }
  // centers: 判定1..判定6 + success1 + success2
  const d1 = centers[0], d2 = centers[1], d3 = centers[2], d4 = centers[3], d5 = centers[4];
  const bx1 = centers[5], bx2 = centers[6], d6 = centers[7];
  const d7 = d6 + step, bx3 = d7 + step;

  // diamond connectors (down)
  const connDown = (fromY, toY) => { s += line(cx, fromY + dh / 2, cx, toY - dh / 2); };
  connDown(240, d1);
  s += diamond(cx, d1, dw, dh); dtext(cx, d1, '格子可交互？', '已解锁 / 已选中');
  connDown(d1, d2);
  s += diamond(cx, d2, dw, dh); dtext(cx, d2, '首次选中？');
  connDown(d2, d3);
  s += diamond(cx, d3, dw, dh); dtext(cx, d3, '图案相同？');
  connDown(d3, d4);
  s += diamond(cx, d4, dw, dh); dtext(cx, d4, '路径连通？', '（≤2 个拐弯）');
  connDown(d4, bx1);
  s += box(cx - bw / 2, bx1 - bh / 2, bw, bh, '#BBDEFB', B);
  s += text(cx, bx1 - 2, '消除成功', 22, '#0D47A1', '700');
  s += text(cx, bx1 + 24, '连线特效 + 消除动画 + 步数-1', 17, '#1565C0');
  connDown(bx1, bx2);
  s += box(cx - bw / 2, bx2 - bh / 2, bw, bh, '#BBDEFB', B);
  s += text(cx, bx2 - 2, '8方向解锁扩散', 22, '#0D47A1', '700');
  s += text(cx, bx2 + 24, '周围相邻格子解锁 + 解锁动画', 17, '#1565C0');
  connDown(bx2, d6);
  s += diamond(cx, d6, dw, dh); dtext(cx, d6, '棋盘已清空？');
  connDown(d6, d7);
  s += diamond(cx, d7, dw, dh); dtext(cx, d7, '步数用完？');
  connDown(d7, bx3);
  s += box(cx - bw / 2, bx3 - bh / 2, bw, bh, '#C8E6C9', G);
  s += text(cx, bx3 - 2, '继续游戏', 22, '#1B5E20', '700');
  s += text(cx, bx3 + 24, '进入 PLAYING，等待下次点击', 17, '#2E7D32');

  // ---- right column branches ----
  const rbox = (y, t1, t2, fill, st) => {
    s += box(rx2, y - 34, rw, 68, fill, st);
    s += text(rx2 + rw / 2, y - 8, t1, 19, '#333', '700');
    if (t2) s += text(rx2 + rw / 2, y + 16, t2, 15, '#666');
  };
  // 2 no
  s += line(cx + dw / 2, 240, rx2 - 10, 240);
  s += text(cx + dw / 2 + 70, 228, '否', 19, R, '700');
  rbox(240, '忽略点击', '', '#EEEEEE', N);
  // 3 no
  s += line(cx + dw / 2, d1, rx2 - 10, d1);
  s += text(cx + dw / 2 + 70, d1 - 18, '否', 19, R, '700');
  rbox(d1, '忽略点击', '', '#EEEEEE', N);
  // 4 yes
  s += line(cx + dw / 2, d2, rx2 - 10, d2);
  s += text(cx + dw / 2 + 70, d2 - 18, '是', 19, G, '700');
  rbox(d2, '选中并高亮', '播放选中动画', '#C8E6C9', G);
  // 5 no
  s += line(cx + dw / 2, d3, rx2 - 10, d3);
  s += text(cx + dw / 2 + 70, d3 - 18, '否', 19, R, '700');
  rbox(d3, '配对失败', '震动 + 抖动 + 扣1步', '#FFCDD2', R);
  s += text(rx2 + rw / 2, d3 + 56, '（若步数用完 → 失败结算）', 15, R);
  // 6 no
  s += line(cx + dw / 2, d4, rx2 - 10, d4);
  s += text(cx + dw / 2 + 70, d4 - 18, '否', 19, R, '700');
  rbox(d4, '配对失败', '震动 + 抖动 + 扣1步', '#FFCDD2', R);
  // 7 yes
  s += line(cx + dw / 2, d6, rx2 - 10, d6);
  s += text(cx + dw / 2 + 70, d6 - 18, '是', 19, G, '700');
  rbox(d6, '通关', '评星 + 存档 + 胜利结算', '#C8E6C9', G);
  // 8 yes
  s += line(cx + dw / 2, d7, rx2 - 10, d7);
  s += text(cx + dw / 2 + 70, d7 - 18, '是', 19, R, '700');
  rbox(d7, '失败', '扣1心 + 失败结算弹窗', '#FFCDD2', R);

  // legend
  let lx = 60;
  s += text(lx, H - 60, '图例：', 18, '#333', '700');
  const legend = (x, fill, st, t) => {
    s += box(x, H - 96, 30, 24, fill, st, 4);
    s += text(x + 15, H - 78, t, 17, '#555', '', 'start');
  };
  s += box(lx + 40, H - 96, 30, 24, '#C8E6C9', G, 4); s += text(lx + 60, H - 78, '开始 / 成功 / 通关', 17, '#555', '', 'start');
  s += box(lx + 330, H - 96, 30, 24, '#FFF3CD', Y, 4); s += text(lx + 350, H - 78, '条件判定', 17, '#555', '', 'start');
  s += box(lx + 520, H - 96, 30, 24, '#FFCDD2', R, 4); s += text(lx + 540, H - 78, '失败 / 忽略', 17, '#555', '', 'start');
  s += box(lx + 720, H - 96, 30, 24, '#BBDEFB', B, 4); s += text(lx + 740, H - 78, '过程处理', 17, '#555', '', 'start');
  s += box(lx + 900, H - 96, 30, 24, '#EEEEEE', N, 4); s += text(lx + 920, H - 78, '无操作（忽略）', 17, '#555', '', 'start');
  s += text(lx, H - 28, '注：炸弹道具消除任意一对（不扣步数）；「解锁」技能可临时全盘解锁 5 秒；开局与局中均有无解检测与重排兜底（详见边界规则章节）。', 16, '#888', '', 'start');
  s += `</svg>`;
  return render(s, 1560);
}

// ============ 3. 8方向解锁扩散示意图 ============
function unlockSpreadSVG() {
  const W = 1100, H = 920;
  const cell = 118, gap = 10, ox = 80, oy = 130;
  const rows = 6, cols = 6;
  const removed = new Set(['2,2', '2,3']);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  s += box(0, 0, W, H, '#FAFBFD', '#E3E8F0', 0);
  s += text(W / 2, 56, '消除后「8方向解锁扩散」示意', 32, '#1F3864', '700');
  s += text(W / 2, 90, '以 6×6 棋盘为例：消除红色 X 两个格子后，周围相邻的锁定格子（绿色）同步解锁', 20, '#666');
  // grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * (cell + gap), y = oy + r * (cell + gap);
      if (removed.has(`${r},${c}`)) {
        s += box(x, y, cell, cell, '#FFCDD2', '#C62828', 10);
        s += text(x + cell / 2, y + cell / 2 + 9, '✕', 44, '#C62828', '700');
      } else {
        const unlocked = Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1 || Math.abs(r - 2) <= 1 && Math.abs(c - 3) <= 1;
        if (unlocked) { s += box(x, y, cell, cell, '#C8E6C9', '#388E3C', 10); s += text(x + cell / 2, y + cell / 2 + 8, '解', 30, '#1B5E20', '700'); }
        else { s += box(x, y, cell, cell, '#EEEEEE', '#9E9E9E', 10); s += text(x + cell / 2, y + cell / 2 + 8, '锁', 30, '#757575', '700'); }
      }
    }
  }
  // arrows from removed to neighbors (sample arrows)
  const cx1 = ox + 2 * (cell + gap) + cell / 2, cy1 = oy + 2 * (cell + gap) + cell / 2;
  const cx2 = ox + 3 * (cell + gap) + cell / 2;
  const targets = [[1, 1], [1, 2], [1, 3], [2, 1], [2, 4], [3, 1], [3, 2], [3, 3]];
  for (const [r, c] of targets) {
    const x = ox + c * (cell + gap) + cell / 2, y = oy + r * (cell + gap) + cell / 2;
    s += `<line x1="${cx1}" y1="${cy1}" x2="${x}" y2="${y}" stroke="#388E3C" stroke-width="2" stroke-dasharray="4,4" opacity="0.6"/>`;
  }
  for (const [r, c] of [[2, 4], [1, 4], [3, 4], [2, 5]]) {
    const x = ox + c * (cell + gap) + cell / 2, y = oy + r * (cell + gap) + cell / 2;
    s += `<line x1="${cx2}" y1="${cy1}" x2="${x}" y2="${y}" stroke="#388E3C" stroke-width="2" stroke-dasharray="4,4" opacity="0.6"/>`;
  }
  // legend
  s += box(80, H - 90, 36, 26, '#FFCDD2', '#C62828', 6); s += text(105, H - 72, '已消除格子', 18, '#555', '', 'start');
  s += box(270, H - 90, 36, 26, '#C8E6C9', '#388E3C', 6); s += text(295, H - 72, '本次解锁格子（8方向）', 18, '#555', '', 'start');
  s += box(560, H - 90, 36, 26, '#EEEEEE', '#9E9E9E', 6); s += text(585, H - 72, '仍锁定格子', 18, '#555', '', 'start');
  s += text(80, H - 40, '设计要点：扩散由「消除」触发而非时间触发，玩家每消除一对都能立即看到棋盘"打开一片"，形成强即时正反馈；解锁区域随进度增大，难度自然递增。', 17, '#777', '', 'start');
  s += `</svg>`;
  return render(s, 1100);
}

// ============ 4. 难度曲线图 ============
function difficultyCurveSVG() {
  const W = 1560, H = 820;
  const plotX = 120, plotY = 120, plotW = 1280, plotH = 520;
  const maxCells = 100;
  const x = (lv) => plotX + ((lv - 1) / 19) * plotW;
  const y = (cells) => plotY + plotH - (cells / maxCells) * plotH;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  s += box(0, 0, W, H, '#FAFBFD', '#E3E8F0', 0);
  s += text(W / 2, 52, '关卡难度曲线规划（1~20 关）', 32, '#1F3864', '700');
  // zone bands
  s += box(plotX, plotY, x(2.5) - plotX, plotH, '#E8F5E9', 'none');
  s += box(x(2.5), plotY, x(5.5) - x(2.5), plotH, '#FFF8E1', 'none');
  s += box(x(5.5), plotY, plotX + plotW - x(5.5), plotH, '#FFEBEE', 'none');
  s += text((plotX + x(2.5)) / 2, plotY + 26, '简单 easy', 18, '#2E7D32', '700');
  s += text((x(2.5) + x(5.5)) / 2, plotY + 26, '普通 normal', 18, '#F57F17', '700');
  s += text((x(5.5) + plotX + plotW) / 2, plotY + 26, '困难 hard', 18, '#C62828', '700');
  // axes
  s += `<line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotH}" stroke="#666" stroke-width="2"/>`;
  s += `<line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="#666" stroke-width="2"/>`;
  // y grid
  for (let v = 0; v <= 100; v += 20) {
    s += `<line x1="${plotX}" y1="${y(v)}" x2="${plotX + plotW}" y2="${y(v)}" stroke="#E0E0E0" stroke-width="1"/>`;
    s += text(plotX - 12, y(v) + 6, String(v), 16, '#888', '', 'end');
  }
  // x ticks
  for (let lv = 1; lv <= 20; lv++) {
    if (lv % 2 === 1) s += text(x(lv), plotY + plotH + 24, String(lv), 15, '#888');
  }
  // step data: cells by level
  const cellsByLevel = (lv) => lv <= 2 ? 36 : lv <= 5 ? 56 : 100;
  // step polyline
  let pts = [];
  for (let lv = 1; lv <= 20; lv++) {
    const x1 = x(lv), x2 = x(lv + 1 > 20 ? 20 : lv + 1);
    pts.push(`${x1},${y(cellsByLevel(lv))}`);
    if (lv < 20) pts.push(`${x2},${y(cellsByLevel(lv))}`);
  }
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#1565C0" stroke-width="4"/>`;
  for (let lv = 1; lv <= 20; lv++) {
    s += `<circle cx="${x(lv)}" cy="${y(cellsByLevel(lv))}" r="6" fill="#1565C0"/>`;
    if (lv % 2 === 1) s += text(x(lv), y(cellsByLevel(lv)) - 14, `${cellsByLevel(lv)}格`, 15, '#1565C0');
  }
  // icon types dashed line
  const iconsByLevel = (lv) => lv <= 2 ? 5 : lv <= 5 ? 10 : 18;
  const y2 = (icons) => plotY + plotH - (icons / 18) * plotH;
  let pts2 = [];
  for (let lv = 1; lv <= 20; lv++) {
    pts2.push(`${x(lv)},${y2(iconsByLevel(lv))}`);
  }
  s += `<polyline points="${pts2.join(' ')}" fill="none" stroke="#EF6C00" stroke-width="3" stroke-dasharray="8,6"/>`;
  // legend
  s += box(plotX + 40, plotY + plotH - 60, 34, 6, '#1565C0', 'none'); s += text(plotX + 90, plotY + plotH - 52, '棋盘格子数（36 → 56 → 100）', 18, '#555', '', 'start');
  s += box(plotX + 40, plotY + plotH - 34, 34, 6, '#EF6C00', 'none'); s += text(plotX + 90, plotY + plotH - 26, '图案种类（5 → 10 → 18，虚线）', 18, '#555', '', 'start');
  s += text(plotX, plotY - 34, '难度指标', 18, '#888');
  s += text(plotX + plotW / 2, plotY + plotH + 52, '关卡编号 Level', 18, '#888');
  s += `</svg>`;
  return render(s, 1560);
}

// ============ 5. 占位图（截图替换位） ============
function placeholderSVG(text1, text2, w, h) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
  s += box(0, 0, w, h, '#F5F6F8', '#C9CED6', 18);
  s += `<rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="12" fill="none" stroke="#AEB6C2" stroke-width="3" stroke-dasharray="14,10"/>`;
  s += text(w / 2, h / 2 - 30, text1, 30, '#8A94A6', '700');
  s += text(w / 2, h / 2 + 24, text2, 20, '#A0A8B6');
  s += text(w / 2, h / 2 + 64, '（替换方法：将截图文件拖入对应位置后重新生成，或直接在 Word 中替换图片）', 15, '#B5BDC9');
  s += `</svg>`;
  return render(s, w);
}

module.exports = { stateMachineSVG, flowchartSVG, unlockSpreadSVG, difficultyCurveSVG, placeholderSVG };
