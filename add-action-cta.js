const fs = require('fs');
const path = 'src/app/c/[orgId]/requests/ui/RequestsClient.tsx';
let text = fs.readFileSync(path, 'utf8');
const search = '          <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-lp-sec-4/60 bg-white p-2 text-sm shadow-lg">\r\n            {editing ? (';
if (!text.includes(search)) {
  console.error('pattern not found');
  process.exit(1);
}
const insert = '          <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-lp-sec-4/60 bg-white p-2 text-sm shadow-lg">\r\n            {nextStep?.cta?.kind === "accept_offer" && nextStep.cta.offer_id ? (\r\n              <button\r\n                type="button"\r\n                className="w-full rounded-md px-2 py-1 text-left text-lp-primary-1 hover:bg-lp-sec-4/30"\r\n                onClick={() => onAcceptOffer(nextStep.cta!.offer_id!)}\r\n                disabled={busy}\r\n              >\r\n                {nextStep.cta.label ?? "Aceptar oferta"}\r\n              </button>\r\n            ) : null}\r\n            {editing ? (';
text = text.replace(search, insert);
fs.writeFileSync(path, text);
