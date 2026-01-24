const fs = require('fs');
const path = 'src/app/c/[orgId]/requests/ui/RequestsClient.tsx';
let text = fs.readFileSync(path, 'utf8');
text = text.replace('variant="primary"\\n', 'variant="primary"\n');
fs.writeFileSync(path, text);
