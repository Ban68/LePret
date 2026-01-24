const fs = require('fs');
const path = 'src/app/c/[orgId]/requests/ui/RequestsClient.tsx';
let text = fs.readFileSync(path, 'utf8');
const search = '              <Button\r\n                type="button"\r\n                size="sm"\r\n                className="mt-1"';
const replace = '              <Button\r\n                type="button"\r\n                size="sm"\r\n                variant="primary"\r\n                className="mt-1"';
if (!text.includes(search)) {
  console.error('pattern not found');
  process.exit(1);
}
text = text.replace(search, replace);
fs.writeFileSync(path, text);
