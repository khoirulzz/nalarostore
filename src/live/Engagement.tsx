import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, useData } from "./api";
import { auth } from "../lib/firebase";
import { Icon } from "../components/Icon";

type Conversation = {
  id: string;
  customer_name: string;
  store_name: string;
  product_name?: string;
  last_message: string;
  unread: number;
};
type Message = {
  id: string;
  sender_kind: string;
  body: string;
  created_at: string;
};
function usePoll<T>(
  path: string | null,
  headers: Record<string, string> = {},
  revision = 0,
  interval = 8000,
) {
  const [value, setValue] = useState<T | null>(null),
    [loadedPath, setLoadedPath] = useState<string | null>(null),
    [error, setError] = useState("");
  const encoded = JSON.stringify(headers);
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    setError("");
    async function refresh() {
      try {
        if (path && !document.hidden) {
          const data = await api<T>(
            path,
            "GET",
            undefined,
            JSON.parse(encoded),
          );
          if (active) {
            setLoadedPath(path);
            setValue(data);
            setError("");
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) timer = setTimeout(() => void refresh(), interval);
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [path, encoded, revision, interval]);
  return { value: loadedPath === path ? value : null, error };
}
export function ResponsibleProfile({ sid }: { sid: string }) {
  const data = useData<{
    profile: Record<string, string | number | null> | null;
  }>(`/api/merchant/stores/${sid}/profile`);
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const f = new FormData(e.currentTarget);
    try {
      await api(
        `/api/merchant/stores/${sid}/profile`,
        "PUT",
        Object.fromEntries(
          [
            "full_name",
            "position",
            "contact_phone",
            "contact_email",
            "birth_date",
            "operational_address",
          ].map((key) => [
            key,
            key === "birth_date"
              ? f.get(key) || null
              : String(f.get(key) || ""),
          ]),
        ),
      );
      setStatus("Informasi penanggung jawab disimpan.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const p = data.value?.profile;
  return (
    <div className="seller-responsible-page">
      <div className="seller-page-heading">
        <div>
          <h1>Penanggung jawab toko</h1>
          <p>Informasi kontak untuk keperluan pengelolaan dan operasional toko.</p>
        </div>
      </div>
      {data.error && <p role="alert" className="live-error">{data.error}</p>}
      {!data.value && !data.error && <p aria-busy="true" className="seller-list-loading">Memuat informasi penanggung jawab…</p>}
      {data.value && (
        <div className="responsible-layout">
          <form className="work-section responsible-form" onSubmit={save}>
            <div className="responsible-form-heading">
              <span className="responsible-form-icon"><Icon name="users" size={20} /></span>
              <div><h2>Identitas & kontak</h2><p>Lengkapi data agar koordinasi toko berjalan lancar.</p></div>
            </div>
            <div className="responsible-form-grid">
              <label className="responsible-field">
                <span>Nama lengkap <em>*</em></span>
                <input name="full_name" required minLength={2} maxLength={120}
                  placeholder="Nama penanggung jawab"
                  defaultValue={String(p?.full_name || "")} autoComplete="name" />
              </label>
              <label className="responsible-field">
                <span>Jabatan <em>*</em></span>
                <input name="position" required minLength={2} maxLength={80}
                  placeholder="Contoh: Pemilik toko"
                  defaultValue={String(p?.position || "Pemilik")} />
              </label>
              <label className="responsible-field">
                <span>Nomor telepon <em>*</em></span>
                <input name="contact_phone" type="tel" required inputMode="tel" autoComplete="tel"
                  placeholder="Contoh: 081234567890" pattern="[+0-9 ()-]{8,25}"
                  defaultValue={String(p?.contact_phone || "")} />
              </label>
              <label className="responsible-field">
                <span>Email operasional</span>
                <input name="contact_email" type="email" maxLength={254}
                  placeholder="nama@tokomu.id" autoComplete="email"
                  defaultValue={String(p?.contact_email || "")} />
              </label>
              <label className="responsible-field">
                <span>Tanggal lahir <small>Opsional</small></span>
                <input name="birth_date" type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={String(p?.birth_date || "")} />
                <small>Hanya untuk administrasi internal{p?.age != null ? ` · ${p.age} tahun` : ""}.</small>
              </label>
              <label className="responsible-field responsible-field-wide">
                <span>Alamat operasional</span>
                <textarea name="operational_address" rows={4} maxLength={2000}
                  placeholder="Alamat kantor, gudang, atau lokasi operasional toko"
                  defaultValue={String(p?.operational_address || "")} />
              </label>
            </div>
            <div className="responsible-form-actions">
              <p>Kolom dengan tanda * wajib diisi.</p>
              <button type="submit" className="button button-dark" disabled={busy}>
                <Icon name={busy ? "refresh" : "check"} size={17} />
                {busy ? "Menyimpan…" : "Simpan informasi"}
              </button>
            </div>
            {status && <p role="status" className="responsible-feedback">{status}</p>}
          </form>
          <aside className="work-section responsible-info">
            <span className="responsible-info-icon"><Icon name="shield" size={22} /></span>
            <h2>Informasimu tetap privat</h2>
            <p>Data penanggung jawab hanya bisa diakses pemilik, manajer, dan admin platform yang berwenang. Tidak ditampilkan pada etalase pembeli.</p>
            <div><Icon name="check" size={16} /><span>Tidak ditampilkan ke pelanggan</span></div>
            <div><Icon name="check" size={16} /><span>Dapat diperbarui kapan saja</span></div>
          </aside>
        </div>
      )}
    </div>
  );
}
export function ChatThread({
  path,
  chatToken = "",
  seller = false,
}: {
  path: string;
  chatToken?: string;
  seller?: boolean;
}) {
  const headers: Record<string, string> = chatToken
    ? { "x-chat-token": chatToken }
    : {};
  const [revision, setRevision] = useState(0),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<{ body: string; id: string } | null>(null);
  const data = usePoll<{
    messages: Message[];
    hasMore: boolean;
    conversation: { customer_name: string };
  }>(path, headers, revision);
  const [older, setOlder] = useState<Message[]>([]),
    [more, setMore] = useState<boolean | null>(null),
    [olderBusy, setOlderBusy] = useState(false);
  useEffect(() => {
    setOlder([]);
    setMore(null);
    setText("");
    setPending(null);
    setError("");
  }, [path]);
  const messages = [...older, ...(data.value?.messages || [])].filter(
    (m, index, all) => all.findIndex((a) => a.id === m.id) === index,
  );
  const last = data.value?.messages.at(-1)?.id;
  useEffect(() => {
    if (last && !document.hidden)
      void api(
        path + "/read",
        "POST",
        { last_message_id: last },
        headers,
      ).catch(() => {});
  }, [last, path, chatToken]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    const draft =
      pending?.body === text.trim()
        ? pending
        : { body: text.trim(), id: crypto.randomUUID() };
    setPending(draft);
    try {
      await api(
        path,
        "POST",
        { body: draft.body, client_message_id: draft.id },
        headers,
      );
      setText("");
      setPending(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadOlder() {
    if (!messages[0]) return;
    setOlderBusy(true);
    try {
      const r = await api<{ messages: Message[]; hasMore: boolean }>(
        path + "?before=" + messages[0].id,
        "GET",
        undefined,
        headers,
      );
      setOlder((old) => [...r.messages, ...old]);
      setMore(r.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOlderBusy(false);
    }
  }
  return (
    <section className="work-section chat-thread" aria-label="Percakapan">
      <h2>
        {seller
          ? data.value?.conversation.customer_name || "Pelanggan"
          : "Chat toko"}
      </h2>
      <small>
        Pesan diperbarui saat halaman aktif. Jangan bagikan PIN atau kata sandi.
      </small>
      {(more ?? data.value?.hasMore) && (
        <button
          type="button"
          onClick={() => void loadOlder()}
          disabled={olderBusy}
        >
          Muat pesan sebelumnya
        </button>
      )}
      <div className="chat-messages" role="log" aria-live="polite">
        {messages.map((m) => (
          <article
            key={m.id}
            className={
              m.sender_kind === (seller ? "seller" : "buyer")
                ? "chat-bubble mine"
                : "chat-bubble"
            }
          >
            <p>{m.body}</p>
            <small>{new Date(m.created_at).toLocaleString("id-ID")}</small>
          </article>
        ))}
        {data.value && !messages.length && <p>Mulai percakapan dengan toko.</p>}
      </div>
      {(error || data.error) && (
        <p role="alert" className="live-error">
          {error || data.error}
        </p>
      )}
      {seller && (
        <div className="chat-quick-replies">
          {[
            "Halo, ada yang bisa kami bantu?",
            "Pesanan sedang kami periksa.",
            "Terima kasih sudah berbelanja.",
          ].map((t) => (
            <button type="button" key={t} onClick={() => setText(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={send}>
        <label>
          Pesan
          <textarea
            required
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
        </label>
        <button className="button button-dark" disabled={busy || !text.trim()}>
          {busy ? "Mengirim…" : "Kirim pesan"}
        </button>
      </form>
    </section>
  );
}
export function Conversations({ sid }: { sid?: string }) {
  const path = sid
    ? `/api/merchant/stores/${sid}/conversations`
    : "/api/customer/conversations";
  const data = usePoll<{ conversations: Conversation[] }>(path);
  const [selected, setSelected] = useState("");
  const conversations = data.value?.conversations || [];
  return (
    <>
      <div className="seller-page-heading">
        <div>
          <h1>Chat {sid ? "pelanggan" : "toko"}</h1>
          <p>Percakapan tersimpan terpisah untuk setiap toko.</p>
        </div>
      </div>
      {data.error && <p role="alert" className="live-error">{data.error}</p>}
      <div className={`chat-layout ${!conversations.length ? "chat-layout-empty" : ""} ${selected ? "has-selection" : ""}`}>
        <nav className="work-section chat-list" aria-label="Daftar percakapan">
          {conversations.map((c) => (
            <button
              type="button"
              key={c.id}
              className={selected === c.id ? "active" : ""}
              aria-current={selected === c.id ? "true" : undefined}
              onClick={() => setSelected(c.id)}
            >
              <strong>{sid ? c.customer_name : c.store_name}</strong>
              {c.product_name && <small>{c.product_name}</small>}
              {selected !== c.id && <span>{c.last_message || "Percakapan baru"}</span>}
              {c.unread > 0 && <b>{c.unread} baru</b>}
            </button>
          ))}
          {data.value && !conversations.length && (
            <div className="seller-empty-state chat-empty-state">
              <Icon name="mail" size={25} />
              <strong>Belum ada percakapan</strong>
              <p>Pesan baru dari pelanggan akan muncul di sini.</p>
            </div>
          )}
          {!data.value && !data.error && (
            <p className="seller-list-loading" aria-busy="true">Memuat percakapan…</p>
          )}
        </nav>
        {selected ? (
          <div className="chat-thread-frame">
            <button type="button" className="chat-back-button" onClick={() => setSelected("")}>
              <Icon name="arrow-left" size={17} /> Kembali ke percakapan
            </button>
            <ChatThread
              key={selected}
              path={sid ? path + "/" + selected : "/api/public/chat/" + selected}
              seller={!!sid}
            />
          </div>
        ) : conversations.length > 0 ? (
          <section className="work-section chat-select-prompt">
            <Icon name="mail" size={25} />
            <strong>Pilih percakapan</strong>
            <p>Baca dan balas pesan melalui daftar di samping.</p>
          </section>
        ) : null}
      </div>
    </>
  );
}
export function StoreChat({
  endpoint,
  accountURL,
}: {
  endpoint: string;
  accountURL: string;
}) {
  const storageKey =
    "nalaro-chat:" + endpoint + ":" + (auth?.currentUser?.uid || "guest");
  const [open, setOpen] = useState(false),
    [session, setSession] = useState<{ id: string; chat_token: string } | null>(
      () => {
        try {
          const value = JSON.parse(
            sessionStorage.getItem(storageKey) || "null",
          );
          return value &&
            typeof value.id === "string" &&
            typeof value.chat_token === "string"
            ? value
            : null;
        } catch {
          return null;
        }
      },
    );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const name = String(new FormData(e.currentTarget).get("name") || "");
    try {
      const r = await api<{ id: string; chat_token: string }>(
        endpoint + "/conversations",
        "POST",
        { customer_name: name },
      );
      setSession(r);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(r));
      } catch {
        /* Keep the current conversation in memory. */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="store-chat">
      <button
        className="button button-dark"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Tutup chat" : "Chat toko"}
      </button>
      {open && (
        <div className="store-chat-panel">
          <a href={accountURL}>Akun & riwayat percakapan</a>
          {session ? (
            <>
              <ChatThread
                path={"/api/public/chat/" + session.id}
                chatToken={session.chat_token}
              />
              <button
                onClick={() => {
                  setSession(null);
                  try {
                    sessionStorage.removeItem(storageKey);
                  } catch {
                    /* memory only */
                  }
                }}
              >
                Mulai percakapan baru
              </button>
            </>
          ) : (
            <form className="live-form work-section" onSubmit={start}>
              <h2>Hubungi toko</h2>
              <p>
                Kamu bisa chat tanpa akun. Simpan tab ini untuk melanjutkan
                percakapan tamu.
              </p>
              <label>
                Nama kamu
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              {error && <p role="alert">{error}</p>}
              <button className="button button-dark" disabled={busy}>
                Mulai chat
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
export function Notifications({ sid }: { sid: string }) {
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const data = usePoll<{
    notifications: {
      key: string;
      title: string;
      body: string;
      route: string;
      created_at: string;
      is_read: boolean;
    }[];
    unread: number;
  }>(`/api/merchant/stores/${sid}/notifications`, {}, revision);
  async function read() {
    if (busy || !data.value?.unread) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/merchant/stores/${sid}/notifications/read`, "POST", {
        keys: data.value.notifications.filter((n) => !n.is_read).map((n) => n.key),
      });
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const context = new URLSearchParams(window.location.search).get("adminStore");
  const notifications = data.value?.notifications || [];
  const unread = data.value?.unread || 0;
  return (
    <>
      <div className="seller-page-heading seller-notification-heading">
        <div>
          <h1>Notifikasi</h1>
          <p>{unread ? `${unread} notifikasi belum dibaca` : "Kabar terbaru tentang aktivitas tokomu."}</p>
        </div>
        {unread > 0 ? (
          <button type="button" className="button button-dark seller-read-all" onClick={() => void read()} disabled={busy}>
            <Icon name="check" size={16} /> {busy ? "Menyimpan…" : "Tandai semua dibaca"}
          </button>
        ) : data.value ? (
          <span className="seller-all-read"><Icon name="check" size={16} /> Semua dibaca</span>
        ) : null}
      </div>
      {(error || data.error) && <p role="alert" className="live-error">{error || data.error}</p>}
      {data.value && !notifications.length ? (
        <section className="work-section seller-empty-state">
          <Icon name="bell" size={25} />
          <strong>Belum ada notifikasi</strong>
          <p>Informasi pesanan dan aktivitas toko akan muncul di sini.</p>
        </section>
      ) : (
        <div className="seller-notification-list">
          {notifications.map((n) => (
            <Link
              className={`work-section notification-row ${n.is_read ? "" : "unread"}`}
              key={n.key}
              to={"/app/" + n.route + (context ? "?adminStore=" + context : "")}
            >
              <span className="seller-notification-mark" aria-hidden="true"><Icon name="bell" size={17} /></span>
              <span className="seller-notification-copy">
                <strong>{n.title}</strong>
                <span>{n.body}</span>
                <small>{new Date(n.created_at).toLocaleString("id-ID")}</small>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
          ))}
          {!data.value && !data.error && (
            <p className="seller-list-loading" aria-busy="true">Memuat notifikasi…</p>
          )}
        </div>
      )}
    </>
  );
}

export function NotificationBell({
  sid,
  contextQuery,
}: {
  sid: string;
  contextQuery: string;
}) {
  const data = usePoll<{ unread: number }>(
    `/api/merchant/stores/${sid}/notifications`,
    {},
    0,
    30000,
  );
  const unread = data.value?.unread || 0;
  return (
    <Link
      className="seller-notification-bell"
      to={"/app/notifications" + contextQuery}
      aria-label={`Notifikasi${unread ? ", " + unread + " belum dibaca" : ""}`}
    >
      <Icon name="bell" size={20} />
      {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
    </Link>
  );
}
