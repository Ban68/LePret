const fs = require('fs');
const path = 'src/app/c/[orgId]/requests/ui/RequestsClient.tsx';
let text = fs.readFileSync(path, 'utf8');
text = text.replace('size="sm"\\n                variant="primary"', 'size="sm"\n                variant="primary"');
fs.writeFileSync(path, text);
