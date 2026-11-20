// Login-code email through Resend's HTTP API (no SDK).
import { fail } from './http.js';

const T = {
  pt: {
    subject: (c) => `${c} é o seu código do Vice Paws 🐾`,
    hello: 'Seu código de entrada',
    intro: 'Use este código para entrar no Vice Paws e salvar os seus gatos e o seu progresso:',
    expires: 'Ele vale por 10 minutos e só pode ser usado uma vez.',
    ignore: 'Não foi você? É só ignorar este e-mail — nada acontece sem o código.',
    sign: 'Mimo, Mimosa e Mortícia estão te esperando na cidade.',
  },
  en: {
    subject: (c) => `${c} is your Vice Paws code 🐾`,
    hello: 'Your sign-in code',
    intro: 'Use this code to sign in to Vice Paws and save your cats and your progress:',
    expires: 'It is valid for 10 minutes and can only be used once.',
    ignore: "Wasn't you? Just ignore this email — nothing happens without the code.",
    sign: 'Mimo, Mimosa and Morticia are waiting for you in the city.',
  },
};

export function loginEmail(code, lang) {
  const t = T[lang] || T.pt;
  const html = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'pt-BR'}"><body style="margin:0;padding:0;background:#12061f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#12061f;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#1d0b33;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td align="center" style="background:#ff2e93;background:linear-gradient(135deg,#ff2e93,#ff8a3d 55%,#21e6d0);padding:26px 20px;">
<div style="font-size:30px;font-weight:900;letter-spacing:3px;color:#ffffff;text-shadow:0 2px 0 #7a1250;">VICE PAWS</div>
<div style="font-size:22px;line-height:30px;">🐾🌴</div>
</td></tr>
<tr><td style="padding:26px 26px 8px;color:#f6eaff;">
<div style="font-size:19px;font-weight:700;color:#21e6d0;margin-bottom:10px;">${t.hello}</div>
<div style="font-size:15px;line-height:22px;">${t.intro}</div>
</td></tr>
<tr><td align="center" style="padding:14px 26px;">
<div style="display:inline-block;background:#12061f;border:2px solid #ff2e93;border-radius:14px;padding:14px 22px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#ffffff;">${code}</div>
</td></tr>
<tr><td style="padding:8px 26px 24px;color:#cdb8e6;font-size:13px;line-height:20px;">
${t.expires}<br>${t.ignore}
<div style="margin-top:16px;color:#ff8ac4;">${t.sign}</div>
</td></tr>
</table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7d6699;margin-top:14px;">@mimo.mimosa.morticia</div>
</td></tr></table></body></html>`;
  const text = `VICE PAWS\n\n${t.hello}: ${code}\n\n${t.intro}\n${t.expires}\n${t.ignore}\n\n${t.sign}`;
  return { subject: t.subject(code), html, text };
}

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendLoginCode({ email, code, lang }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw fail(503, 'mail-offline');
  const { subject, html, text } = loginEmail(code, lang);
  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Vice Paws <jogo@resend.dev>',
        to: [email], subject, html, text,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw fail(502, 'mail');
  }
  if (!r.ok) {
    console.error('vp-api resend status', r.status);   // status only: no key, no address
    throw fail(502, 'mail');
  }
}
