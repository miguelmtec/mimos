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

/** Sends one e-mail through Resend. Logs the HTTP status only: never the address, the key or the body. */
export async function sendMail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw fail(503, 'mail-offline');
  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Vice Paws <jogo@resend.dev>', to: [to], subject, html, text }),
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

export async function sendLoginCode({ email, code, lang }) {
  const { subject, html, text } = loginEmail(code, lang);
  return sendMail({ to: email, subject, html, text });
}

/** Public base URL for links inside e-mails (links carry tokens in the #fragment, never in the query string). */
export const baseUrl = () => String(process.env.PUBLIC_URL || 'https://vice-paws.vercel.app').replace(/\/+$/, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Transactional notices. The only user-typed text that ever lands in them is the guardian's own name (escaped).
const N = {
  pt: {
    guardian: { s: 'Aprovação do responsável: conta infantil no Vice Paws', p: ['Olá. Uma criança ou adolescente com menos de 16 anos criou uma conta no jogo Vice Paws (@mimo.mimosa.morticia) e informou você como responsável legal.', 'Pela Lei 15.211/2025 (ECA Digital) e pela LGPD (art. 14), a conta só é liberada com a sua autorização. Você pode aprovar ou simplesmente ignorar este e-mail (a conta continua só como visitante). O link vale por 7 dias e só pode ser usado uma vez.', 'Guardamos o mínimo: e-mail, mês/ano de nascimento (criptografado) e os gatos da criança. Sem senha e sem documentos. Pedidos de acesso ou exclusão: jogo@mtec.tec.br.'], b: 'Aprovar a conta' },
    guardianNotice: { s: 'Seu filho(a) criou uma conta no Vice Paws', p: ['Olá. Um adolescente de 16 ou 17 anos criou uma conta no jogo Vice Paws e informou este e-mail como o do responsável.', 'Este aviso é só para você ficar ciente (Lei 15.211/2025). Nenhuma ação é necessária. Para pedir acesso ou exclusão dos dados: jogo@mtec.tec.br.'] },
    approved: { s: 'Sua conta do Vice Paws foi aprovada', p: ['O seu responsável aprovou a conta. Já dá para entrar com o Google ou com o código por e-mail.'] },
    deleted: { s: 'Sua conta do Vice Paws foi excluída', p: ['Conforme pedido, apagamos a sua conta e os dados pessoais associados. Se não foi você, escreva para jogo@mtec.tec.br.'] },
  },
  en: {
    guardian: { s: 'Guardian approval: child account on Vice Paws', p: ['Hello. A child or teen under 16 created an account in the game Vice Paws (@mimo.mimosa.morticia) and named you as the legal guardian.', 'Under Brazilian law (Lei 15.211/2025 ECA Digital and LGPD art. 14), the account is only enabled with your consent. You can approve, or just ignore this email (the account stays guest-only). The link is valid for 7 days and works once.', "We keep the minimum: email, birth month/year (encrypted) and the child's cats. No password, no documents. Access or deletion requests: jogo@mtec.tec.br."], b: 'Approve the account' },
    guardianNotice: { s: 'Your teen created a Vice Paws account', p: ['Hello. A 16 or 17 year old created an account in the game Vice Paws and gave this email as the guardian\'s.', 'This is only a notice (Lei 15.211/2025). No action is needed. Access or deletion requests: jogo@mtec.tec.br.'] },
    approved: { s: 'Your Vice Paws account was approved', p: ['Your guardian approved the account. You can now sign in with Google or with the email code.'] },
    deleted: { s: 'Your Vice Paws account was deleted', p: ['As requested, we deleted your account and the personal data attached to it. If it was not you, write to jogo@mtec.tec.br.'] },
  },
};

/** kind: guardian | guardianNotice | approved | deleted. vars: {name, url}. */
export function noticeEmail(kind, lang, vars = {}) {
  const t = (N[lang] || N.pt)[kind];
  const paras = t.p.map((x) => x.replace('{name}', vars.name || ''));
  const button = t.b && vars.url
    ? `<tr><td align="center" style="padding:6px 26px 18px;"><a href="${esc(vars.url)}" style="display:inline-block;background:#ff2e93;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:13px 24px;border-radius:12px;">${esc(t.b)}</a></td></tr>`
    : '';
  const html = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'pt-BR'}"><body style="margin:0;padding:0;background:#12061f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#12061f;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#1d0b33;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td align="center" style="background:#ff2e93;background:linear-gradient(135deg,#ff2e93,#ff8a3d 55%,#21e6d0);padding:22px 20px;"><div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#ffffff;">VICE PAWS 🐾</div></td></tr>
<tr><td style="padding:24px 26px 8px;color:#f6eaff;"><div style="font-size:18px;font-weight:700;color:#21e6d0;margin-bottom:10px;">${esc(t.s)}</div>
${paras.map((x) => `<div style="font-size:15px;line-height:22px;margin-bottom:10px;">${esc(x)}</div>`).join('')}</td></tr>
${button}
</table></td></tr></table></body></html>`;
  const text = `VICE PAWS\n\n${t.s}\n\n${paras.join('\n\n')}${t.b && vars.url ? `\n\n${t.b}: ${vars.url}` : ''}\n`;
  return { subject: t.s, html, text };
}

export const sendNotice = (to, kind, lang, vars) => sendMail({ to, ...noticeEmail(kind, lang, vars) });
