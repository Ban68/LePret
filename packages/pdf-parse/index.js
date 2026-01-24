function decodeEscapes(value) {
  return value
    .replace(/\\([nrtbf\\()])/g, (_, ch) => {
      switch (ch) {
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case '\\':
          return '\\';
        case '(':
          return '(';
        case ')':
          return ')';
        default:
          return ch;
      }
    })
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      return String.fromCharCode(parseInt(oct, 8));
    });
}

function extractTextFromContent(content) {
  let text = '';
  const textRegex = /\(([\s\S]*?)\)\s*T[Jj]/g;
  let match;
  while ((match = textRegex.exec(content))) {
    const decoded = decodeEscapes(match[1]);
    if (text) text += '\n';
    text += decoded;
  }
  return text;
}

function extractText(buffer) {
  const data = buffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let result = [];
  let match;
  while ((match = streamRegex.exec(data))) {
    const content = match[1];
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch;
    while ((btMatch = btRegex.exec(content))) {
      const textBlock = extractTextFromContent(btMatch[1]);
      if (textBlock) {
        result.push(textBlock);
      }
    }
  }
  return result.join('\n');
}

async function pdfParse(dataBuffer) {
  if (!dataBuffer) throw new Error('No data provided');
  const buffer = Buffer.isBuffer(dataBuffer) ? dataBuffer : Buffer.from(dataBuffer);
  const text = extractText(buffer);
  return {
    text,
    numpages: text ? text.split(/\n{1,}/).length : 0,
    info: null,
    metadata: null,
    version: '1.0.0',
  };
}

module.exports = pdfParse;
module.exports.default = pdfParse;
module.exports.pdfParse = pdfParse;
module.exports.__helpers = { extractText };
