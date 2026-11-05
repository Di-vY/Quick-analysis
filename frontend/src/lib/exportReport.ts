import { DatasetSummary, Message } from '@/types';

/**
 * Exports the entire analysis session as a clean Markdown (.md) report.
 */
export function exportMarkdownReport(dataset: DatasetSummary | null, messages: Message[]) {
  const dateStr = new Date().toLocaleString();
  const lines: string[] = [
    `# 📊 Quick Analysis — Executive Report`,
    `**Generated:** ${dateStr}`,
    '',
  ];

  if (dataset) {
    lines.push(
      `## 1. Dataset Overview`,
      `- **Filename:** \`${dataset.filename}\``,
      `- **Total Rows:** ${dataset.row_count.toLocaleString()}`,
      `- **Total Columns:** ${dataset.column_count}`,
      '',
      `### Schema Summary`,
      `| Column Name | Data Type | Null Count | Sample Values |`,
      `| :--- | :--- | :--- | :--- |`,
      ...dataset.columns.map(
        (c) =>
          `| \`${c.name}\` | ${c.data_type} | ${c.null_count} | ${c.sample_values
            .slice(0, 3)
            .join(', ')} |`
      ),
      ''
    );
  }

  lines.push(`## 2. Analytical Findings & Queries`, '');

  let qIndex = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      qIndex++;
      lines.push(`### Q${qIndex}: ${msg.content}`, '');
    } else if (msg.role === 'assistant' && !msg.id.startsWith('welcome')) {
      lines.push(msg.content, '');

      if (msg.sql_query) {
        lines.push('**Executed DuckDB SQL:**', '```sql', msg.sql_query, '```', '');
      }

      if (msg.query_result && msg.query_result.length > 0) {
        const rows = msg.query_result.slice(0, 10);
        const cols = Object.keys(rows[0]);
        lines.push(
          `**Query Results (Top ${rows.length} of ${msg.query_result.length} rows):**`,
          '',
          `| ${cols.join(' | ')} |`,
          `| ${cols.map(() => ':---').join(' | ')} |`,
          ...rows.map(
            (r) => `| ${cols.map((c) => (r[c] === null ? 'null' : String(r[c]))).join(' | ')} |`
          ),
          ''
        );
      }
      lines.push('---', '');
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = dataset ? dataset.filename.replace(/\.[^/.]+$/, '') : 'session';
  a.download = `quick_analysis_${safeName}_report.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Opens a formatted, print-ready executive report and invokes the browser PDF/Print dialog.
 */
export function exportPrintablePdfReport(dataset: DatasetSummary | null, messages: Message[]) {
  const dateStr = new Date().toLocaleString();

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let qaBlocksHtml = '';
  let qCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      qCount++;
      const nextMsg = messages[i + 1];
      const answerHtml =
        nextMsg && nextMsg.role === 'assistant'
          ? `<div class="answer">${escapeHtml(nextMsg.content).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</div>`
          : '';
      const sqlHtml =
        nextMsg && nextMsg.sql_query
          ? `<div class="sql-box"><div class="sql-label">Executed DuckDB SQL</div><pre>${escapeHtml(
              nextMsg.sql_query
            )}</pre></div>`
          : '';

      let tableHtml = '';
      if (nextMsg && nextMsg.query_result && nextMsg.query_result.length > 0) {
        const rows = nextMsg.query_result.slice(0, 15);
        const cols = Object.keys(rows[0]);
        tableHtml = `
          <table class="data-table">
            <thead>
              <tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) =>
                    `<tr>${cols
                      .map((c) => `<td>${r[c] === null ? '<em>null</em>' : escapeHtml(String(r[c]))}</td>`)
                      .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        `;
      }

      qaBlocksHtml += `
        <div class="qa-card">
          <div class="question">Q${qCount}: ${escapeHtml(msg.content)}</div>
          ${answerHtml}
          ${sqlHtml}
          ${tableHtml}
        </div>
      `;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quick Analysis Report - ${dataset?.filename || 'Session'}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          max-width: 900px;
          margin: 0 auto;
          padding: 36px 24px;
          line-height: 1.5;
        }
        .header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 16px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .title {
          font-size: 24px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0;
        }
        .subtitle {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
        }
        .kpi-label {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .kpi-val {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }
        .qa-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .question {
          font-size: 15px;
          font-weight: 700;
          color: #1d4ed8;
          margin-bottom: 8px;
        }
        .answer {
          font-size: 13px;
          color: #334155;
          margin-bottom: 12px;
        }
        .sql-box {
          background: #0f172a;
          color: #34d399;
          padding: 10px 14px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 11px;
          margin-bottom: 12px;
          overflow-x: auto;
        }
        .sql-label {
          color: #94a3b8;
          font-size: 10px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        pre { margin: 0; white-space: pre-wrap; }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-top: 8px;
        }
        .data-table th {
          background: #f1f5f9;
          text-align: left;
          padding: 6px 10px;
          border-bottom: 1px solid #cbd5e1;
          color: #334155;
        }
        .data-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #e2e8f0;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">Quick Analysis — Executive Report</h1>
          <div class="subtitle">Powered by DuckDB SQL & Gemini Flash</div>
        </div>
        <div class="subtitle">Generated: ${escapeHtml(dateStr)}</div>
      </div>

      ${
        dataset
          ? `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Dataset</div>
            <div class="kpi-val">${escapeHtml(dataset.filename)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Rows</div>
            <div class="kpi-val">${dataset.row_count.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Columns</div>
            <div class="kpi-val">${dataset.column_count}</div>
          </div>
        </div>
      `
          : ''
      }

      ${qaBlocksHtml || '<p style="color:#64748b;font-size:13px;">No analytical queries recorded in this session yet.</p>'}

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  const printWin = window.open('', '_blank', 'width=960,height=800');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }
}
