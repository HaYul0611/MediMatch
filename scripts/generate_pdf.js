const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const mdPath = path.join(__dirname, '..', 'MediMatch_논문연계_시연설명서.md');
const mdContent = fs.readFileSync(mdPath, 'utf8');

function parseMarkdown(md) {
  const lines = md.split('\n');
  let inTable = false;
  let inCode = false;
  let codeLang = '';
  let codeBuffer = [];
  let tableBuffer = [];
  let result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCode = false;
        result.push('<pre class="code-block ' + codeLang + '"><code>' + 
          escapeHtml(codeBuffer.join('\n')) + '</code></pre>');
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(line);
      continue;
    } else {
      if (inTable) {
        result.push(renderTable(tableBuffer));
        inTable = false;
        tableBuffer = [];
      }
    }

    if (line.startsWith('# ')) {
      result.push('<h1>' + formatInline(line.slice(2)) + '</h1>');
    } else if (line.startsWith('## ')) {
      result.push('<h2>' + formatInline(line.slice(3)) + '</h2>');
    } else if (line.startsWith('### ')) {
      result.push('<h3>' + formatInline(line.slice(4)) + '</h3>');
    } else if (line.startsWith('#### ')) {
      result.push('<h4>' + formatInline(line.slice(5)) + '</h4>');
    } else if (line.trim() === '---') {
      result.push('<hr>');
    } else if (line.trim().startsWith('- ')) {
      result.push('<li>' + formatInline(line.trim().slice(2)) + '</li>');
    } else if (line.trim().length > 0) {
      result.push('<p>' + formatInline(line) + '</p>');
    }
  }

  if (inTable) {
    result.push(renderTable(tableBuffer));
  }

  // Wrap loose li elements in ul
  let html = result.join('\n');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, function (match) {
    return '<ul>\n' + match + '</ul>\n';
  });

  return html;
}

function renderTable(tableLines) {
  let html = '<table>\n';
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    if (line.includes('---')) continue;
    const cells = line.split('|').slice(1, -1);
    const isHeader = (i === 0);
    html += '  <tr>\n';
    cells.forEach(function (c) {
      const tag = isHeader ? 'th' : 'td';
      html += '    <' + tag + '>' + formatInline(c.trim()) + '</' + tag + '>\n';
    });
    html += '  </tr>\n';
  }
  html += '</table>\n';
  return html;
}

function formatInline(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const bodyHtml = parseMarkdown(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>MediMatch 논문 연계 시연 설명서</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Malgun Gothic', 'Noto Sans KR', sans-serif;
      color: #1e293b;
      line-height: 1.6;
      font-size: 9.5pt;
      margin: 0;
      padding: 0;
      word-break: keep-all;
    }
    h1 {
      font-size: 18pt;
      color: #0f172a;
      border-bottom: 2.5px solid #0284c7;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 12.5pt;
      color: #0369a1;
      border-left: 4px solid #0284c7;
      padding-left: 8px;
      margin-top: 20px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 10.5pt;
      color: #1e293b;
      margin-top: 14px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }
    h4 {
      font-size: 9.5pt;
      color: #334155;
      margin-top: 10px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }
    p {
      margin: 5px 0;
      text-align: justify;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    code {
      background: #f1f5f9;
      color: #0284c7;
      padding: 1px 3px;
      border-radius: 3px;
      font-family: Consolas, monospace;
      font-size: 8.5pt;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 8pt;
      font-family: Consolas, monospace;
      margin: 8px 0;
      white-space: pre-wrap;
      page-break-inside: avoid;
      color: #334155;
    }
    ul, ol {
      margin: 5px 0;
      padding-left: 18px;
    }
    li {
      margin-bottom: 3px;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 14px 0;
    }
    a {
      color: #0284c7;
      text-decoration: none;
    }
    strong {
      color: #0f172a;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

const tempHtmlPath = path.join(__dirname, 'manual_temp.html');
fs.writeFileSync(tempHtmlPath, fullHtml, 'utf8');

const pdfPath = path.join(__dirname, '..', 'MediMatch_논문연계_시연설명서.pdf');
const docsPdfPath = path.join(__dirname, '..', 'docs', 'MediMatch_논문연계_시연설명서.pdf');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Generating PDF via Headless Chrome...');
const cmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${tempHtmlPath}"`;

try {
  child_process.execSync(cmd);
  if (fs.existsSync(pdfPath)) {
    const docsDir = path.dirname(docsPdfPath);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    fs.copyFileSync(pdfPath, docsPdfPath);

    const st = fs.statSync(pdfPath);
    const stDocs = fs.statSync(docsPdfPath);
    console.log(`[SUCCESS] PDF created successfully at: ${pdfPath} (${st.size} bytes)`);
    console.log(`[SUCCESS] PDF copied to docs at: ${docsPdfPath} (${stDocs.size} bytes)`);
  } else {
    console.error('[FAIL] PDF file not found after conversion');
  }
} catch (e) {
  console.error('[ERROR]', e.message);
} finally {
  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }
}
