const SQL_START_RE =
    /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE|GRANT|REVOKE)\b/i;
const SQL_HINT_RE =
    /\b(FROM|JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|UNION)\b/i;

export function autoFenceSqlBlocks(markdownText) {
    if (!markdownText) return "";
    if (markdownText.includes("```")) return markdownText;

    const lines = String(markdownText).split(/\r?\n/);
    const out = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const looksSqlStart = SQL_START_RE.test(line);

        if (!looksSqlStart) {
            out.push(line);
            i += 1;
            continue;
        }

        const block = [];
        while (i < lines.length) {
            const cur = lines[i];
            if (cur.trim() === "") break;
            const sqlish =
                SQL_START_RE.test(cur) || SQL_HINT_RE.test(cur) || /;(\s*)$/.test(cur);
            if (!sqlish && block.length > 0 && !/^\s*[,)\]]/.test(cur)) break;
            block.push(cur);
            i += 1;
        }

        const blockText = block.join("\n");
        const isLikelySql =
            SQL_START_RE.test(blockText) &&
            (SQL_HINT_RE.test(blockText) || /;(\s*)$/.test(blockText));
        if (isLikelySql) {
            out.push("```sql");
            out.push(blockText);
            out.push("```");
        } else {
            out.push(...block);
        }

        if (i < lines.length && lines[i].trim() === "") {
            out.push(lines[i]);
            i += 1;
        }
    }

    return out.join("\n");
}

export function getPageNum(text) {
    if (!text) return null;
    const match = text.match(/\[Source:\s*[^|]+\|\s*Page\s*(\d+)\]/i);
    return match ? match[1] : null;
}
