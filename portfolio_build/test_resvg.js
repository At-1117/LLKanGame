const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
  <rect width="400" height="200" fill="#f0f4ff"/>
  <text x="20" y="60" font-size="24" fill="#333" font-family="Microsoft YaHei">连连看测试</text>
  <text x="20" y="110" font-size="18" fill="#666" font-family="Microsoft YaHei">SVG→PNG 渲染测试</text>
  <rect x="20" y="130" width="200" height="40" rx="8" fill="#4a90d9"/>
  <text x="120" y="158" font-size="18" fill="#fff" text-anchor="middle" font-family="Microsoft YaHei">开始游戏</text>
</svg>`;
const r = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: 800 } });
const png = r.render().asPng();
fs.writeFileSync('test.png', png);
console.log('resvg OK, png bytes:', png.length);
