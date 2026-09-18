// gen_portfolio.js — 生成《连连看》游戏策划作品集 Word 文档
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, PageBreak, ImageRun, Footer, PageNumber,
  VerticalAlign, LevelFormat,
} = require('docx');
const D = require('./diagrams.js');

// ==================== 基础工具 ====================
const CN = '微软雅黑';
function run(text, opts = {}) {
  return new TextRun({
    text,
    font: { ascii: CN, eastAsia: CN, hAnsi: CN },
    size: opts.size ?? 21,
    bold: opts.bold ?? false,
    color: opts.color ?? '333333',
    italics: opts.italics ?? false,
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 60, line: opts.line ?? 264 },
    indent: opts.indent,
    children: [run(text, opts)],
  });
}
function bullet(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 24, line: 260 },
    indent: { left: 340 },
    children: [run('•  ', { color: '2E5AAC', bold: true, size: opts.size ?? 21 }), run(text, opts)],
  });
}
function h1(num, text) {
  return new Paragraph({
    pageBreakBefore: true,
    spacing: { before: 40, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: '2E5AAC' } },
    children: [run(`${num}  ${text}`, { size: 32, bold: true, color: '1F3864' })],
  });
}
function h1no(num, text) {
  return new Paragraph({
    spacing: { before: 40, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: '2E5AAC' } },
    children: [run(`${num}  ${text}`, { size: 32, bold: true, color: '1F3864' })],
  });
}
function h2(text) {
  return new Paragraph({
    spacing: { before: 180, after: 100 },
    children: [run(text, { size: 25, bold: true, color: '2E5AAC' })],
  });
}
function h3(text) {
  return new Paragraph({
    spacing: { before: 120, after: 60 },
    children: [run(text, { size: 22, bold: true, color: '404040' })],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 120 },
    children: [run(text, { size: 17, color: '888888' })],
  });
}
function img(children, opts = {}) {
  const align = opts.align ?? AlignmentType.CENTER;
  return new Paragraph({ alignment: align, spacing: { before: opts.before ?? 100, after: 0 }, children });
}
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const TABLE_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

function makeTable(headers, rows, opts = {}) {
  const widths = opts.widths || headers.map(() => 1);
  const total = widths.reduce((a, b) => a + b, 0);
  const colDxa = widths.map((w) => Math.round((w / total) * 9639));
  const headerCells = headers.map((h, i) => new TableCell({
    width: { size: colDxa[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: opts.headerFill ?? '2E5AAC' },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [run(h, { bold: true, color: 'FFFFFF', size: 18 })] })],
  }));
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: colDxa[i], type: WidthType.DXA },
      shading: ri % 2 === 1 && opts.zebra !== false ? { type: ShadingType.CLEAR, fill: 'F2F6FC' } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: opts.centerCols?.includes(i) ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: 40, after: 40, line: 276 }, children: [run(String(cell), { size: 18 })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colDxa,
    borders: TABLE_BORDERS,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
  });
}
function imgTable(leftChildren, rightChildren) {
  const mk = (children) => new TableCell({
    width: { size: 4819, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children,
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
    rows: [new TableRow({ children: [mk(leftChildren), mk(rightChildren)] })],
  });
}
function imageRun(file, widthPx) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const type = ext === '.png' ? 'png' : 'jpg';
  let heightPx = widthPx;
  // 按图片实际宽高比换算高度（通过解析 PNG/JPEG 尺寸不可行，统一由调用方传 heightPx）
  return { buf, type, widthPx };
}

// 文档整体
const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100 },
    children: [
      run('《连连看》休闲小游戏作品集 · 游戏策划方向　', { size: 16, color: '999999' }),
      run('第 ', { size: 16, color: '999999' }),
      new TextRun({ children: [PageNumber.CURRENT], font: { ascii: CN, eastAsia: CN, hAnsi: CN }, size: 16, color: '999999' }),
      run(' 页', { size: 16, color: '999999' }),
    ],
  })],
});

// ==================== 渲染图表 ====================
const outDir = path.join(__dirname, 'out');
const PNG = {
  state: D.stateMachineSVG(),
  flow: D.flowchartSVG(),
  spread: D.unlockSpreadSVG(),
  curve: D.difficultyCurveSVG(),
  phPopup: D.placeholderSVG('【占位】结算弹窗截图', '通关模式：剩余步数 + 胜利；失败模式：重试 / 返回首页', 700, 1200),
  phDev: D.placeholderSVG('【占位】开发者调试面板截图', '关卡跳转 / +5心 / 道具+5 / 重置存档', 700, 1200),
};
const shot = fs.readFileSync('E:/Project/LLKanGame/lianliankan.jpg');
const codeShot = fs.readFileSync('E:/Project/LLKanGame/tmp_question.png');

// ==================== 1. 封面 ====================
const cover = [
  new Paragraph({ spacing: { before: 1200, after: 0 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: shot, transformation: { width: 200, height: 436 } })] }),
  new Paragraph({ spacing: { before: 300, after: 0 }, alignment: AlignmentType.CENTER, children: [run('《连连看》休闲小游戏', { size: 52, bold: true, color: '1F3864' })] }),
  new Paragraph({ spacing: { before: 120, after: 600 }, alignment: AlignmentType.CENTER, children: [run('游戏策划方向 · 项目设计作品集', { size: 28, color: '2E5AAC' })] }),
  new Paragraph({ spacing: { before: 0, after: 120 }, alignment: AlignmentType.CENTER, children: [run('————————————————————————————', { color: 'C9CED6' })] }),
  new Paragraph({ spacing: { before: 200, after: 100 }, alignment: AlignmentType.CENTER, children: [run('姓　　名：', { size: 24, color: '555555' }), run('【请填写姓名】', { size: 24, bold: true, color: '1F3864' })] }),
  new Paragraph({ spacing: { before: 0, after: 100 }, alignment: AlignmentType.CENTER, children: [run('求职岗位：', { size: 24, color: '555555' }), run('游戏策划', { size: 24, bold: true, color: '1F3864' })] }),
  new Paragraph({ spacing: { before: 0, after: 100 }, alignment: AlignmentType.CENTER, children: [run('联系方式：', { size: 24, color: '555555' }), run('【电话】 【邮箱】', { size: 24, bold: true, color: '1F3864' })] }),
  new Paragraph({ spacing: { before: 0, after: 100 }, alignment: AlignmentType.CENTER, children: [run('日　　期：', { size: 24, color: '555555' }), run('20XX 年 XX 月', { size: 24, bold: true, color: '1F3864' })] }),
];

// ==================== 3. 01 项目概览 ====================
const s01 = [
  h1no('01', '项目概览'),
  h2('1.1　游戏简介'),
  p('《连连看》（LLKanGame）是一款面向抖音小游戏平台的休闲益智游戏，基于 Cocos Creator 3.8.8（TypeScript）独立开发完成。游戏在经典连连看玩法之上提出「消除解锁扩散」核心机制：棋盘图案初始锁定，玩家每消除一对图案，其周围 8 方向的相邻格子即解锁扩散——把"找对消除"升级为"规划解锁路径"的策略玩法。'),
  p('项目覆盖玩法、关卡、数值、系统、商业化与体验的完整设计闭环，并打通浏览器 H5 与抖音小游戏双端，一套代码全平台运行。'),
  h2('1.2　目标平台'),
  makeTable(['平台', '说明', '适配方式'], [
    ['抖音小游戏', '字节跳动小程序生态，IAA 广告变现主阵地', '抖音广告平台（激励视频 / 插屏广告位 ID 已预留）'],
    ['浏览器 H5', '开发调试与快速迭代环境', 'localStorage 自动映射平台存储，双端零改动'],
    ['技术栈', 'Cocos Creator 3.8.8 + TypeScript', '纯逻辑层与渲染层分离，便于跨端与测试'],
  ], { centerCols: [0, 1] }),
  h2('1.3　目标用户'),
  makeTable(['画像维度', '描述'], [
    ['年龄 / 性别', '16~45 岁泛用户，男女比例均衡'],
    ['使用场景', '通勤、排队、睡前等碎片化时间，单局 1~3 分钟'],
    ['游戏经验', '轻度玩家为主，偏好上手快、反馈强、可随时中断的休闲玩法'],
    ['核心诉求', '即时成就感、低挫败门槛、可复现的挑战（重玩同一关追三星）'],
  ]),
  h2('1.4　核心创新点'),
  bullet('「消除解锁扩散」机制：消除驱动解锁，解锁区域随进度自然扩大，形成"规划—执行—反馈"策略循环，且难度随进度自然递增；'),
  bullet('无限关卡体系：10 个配置关卡 + 第 11 关起程序化生成关卡（参数递增有封顶），以近乎零内容成本延长产品生命周期；'),
  bullet('种子随机棋盘：关卡布局由固定种子生成，同一关重玩布局一致，支持玩家复盘与三星挑战，为排行榜/每日挑战预留公平性基础；'),
  bullet('"步数—星级—体力"经济闭环：步数即容错、剩余步数评星、失败扣体力，三套数值互相咬合，兼顾体验、留存与变现；'),
  bullet('IAA 商业化闭环：激励视频点位（体力 +1、道具获取）全部围绕玩家"最想继续玩"的强动机时刻设计。'),
  h2('1.5　项目规模一览'),
  makeTable(['维度', '数据'], [
    ['场景', '主菜单（Menu）、游戏（Game）共 2 个'],
    ['图案素材', '18 种图案 + 18 种点击音效 + BGM + 全套 UI 图标'],
    ['关卡内容', '10 个基础关卡 + 程序化无限关卡'],
    ['核心系统', '步数 / 体力 / 道具 / 存档 / 关卡管理 共 5 大系统'],
    ['道具', '提示、重排、炸弹、全屏解锁（技能）共 4 类'],
    ['开发方式', '分阶段迭代（玩法原型 → 关卡 → 系统 → 商业化 → 打磨）'],
  ]),
];

// ==================== 4. 02 核心玩法文档 ====================
const s02 = [
  h1('02', '核心玩法文档：「消除解锁扩散」'),
  h2('2.1　玩法总述'),
  makeTable(['要素', '规则'], [
    ['游戏目标', '在步数耗尽前，通过配对消除解锁并清空全部棋盘图案'],
    ['胜利条件', '棋盘所有图案被消除（通关后按剩余步数评 1~3 星）'],
    ['失败条件', '① 步数用完且未通关；② 棋盘无可消除对（无解）'],
    ['基本操作', '点击两个相同且可连通的图案完成消除；点击已选中格子取消选中'],
    ['核心规则', '每消除一对，其周围 8 方向相邻的锁定格子解锁为可点击状态'],
    ['资源', '步数（每局初始 = 最少步数 + 难度奖励）、体力（跨局）、道具（跨关）'],
  ]),
  h2('2.2　规则明细'),
  makeTable(['规则项', '内容'], [
    ['格子状态', 'LOCKED（锁定，默认）→ UNLOCKED（可点击）→ SELECTED（选中）→ REMOVING（消除动画中）→ EMPTY（终态空格）'],
    ['解锁扩散', '消除完成后，对消除位置 8 方向（上/下/左/右 + 4 斜角）相邻的 LOCKED 格子执行解锁'],
    ['配对判定', '两格图案相同 且 存在 ≤2 个拐弯的连通路径（PathFinder BFS）'],
    ['错误惩罚', '图案不同或路径不连通：震动 + 抖动 + 扣 1 步（与成功消除同价，规则简单可预期）'],
    ['炸弹道具', '消除任意一对可消除图案，不消耗步数'],
    ['解锁技能', '全盘临时解锁 5 秒，5 秒后恢复锁定（已被扩散解锁的格子保持解锁）'],
    ['点击空白', '点击棋盘空白处取消当前选中'],
    ['初始解锁', '开局若干对相邻图案直接解锁，保证"开局必有可消除项"'],
  ]),
  h2('2.3　格子状态机（规则图）'),
  img([new ImageRun({ type: 'png', data: PNG.state, transformation: { width: 548, height: 285 } })]),
  caption('图 2-1　格子状态机：五种状态与转换触发条件'),
  h2('2.4　「8 方向解锁扩散」示意'),
  img([new ImageRun({ type: 'png', data: PNG.spread, transformation: { width: 480, height: 401 } })]),
  caption('图 2-2　消除红色 ✕ 格后，周围相邻锁定格（绿色"解"）同步解锁'),
  h2('2.5　核心玩法流程图'),
  img([new ImageRun({ type: 'png', data: PNG.flow, transformation: { width: 500, height: 551 } })]),
  caption('图 2-3　单次点击的完整处理链路'),
  h2('2.6　规则设计要点'),
  bullet('错误与成功"同价扣步"：惩罚规则简单一致，玩家无需学习复杂规则，且每次操作都计入资源消耗，杜绝乱点；'),
  bullet('开局必有解：初始解锁对全部生成在相邻位置，配合开局可解性验证，保证第一手必然可消除；'),
  bullet('反馈分层：点击（音效）→ 选中（弹跳动画）→ 配对成功（连线特效 + 消除动画）→ 解锁（扩散动画），正负反馈均即时、明确；'),
  bullet('节奏控制：消除动画期间锁定操作（ANIMATING 状态），防止连点导致状态错乱。'),
];

// ==================== 5. 03 关卡设计 ====================
const s03 = [
  h1('03', '关卡设计'),
  h2('3.1　设计目标'),
  bullet('新手引导：前 2 关高容错（奖励 20 步 ≈ 不可能失败），让玩家零挫败地学会规则；'),
  bullet('心流曲线：简单（36 格）→ 普通（56 格）→ 困难（100 格）三级跳，每档内部参数固定、跨档显著提升，体验"可感知的成长"；'),
  bullet('内容控制：固定关卡 + 程序化无限关卡双轨，应对休闲游戏"内容消耗快"的流失问题；'),
  bullet('体验可复现：种子随机保证同一关布局不变，支持复盘与三星挑战。'),
  h2('3.2　难度曲线规划'),
  makeTable(['关卡区间', '难度档', '棋盘', '图案种类', '初始解锁对', '奖励步数', '设计意图'], [
    ['1 ~ 2', '简单 easy', '6×6', '5', '3 对', '+20', '教学关：容错极高，零挫败建立规则认知'],
    ['3 ~ 5', '普通 normal', '8×7', '10', '4 对', '+10', '过渡关：棋盘与图案翻倍，进入心流'],
    ['6 关起', '困难 hard', '10×10', '18', '5 对', '+5', '挑战关：最大棋盘，容错收紧，配合道具与广告'],
  ], { centerCols: [0, 1, 2, 3, 4, 5] }),
  img([new ImageRun({ type: 'png', data: PNG.curve, transformation: { width: 548, height: 288 } })]),
  caption('图 3-1　关卡难度曲线：棋盘格子数与图案种类随关卡阶梯式递增'),
  h2('3.3　三档关卡参数配置表'),
  makeTable(['参数', '简单 easy', '普通 normal', '困难 hard'], [
    ['棋盘尺寸', '6 × 6（36 格）', '8 × 7（56 格）', '10 × 10（100 格）'],
    ['图案种类', '5 种', '10 种', '18 种（全部图案）'],
    ['初始解锁对', '3 对', '4 对', '5 对'],
    ['奖励步数（容错）', '+20 步', '+10 步', '+5 步'],
    ['最少步数（图案对数）', '18 步', '28 步', '50 步'],
    ['初始总步数', '38 步', '38 步', '55 步'],
    ['解锁节奏', '快（格子少）', '中', '慢（100 格解锁周期长）'],
  ], { centerCols: [0, 1, 2, 3] }),
  p('说明：初始总步数 = 最少步数（棋盘格子数 / 2）+ 奖励步数。三档在"棋盘面积、图案种类、初始解锁数量、容错步数"四个维度同步递增，保证难度上升可感知且公平。', { size: 18, color: '777777' }),
  h2('3.4　初始解锁生成规则'),
  makeTable(['规则', '内容'], [
    ['候选模板', '9 组相邻对模板：四角、四边中点、中心偏上（保证所有候选都相邻）'],
    ['随机选取', 'Fisher-Yates 洗牌后取前 N 对（N = 初始解锁对数），保证随机性且位置多样化'],
    ['相邻保证', '每对两个格子必然上下或左右相邻 → 开局第一手必有可消除项'],
    ['成对校验', '解锁位置数组必须成对出现，落单位置输出告警防止配置错误'],
  ]),
  h2('3.5　种子随机关卡生成方案'),
  makeTable(['设计点', '方案'], [
    ['随机源', '线性同余伪随机（LCG）：state = (state × 9301 + 49297) % 233280，同一 seed 产生同一序列'],
    ['种子来源', '首玩时随机生成并存入存档（levelSeeds[levelId]），重玩/重进读取同一种子'],
    ['效果', '同一关卡重玩布局完全一致 → 支持"记住解法、追三星"的复盘玩法'],
    ['可解性', '开局与局中均做可解性检查（MatchChecker），无解时执行两级重排兜底（见边界规则）'],
    ['公平性基础', '固定种子为排行榜、每日挑战等运营玩法提供"人人同一局面"的公平比较前提'],
  ]),
  h2('3.6　无限关卡（第 11 关起程序化生成）'),
  makeTable(['参数', '递增规则', '封顶'], [
    ['棋盘尺寸', '11~12 关 8×10，13 关起 10×10', '10×10'],
    ['图案种类', '10 种起步，每 2 关 +1 种', '18 种'],
    ['图案总数', '约占棋盘 80%（每类图案成对出现）', '—'],
    ['初始解锁', '随机 4~6 对相邻图案', '6 对'],
    ['生成缓存', '同一关生成结果缓存，重玩/重进布局一致', '—'],
  ], { centerCols: [0, 1, 2] }),
  p('设计意图：动态关卡只改变"参数组合"而非美术内容，在接近零内容成本下让关卡可玩数量趋近无限，同时所有参数有封顶，保证难度收敛、不失控。', { size: 18, color: '777777' }),
];

// ==================== 6. 04 数值文档 ====================
const s04 = [
  h1no('04', '数值文档'),
  h2('4.1　数值设计原则'),
  bullet('容错显性化：把"容错空间"做成玩家可见的步数资源，失败有明确归因（我扣了几步）；'),
  bullet('难度 = 多维参数同步上升：棋盘、图案、容错三变量联动，避免"只堆格子数"的单调难度；'),
  bullet('数值为体验服务：所有关键数值都能用"单局时长 / 单次会话时长"反推（如体力恢复节奏），可解释、可调参。'),
  h2('4.2　步数与难度数值表'),
  makeTable(['难度档', '棋盘格子数', '最少步数', '奖励步数', '初始总步数', '容错率'], [
    ['简单 easy', '36', '18', '+20', '38', '111%（几乎不会失败）'],
    ['普通 normal', '56', '28', '+10', '38', '36%'],
    ['困难 hard', '100', '50', '+5', '55', '10%'],
  ], { centerCols: [0, 1, 2, 3, 4, 5] }),
  p('公式：初始总步数 = 最少步数（图案总对数 = 格子数/2）+ 难度奖励步数。每成功消除一对消耗 1 步；图案不同或不连通同样扣 1 步。', { size: 18, color: '777777' }),
  h2('4.3　星级判定规则'),
  makeTable(['条件（通关时剩余步数 R，奖励步数 X）', '星级', '设计意图'], [
    ['R ≥ X', '★★★', '零失误级规划，奖励"最优解"'],
    ['R ≥ X / 2（向上取整）', '★★', '良好规划，鼓励重玩冲击三星'],
    ['R ≥ 1（通关即得）', '★', '保底成就，避免通关零奖励'],
  ], { centerCols: [1] }),
  p('补充规则：星级只保留历史最高（updateLevelStars），驱动玩家反复重玩已通关关卡——这是纯免费手段拉长单关生命周期的核心设计。', { size: 18, color: '777777' }),
  h2('4.4　体力（爱心）数值表'),
  makeTable(['参数', '数值', '设计依据'], [
    ['体力上限', '5 颗', '支撑单次会话连续游玩 10 局以上'],
    ['失败扣减', '1 颗 / 次', '限制无限重试，制造"失败成本"'],
    ['恢复间隔', '10 分钟 / 颗', '按单局 1~3 分钟反推：1 小时左右见底，形成回访钩子'],
    ['离线恢复', '按离线时长一次性结算补发', '避免"长时间不上线被惩罚"的流失风险'],
    ['看广告 +1', '激励视频广告奖励 1 颗', '变现点位：出现在"最想继续玩"时刻'],
    ['满血计时', '满 5 颗后停止恢复计时', '防止溢出浪费，鼓励及时消耗'],
  ]),
  h2('4.5　道具数值表'),
  makeTable(['道具', '效果', '初始数量', '消耗', '获取方式'], [
    ['提示 hint', '高亮一对可消除图案（2 秒）', '3 个', '1 个/次', '开局赠送 / 看广告补充'],
    ['重排 shuffle', '重排已解锁图案（无解时兜底）', '3 个', '1 个/次', '开局赠送 / 看广告补充'],
    ['炸弹 bomb', '直接消除任意一对（不扣步数）', '3 个', '1 个/次', '开局赠送 / 看广告补充'],
    ['解锁技能 skill', '全盘临时解锁 5 秒', '3 个', '1 个/次', '开局赠送 / 看广告补充'],
  ], { centerCols: [0, 2, 3] }),
  p('核心规则：道具数量跨关卡持久化（存档读写、不随关卡重置），道具用尽后角标显示"+"引导通过广告获取，形成"使用 → 消耗 → 看广告补充"的变现循环。', { size: 18, color: '777777' }),
  h2('4.6　数值推导逻辑小结'),
  bullet('步数是"难度 + 反馈"的统一载体：既是容错资源，也是评星依据，还是失败判定的触发条件；'),
  bullet('体力的节奏 = 单局时长 × 单次会话局数上限，恢复间隔决定了"下次回访的自然时间点"；'),
  bullet('道具的稀缺性来自跨关持久化——如果每关重置，道具就会贬值成一次性消耗品，失去广告转化的价值锚点。'),
];

// ==================== 7. 05 五大系统设计 ====================
const s05 = [
  h1('05', '五大系统详细设计'),
  h2('5.1　步数系统（StepSystem）'),
  makeTable(['规则项', '规则'], [
    ['初始化', '最少步数 = 图案总对数；初始总步数 = 最少步数 + 难度奖励 X'],
    ['消耗', '成功消除一对扣 1 步；图案不同 / 不连通也扣 1 步；炸弹消除不扣步'],
    ['星级', '通关时按剩余步数评星：R ≥ X → 3 星；R ≥ X/2 → 2 星；通关 → 1 星'],
    ['失败判定', '步数用完且棋盘未清空 → 触发失败结算（扣 1 心）'],
    ['定位', '核心资源系统：难度、评星、胜负三者的共同枢纽'],
  ]),
  h2('5.2　体力系统（HeartSystem）'),
  makeTable(['规则项', '规则'], [
    ['上限', '5 颗心'],
    ['扣减', '游戏失败扣 1 颗（步数用完或棋盘无解）'],
    ['恢复', '每 10 分钟自动恢复 1 颗；满 5 颗后暂停计时'],
    ['离线结算', '读取时按"经过时长 / 恢复间隔"一次性补发，并更新时间戳'],
    ['广告补充', '看激励视频 +1 颗（未满时）'],
    ['倒计时展示', '主菜单实时显示距下一颗心的 mm:ss 倒计时，把等待可视化'],
    ['定位', '留存系统：失败成本 + 回访钩子 + 广告场景三位一体'],
  ]),
  h2('5.3　道具系统（PropSystem）'),
  makeTable(['规则项', '规则'], [
    ['道具列表', '提示 / 重排 / 炸弹 / 解锁技能（4 类）'],
    ['初始数量', '首次游玩每类 3 个'],
    ['持久化', '数量读写存档，跨关卡不重置；用尽为 0 时保持 0（不回滚初始值）'],
    ['补充', '看广告获取（add 接口预留，供抖音广告适配调用）'],
    ['交互', '数量 > 0 显示数字；数量 = 0 显示"+"（引导获取）；按钮始终可点'],
    ['定位', '策略选择 + 资源稀缺感 + 变现入口'],
  ]),
  h2('5.4　存档系统（SaveSystem）'),
  makeTable(['规则项', '规则'], [
    ['存储介质', 'Cocos sys.localStorage（浏览器映射 localStorage；抖音小游戏自动映射平台存储）'],
    ['存档内容', '当前关卡、各关星级、棋盘种子、体力与恢复时间戳、道具数量、音效/音乐/震动设置'],
    ['兼容', '读取旧存档时与默认值合并（缺字段自动补齐），解析失败回退默认存档'],
    ['星级覆盖', '只保留历史最高星'],
    ['重置', '提供开发者重置入口（正式版可移除）'],
    ['定位', '进度保障：中断零成本 + 体验可复现（种子）'],
  ]),
  h2('5.5　关卡管理系统（LevelManager）'),
  makeTable(['规则项', '规则'], [
    ['前 10 关', '从 levels.json 加载，难度按规则强制覆盖（1-2 简单 / 3-5 普通 / 6+ 困难）'],
    ['第 11 关起', '程序化生成（棋盘 8×10→10×10，图案 10→18 种，初始解锁 4~6 对）'],
    ['缓存策略', '覆盖后配置与动态生成结果均缓存：同一关重玩/重进返回同一份配置'],
    ['最后一关', '无限关卡模式下永远有下一关'],
    ['定位', '内容引擎：配置化 + 程序化双轨，扩展成本趋近于零'],
  ]),
  h2('5.6　系统闭环关系'),
  p('玩家消耗步数推进关卡 → 通关评星写入存档 → 失败扣体力（体力见底触发回访与广告）→ 道具消耗引导广告补充 → 关卡进度与种子持久化保障可复现。五大系统围绕"体验、留存、变现"三目标互相咬合，任何单一系统都无法独立支撑产品循环。', { before: 60 }),
];

// ==================== 8. 06 边界规则 ====================
const s06 = [
  h1no('06', '边界规则：异常情况处理方案'),
  h2('6.1　异常情况处理总表'),
  makeTable(['异常场景', '触发条件', '处理方案', '设计考量'], [
    ['开局无解', '随机生成棋盘不存在任何可消除对', '开局可解性验证；无解时先重排已解锁图案（≤10 次），仍无解兜底全量重排（≤10 次）', '保证"开局必有解"，杜绝第一手就失败的负体验'],
    ['局中无解', '消除后棋盘无可消除对', '判定失败（扣 1 心）并结算', '规则明确：无解 = 失败，不做自动重排，防止"系统代打"稀释玩家操作意义'],
    ['步数用完', '剩余步数为 0 且未通关', '失败结算：扣 1 心 + 失败弹窗', '把失败原因显性化（步数 vs 无解）'],
    ['消除动画回调丢失', 'tween 回调链异常导致流程卡死', '1.5 秒超时兜底，强制继续流程', '防止流程永久卡在 ANIMATING'],
    ['结算弹窗不显示', 'Cocos 3.x 中 inactive 节点 onLoad 延迟执行', '进入场景强制初始化弹窗层 + 由常驻节点调度显示', '保证结算反馈必然出现'],
    ['场景切换音效残留/截断', 'director.loadScene 会停止音效', '切换前统一清场；延迟 0.5s 等按钮音效播完再切场景', '保证按钮点击"有声音"的体验一致'],
    ['旧存档字段缺失', '版本升级后老玩家存档缺新字段', '读取时与默认值深度合并', '兼容历史版本，避免升级即清档'],
    ['初始解锁位置落单', '关卡配置初始解锁对为奇数', '告警 + 最后一格不参与解锁', '配置错误显性化，便于开发期发现'],
    ['图案数量不足', '图案种类不足以为初始对分配图案', '报错终止开局', '配置错误快速失败，避免运行期崩溃'],
    ['重复切场景', '连续点击下一关/返回按钮', '场景切换防重复标记（单次生效）', '避免场景叠加导致的资源泄漏'],
  ]),
  h2('6.2　重点规则详解：无解棋盘的两级兜底策略'),
  p('策略一（玩家感受优先）：仅重排已解锁图案，锁定图案保持不动——玩家看到的是"现有可操作区域被洗牌"，几乎无感知成本；策略二（兜底）：仍无解时全量重排。两级策略在"玩家体验"与"可解性保证"之间取平衡，且每次重排后都会重新校验可解性。', { before: 60 }),
];

// ==================== 9. 07 游戏截图 ====================
const s07 = [
  h1no('07', '游戏截图'),
  h2('7.1　游戏主界面与关卡（实机截图）'),
  img([new ImageRun({ type: 'jpg', data: shot, transformation: { width: 230, height: 501 } })], { align: AlignmentType.CENTER }),
  caption('图 7-1　游戏内棋盘界面：顶部关卡与步数信息，棋盘呈现锁定/解锁混合状态（截图待更新为最终版 UI）'),
  h2('7.2　结算弹窗与调试面板（占位，替换为实机截图）'),
  imgTable(
    [img([new ImageRun({ type: 'png', data: PNG.phPopup, transformation: { width: 250, height: 429 } })]), caption('图 7-2　结算弹窗：通关 / 失败两种模式')],
    [img([new ImageRun({ type: 'png', data: PNG.phDev, transformation: { width: 250, height: 429 } })]), caption('图 7-3　调试面板：跳关 / +5心 / 道具+5 / 重置存档')],
  ),
  h2('7.4　开发过程（代码）'),
  img([new ImageRun({ type: 'png', data: codeShot, transformation: { width: 500, height: 408 } })]),
  caption('图 7-4　核心脚本开发（Cell 格子组件：选中/消除动画与状态管理）'),
  p('截图说明：以上占位图用于标注应插入的截图位置；将实机截图按同样比例替换即可。完整 UI 截图可在 Cocos Creator 中预览后补充。', { size: 17, color: '999999' }),
];

// ==================== 10. 08 复盘文档 ====================
const s08 = [
  h1no('08', '复盘文档'),
  h2('8.1　迭代历程'),
  makeTable(['阶段', '核心目标', '关键产出'], [
    ['阶段一 · 玩法原型', '打通核心玩法闭环', '棋盘生成、配对消除、路径查找（≤2 拐弯 BFS）、基础渲染'],
    ['阶段二 · 关卡体系', '关卡可配置化', 'levels.json 配置、难度字段、棋盘参数化、初始解锁对'],
    ['阶段三 · UI 框架', '可玩的产品形态', '主菜单、游戏 HUD、结算弹窗、结果流转（下一关/重玩/返回）'],
    ['阶段四 · 体验完善', '打磨细节与反馈', '设置面板、统一音效系统、震动反馈、弹窗显示修复、场景切换音效修复'],
    ['阶段五 · 内容扩展', '延长生命周期', '存档系统、无限关卡、种子随机棋盘、开局可解性验证'],
    ['阶段六 · 数值与商业化重构', '经济闭环成型', '步数系统替代计分、体力系统、道具跨关持久化、解锁技能、失败判定重构、广告点位预留'],
  ]),
  h2('8.2　策划—开发过程中的典型问题与解决'),
  makeTable(['问题', '根因分析', '解决方案', '收获'], [
    ['结算弹窗有时不显示', 'Cocos 3.x inactive 节点 onLoad 延迟到首次激活才执行，弹窗刚激活就被自己的隐藏逻辑关闭', '进入场景强制初始化弹窗层；改用常驻节点（Canvas）调度显示时机', '引擎生命周期特性要在"设计阶段"就纳入考虑，而非等 Bug 出现'],
    ['跨场景音效残留/被截断', 'director.loadScene 直接停掉所有音效，按钮声被截断', '切场景前统一清场 + 延迟 0.5s 等按钮音效自然播完', '音频状态必须显式管理，不能依赖引擎默认行为'],
    ['消除动画回调丢失导致卡死', 'tween 回调链在极端时序下不触发', '1.5 秒超时兜底强制继续', '所有异步动画链路都要有超时兜底，防御性编程'],
    ['随机棋盘开局无解', '纯随机生成不保证存在可消除对', '开局可解性验证 + 两级重排兜底', '随机内容必须搭配"可玩性校验"，这是程序化设计的通用原则'],
    ['音效串音叠加', '多个音效共享资源互相覆盖', '独立音源 + 4 池轮播 + 同类自动停', '反馈系统要"分层"：点击、道具、结算、BGM 各自独立'],
    ['旧存档升级崩溃', '新版本新增字段，旧存档缺失', '读取时与默认值深度合并', '存档结构要设计"向后兼容"机制'],
  ]),
  h2('8.3　个人复盘'),
  bullet('设计层面：最大的认知升级是"数值不是表格，是体验的翻译器"——步数奖励 20/10/5 不是拍脑袋，而是从"新手容错 → 心流 → 挑战"的体验目标反推出来的；'),
  bullet('工程层面：理解了"规则自洽"的价值——错误与成功同价扣步、无解即失败，都是为了让规则少而清晰，降低玩家认知成本；'),
  bullet('流程层面：分阶段迭代 + 每阶段可验收，让一个包含 5 大系统的项目可控地推进到可上线状态；'),
  bullet('跨职能层面：一人完成策划 + 开发，验证了"设计—实现—验证"闭环的高效性，也让我更理解程序同学对"边界条件"的敏感。'),
  h2('8.4　后续优化方向'),
  bullet('数据体系：接入埋点（关卡流失率、广告点位点击率、体力耗尽率），用数据驱动下一轮调参；'),
  bullet('运营玩法：基于种子随机棋盘上线每日挑战与排行榜（公平性已具备）；'),
  bullet('社交裂变：分享复活、好友助力道具；'),
  bullet('商业化深化：插屏广告自然节点接入、激励点位 A/B 测试；'),
  bullet('品质升级：18 种图案美术重绘、动画与音效加强、抖音低端机性能优化与包体瘦身。'),
];

// ==================== 11. 09 附加内容：游戏拆解 ====================
const s09 = [
  h1('09', '附加内容：热门消除小游戏拆解——《羊了个羊》'),
  h2('9.1　为什么拆解它'),
  p('《羊了个羊》是 2022 年 9 月爆火的现象级消除小游戏（微信 / 抖音双平台），单日话题度登顶全网，其"第一关教学、第二关地狱"的难度设计、"99% 的人过不了第二关"的社交传播、以及纯 IAA（广告变现）模式，与本项目同属休闲小游戏赛道，极具拆解价值。以下从玩法、难度、变现、留存四个维度拆解，并与本项目做对照。'),
  h2('9.2　基本信息'),
  makeTable(['维度', '信息'], [
    ['名称 / 平台', '《羊了个羊》 / 微信小游戏（后扩散至抖音等平台）'],
    ['类型', '堆叠式三消（多层堆叠卡牌中三张相同消除）'],
    ['爆发时间', '2022 年 9 月，上线后迅速全网刷屏'],
    ['变现模式', 'IAA：复活看激励视频、道具获取'],
    ['爆火核心', '"第二关地狱难度"制造话题，全网挑战与求助分享'],
  ]),
  h2('9.3　玩法机制拆解'),
  makeTable(['机制', '设计', '作用'], [
    ['堆叠消除', '多层卡牌堆叠，只有"未被压住"的牌可选，三张相同消除', '信息不透明制造记忆与规划压力'],
    ['槽位限制', '底部槽位有限（约 7 格），满槽即失败', '资源管理压力，制造"差一点就赢"的挫败感'],
    ['道具系统', '移出 / 撤销 / 洗牌三类道具', '道具成为"救命稻草"，消耗后引导看广告'],
    ['复活机制', '失败后看广告复活一次', '强动机时刻的变现点位'],
    ['失败后引导', '分享给好友可获复活/道具机会', '社交裂变的天然渠道'],
  ]),
  h2('9.4　难度与传播设计（最值得学习的一点）'),
  p('《羊了个羊》的难度设计不是"曲线"而是"断崖"：第一关三分钟教学、第二关通过率极低。这种反常规设计牺牲了普通玩家的通关体验，却换来两个巨大收益：①"过不了"本身成为社交货币——用户自发在群里传播、求助、炫耀，形成病毒式话题；② 反复失败让玩家反复回到游戏，配合广告复活直接放大 IAA 收入。',
    { before: 60 }),
  p('启示：难度不只是体验参数，更是传播变量。但"断崖难度"依赖超强话题性，不可直接复制；本项目采用平滑曲线 + 无限关卡，走的是长线留存路线，两种策略对应不同产品定位。', { before: 60 }),
  h2('9.5　变现设计拆解'),
  makeTable(['点位', '时机', '设计逻辑'], [
    ['广告复活', '失败瞬间（情绪峰值）', '"最想继续玩"的时刻，激励视频完成率最高'],
    ['道具获取', '道具耗尽后', '资源稀缺 + 目标近在咫尺（差一步通关）'],
    ['分享助力', '失败后分享到群聊', '零成本获取"社交流量"'],
  ]),
  p('对照本项目：本项目同样把激励视频点位放在"体力耗尽 +1 心"与"道具用尽补充"两个强动机时刻，逻辑同源；差异在于本项目不强制分享，而是以道具 "+" 角标温和引导，降低打扰。', { before: 60 }),
  h2('9.6　留存设计拆解'),
  makeTable(['机制', '作用'], [
    ['"差一点就过"的挫败感', '激发重试动机，单次会话局数极高'],
    ['话题性回归', '全网讨论让玩家"想起来就回来试一把"'],
    ['每日挑战心智', '社交圈内互相比较通关进度'],
  ]),
  h2('9.7　与本项目设计对照'),
  makeTable(['维度', '《羊了个羊》', '本项目《连连看》'], [
    ['难度策略', '断崖式（第二关地狱）', '平滑曲线（easy→normal→hard）'],
    ['关卡内容', '有限关卡 + 强话题', '10 关 + 程序化无限关卡'],
    ['核心压力', '槽位资源管理', '步数资源管理 + 解锁路径规划'],
    ['失败成本', '重头再来（无体力限制）', '扣 1 心（10 分钟恢复）'],
    ['广告点位', '复活 + 道具（强时机）', '体力 +1 + 道具补充（强时机）'],
    ['社交', '分享复活（强裂变）', '预留（后续分享助力）'],
    ['内容成本', '低（单一玩法）', '极低（程序化生成）'],
    ['留存逻辑', '话题驱动短期爆量', '体力 + 星级 + 无限关卡长线运营'],
  ]),
  h2('9.8　可迁移设计点总结'),
  bullet('难度可以是传播变量：极端难度 + 话题包装可制造免费流量，但需评估产品定位是否匹配；'),
  bullet('广告点位 = 强动机时刻：失败瞬间、资源耗尽瞬间是激励视频的黄金位置；'),
  bullet('资源管理创造策略深度：槽位 / 步数这类"有限资源"是休闲游戏低成本增加深度的通用手法；'),
  bullet('分享机制是 IAA 的社交放大器：复活、助力类分享既带来流量又不直接打断体验。'),
  h3('参考来源'),
  bullet('《复盘〈羊了个羊〉爆红路径，高难度小游戏的成功能否复刻？》——新浪科技：https://finance.sina.com.cn/tech/internet/2022-09-19/doc-imqqsmrn9702644.shtml'),
  bullet('《〈羊了个羊〉这款"逼疯"全网的小游戏，凭什么让你越挫越勇？》——小米游戏：https://game.xiaomi.com/viewpoint/1543958016_1782117619642_149'),
  bullet('iAA 经营案例周报（激励视频变现方法论）——抖音开放平台：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/operation1/user-ops/gain-user/iaa'),
  bullet('《最新！抖小 IAA：年消耗环比增 150%+，益智休闲约占 30%》——https://mp.weixin.qq.com/s/N9_okRZh08FaeqaqTC6qyQ'),
  bullet('《谈谈三消游戏关卡的难度控制问题》——GameRes 游资网：https://www.gameres.com/844638.html'),
];

// ==================== 组装文档 ====================
const doc = new Document({
  creator: 'LLKanGame Portfolio',
  title: '《连连看》休闲小游戏作品集（游戏策划方向）',
  description: '连连看小游戏项目设计作品集：核心玩法、关卡、数值、系统、边界规则、复盘与游戏拆解',
  styles: {
    default: {
      document: { run: { font: { ascii: CN, eastAsia: CN, hAnsi: CN }, size: 21, color: '333333' } },
    },
  },
  sections: [
    {
      properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footer,
      children: [...cover, new Paragraph({ children: [new PageBreak()] }), ...s01, new Paragraph({ children: [new PageBreak()] }), ...s02, new Paragraph({ children: [new PageBreak()] }), ...s03, ...s04, new Paragraph({ children: [new PageBreak()] }), ...s05, ...s06, ...s07, ...s08, new Paragraph({ children: [new PageBreak()] }), ...s09],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = 'E:/Project/LLKanGame/连连看小游戏作品集-游戏策划方向.docx';
  fs.writeFileSync(out, buf);
  console.log('OK written:', out, buf.length, 'bytes');
}).catch((e) => { console.error('FAIL', e); process.exit(1); });
