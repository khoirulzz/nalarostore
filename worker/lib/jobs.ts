import type { DB } from "./db";
export async function deliverOutbox(
  db: DB,
  email: SendEmail | undefined,
  from: string,
) {
  if (!email) return 0;
  await db.query(
    "UPDATE outbox_events SET status='failed' WHERE status='processing' AND attempts>=8 AND next_attempt_at<now()-interval '5 minutes'",
  );
  let count = 0;
  for (let i = 0; i < 20; i++) {
    const event = await db.tx(async (tx) => {
      const row = (
        await tx.query(
          `SELECT * FROM outbox_events WHERE (status='pending' OR (status='processing' AND next_attempt_at<now()-interval '5 minutes')) AND next_attempt_at<=now() AND attempts<8 ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        )
      )[0];
      if (!row) return null;
      await tx.query(
        `UPDATE outbox_events SET status='processing',attempts=attempts+1,next_attempt_at=now() WHERE id=$1`,
        [row.id],
      );
      return row;
    });
    if (!event) break;
    try {
      const p = event.payload;
      const escape = (s: string) =>
        s.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c]!,
        );
      await email.send({
        from: { email: from, name: "Nalaro Store" },
        to: p.to,
        subject: p.subject,
        text: p.text,
        html: `<div style="font-family:Arial;color:#151515;max-width:600px"><h1 style="font-size:24px">${escape(p.subject)}</h1><p style="white-space:pre-line;line-height:1.6">${escape(p.text).replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#b44724">${url}</a>`)}</p><hr><p>Nalaro Store · nalaro.digital</p></div>`,
      });
      await db.query(`UPDATE outbox_events SET status='sent' WHERE id=$1`, [
        event.id,
      ]);
      count++;
    } catch {
      await db.query(
        `UPDATE outbox_events SET status=CASE WHEN attempts>=8 THEN 'failed' ELSE 'pending' END,next_attempt_at=now()+interval '1 minute'*power(2,LEAST(attempts,8)) WHERE id=$1`,
        [event.id],
      );
    }
  }
  return count;
}
export async function cleanup(db: DB) {
  await db.query("DELETE FROM auth_sessions WHERE expires_at<now()");
  await db.query("DELETE FROM verification_tokens WHERE expires_at<now()");
  await db.query(
    "DELETE FROM rate_limits WHERE window_start<now()-interval '1 day'",
  );
  await db.query(
    "DELETE FROM outbox_events WHERE status='sent' AND created_at<now()-interval '30 days'",
  );
}
