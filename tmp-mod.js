const fs = require('fs');
const path = 'src/app/c/[orgId]/requests/ui/RequestsClient.tsx';
let text = fs.readFileSync(path, 'utf8');
const needle = "          <div className=\"absolute right-0 z-10 mt-2 w-52 rounded-md border border-lp-sec-4/60 bg-white p-2 text-sm shadow-lg\"\n            {editing ? (";
if (!text.includes(needle)) {
  console.error('needle not found');
  process.exit(1);
}
const insert = "          <div className=\\\"absolute right-0 z-10 mt-2 w-52 rounded-md border border-lp-sec-4/60 bg-white p-2 text-sm shadow-lg\\\"\\n            {nextStep?.cta?.kind === \\\"accept_offer\\\" && nextStep.cta.offer_id ? (\\n              <button\\n                type=\\\"button\\\"\\n                className=\\\"w-full rounded-md px-2 py-1 text-left text-lp-primary-1 hover:bg-lp-sec-4/30\\\"\\n                onClick={() => onAcceptOffer(nextStep.cta!.offer_id!)}\\n                disabled={busy}\\n              >\\n                {nextStep.cta.label ?? \\\"Aceptar oferta\\\"}\\n              </button>\\n            ) : null}\\n            {editing ? (";
text = text.replace(needle, insert);
fs.writeFileSync(path, text);
