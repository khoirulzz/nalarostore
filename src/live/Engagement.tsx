import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, useData, rupiah, type Product } from "./api";
import { auth } from "../lib/firebase";
import { Icon } from "../components/Icon";

type Conversation = {
  id: string;
  customer_name: string;
  store_name: string;
  store_slug?: string;
  product_name?: string;
  last_message: string;
  unread: number;
};
type ChatProduct = {
  id: string;
  name: string;
  slug: string;
  primary_image_url: string | null;
  price_idr: number;
  store_slug: string;
  status: string;
};
type Message = {
  id: string;
  sender_kind: string;
  body: string;
  created_at: string;
  product?: ChatProduct | null;
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
                <input name="full_name" aria-label="Nama lengkap" required minLength={2} maxLength={120}
                  placeholder="Nama penanggung jawab"
                  defaultValue={String(p?.full_name || "")} autoComplete="name" />
              </label>
              <label className="responsible-field">
                <span>Jabatan <em>*</em></span>
                <input name="position" aria-label="Jabatan" required minLength={2} maxLength={80}
                  placeholder="Contoh: Pemilik toko"
                  defaultValue={String(p?.position || "Pemilik")} />
              </label>
              <label className="responsible-field">
                <span>Nomor telepon <em>*</em></span>
                <input name="contact_phone" aria-label="Nomor telepon" type="tel" required inputMode="tel" autoComplete="tel"
                  placeholder="Contoh: 081234567890" pattern="[+0-9 ()-]{8,25}"
                  defaultValue={String(p?.contact_phone || "")} />
              </label>
              <label className="responsible-field">
                <span>Email operasional</span>
                <input name="contact_email" aria-label="Email operasional" type="email" maxLength={254}
                  placeholder="nama@tokomu.id" autoComplete="email"
                  defaultValue={String(p?.contact_email || "")} />
              </label>
              <label className="responsible-field">
                <span>Tanggal lahir <small>Opsional</small></span>
                <input name="birth_date" aria-label="Tanggal lahir (opsional)" type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={String(p?.birth_date || "")} />
                <small>Hanya untuk administrasi internal{p?.age != null ? ` · ${p.age} tahun` : ""}.</small>
              </label>
              <label className="responsible-field responsible-field-wide">
                <span>Alamat operasional</span>
                <textarea name="operational_address" aria-label="Alamat operasional" rows={4} maxLength={2000}
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
function ChatProductCard({ product }: { product: ChatProduct }) {
  const content = (
    <>
      {product.primary_image_url ? <img src={product.primary_image_url} alt="" loading="lazy" /> :
        <span className="chat-product-placeholder"><Icon name="box" size={20} /></span>}
      <span className="chat-product-details">
        <strong>{product.name}</strong>
        <small>{rupiah(product.price_idr)}</small>
        {product.status !== "active" && <small>Produk tidak lagi tersedia</small>}
      </span>
      {product.status === "active" && <Icon name="arrow-up-right" size={16} />}
    </>
  );
  return product.status === "active"
    ? <Link className="chat-product-card" to={`/s/${product.store_slug}/product/${product.slug}`}>{content}</Link>
    : <div className="chat-product-card">{content}</div>;
}
export function ChatThread({
  path,
  chatToken = "",
  seller = false,
  products = [],
  initialProduct = null,
  attachmentsEnabled = true,
}: {
  path: string;
  chatToken?: string;
  seller?: boolean;
  products?: Product[];
  initialProduct?: Product | null;
  attachmentsEnabled?: boolean;
}) {
  const headers: Record<string, string> = chatToken
    ? { "x-chat-token": chatToken }
    : {};
  const [revision, setRevision] = useState(0),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<{ body: string; id: string; product_id?: string } | null>(null),
    [chosenProduct, setChosenProduct] = useState<Product | null>(initialProduct),
    [pickerOpen, setPickerOpen] = useState(false);
  const data = usePoll<{
    messages: Message[];
    hasMore: boolean;
    conversation: { customer_name: string; product?: ChatProduct | null };
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
    setChosenProduct(initialProduct);
    setPickerOpen(false);
  }, [path]);
  useEffect(() => {
    if (initialProduct) setChosenProduct(initialProduct);
  }, [initialProduct]);
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
    if (busy || (!text.trim() && !chosenProduct)) return;
    setBusy(true);
    setError("");
    const fallbackBody = chosenProduct && !attachmentsEnabled
      ? [text.trim() || "Halo, saya ingin bertanya tentang produk ini.", "Produk: " + chosenProduct.name].join("\n")
      : text.trim();
    const attachmentId = attachmentsEnabled ? chosenProduct?.id : undefined;
    const draft =
      pending?.body === fallbackBody && pending.product_id === attachmentId
        ? pending
        : { body: fallbackBody, id: crypto.randomUUID(), product_id: attachmentId };
    setPending(draft);
    try {
      await api(
        path,
        "POST",
        { body: draft.body, product_id: draft.product_id, client_message_id: draft.id },
        headers,
      );
      setText("");
      setChosenProduct(null);
      setPickerOpen(false);
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
      {data.value?.conversation.product && (
        <div className="chat-conversation-product">
          <span>Produk yang ditanyakan</span>
          <ChatProductCard product={data.value.conversation.product} />
        </div>
      )}
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
            {m.product && <ChatProductCard product={m.product} />}
            {m.body && <p>{m.body}</p>}
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
        {!seller && attachmentsEnabled && !!products.length && (
          <div className="chat-product-picker">
            <button type="button" className="chat-attach-toggle" aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((value) => !value)}>
              <Icon name="plus" size={16} /> Lampirkan produk
            </button>
            {pickerOpen && (
              <div className="chat-product-choices" aria-label="Pilih produk untuk dilampirkan">
                {products.filter((product) => product.status === "active").slice(0, 50).map((product) => (
                  <button type="button" key={product.id} onClick={() => { setChosenProduct(product); setPickerOpen(false); }}>
                    {product.primary_image_url && <img src={product.primary_image_url} alt="" loading="lazy" />}
                    <span><strong>{product.name}</strong><small>{rupiah(product.price_idr)}</small></span>
                    <Icon name="plus" size={16} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {chosenProduct && (
          <div className="chat-selected-product">
            <Icon name="box" size={18} />
            <span><strong>{chosenProduct.name}</strong><small>{rupiah(chosenProduct.price_idr)} · Akan dilampirkan</small></span>
            <button type="button" aria-label="Hapus lampiran produk" onClick={() => setChosenProduct(null)}><Icon name="close" size={17} /></button>
          </div>
        )}
        <label>
          Pesan
          <textarea
            required={!chosenProduct}
            maxLength={3900}
            placeholder="Tulis pesan untuk toko…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
        </label>
        <button className="button button-dark" disabled={busy || (!text.trim() && !chosenProduct)}>
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
  const selectedConversation = conversations.find((conversation) => conversation.id === selected);
  const capabilities = useData<{ productChatAttachments?: boolean }>("/api/public/capabilities");
  const availableProducts = useData<{ products: Product[] }>(
    !sid && selectedConversation?.store_slug
      ? "/api/public/stores/" + selectedConversation.store_slug + "/products"
      : null,
  );
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
              products={!sid ? (availableProducts.value?.products || []) : []}
              attachmentsEnabled={capabilities.value?.productChatAttachments === true}
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
  products = [],
  request = null,
  attachmentsEnabled = false,
}: {
  endpoint: string;
  accountURL: string;
  products?: Product[];
  request?: { product: Product; key: number } | null;
  attachmentsEnabled?: boolean;
}) {
  const storageKey =
    "nalaro-chat:" + endpoint + ":" + (auth?.currentUser?.uid || "guest");
  const [open, setOpen] = useState(false),
    [contextProduct, setContextProduct] = useState<Product | null>(null),
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
  useEffect(() => {
    if (request?.product) {
      setContextProduct(request.product);
      setOpen(true);
    }
  }, [request?.key]);
  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const name = String(new FormData(e.currentTarget).get("name") || "");
    try {
      const r = await api<{ id: string; chat_token: string }>(
        endpoint + "/conversations",
        "POST",
        { customer_name: name, product_id: contextProduct?.id },
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
        type="button"
        className="button button-dark sf-chat-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Tutup chat" : "Chat toko"}
      >
        <Icon name={open ? "close" : "mail"} size={21} />
        <span>{open ? "Tutup chat" : "Chat toko"}</span>
      </button>
      {open && (
        <div className="store-chat-panel">
          <a href={accountURL}>Akun & riwayat percakapan</a>
          {session ? (
            <>
              <ChatThread
                path={"/api/public/chat/" + session.id}
                chatToken={session.chat_token}
                initialProduct={contextProduct}
                products={products}
                attachmentsEnabled={attachmentsEnabled}
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
                <input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Nama yang ingin ditampilkan" />
              </label>
              <label>
                Produk yang ingin ditanyakan (opsional)
                <select value={contextProduct?.id || ""} onChange={(e) => setContextProduct(products.find((p) => p.id === e.target.value) || null)}>
                  <option value="">Chat umum dengan toko</option>
                  {products.filter((p) => p.status === "active").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              {contextProduct && <p className="chat-intro-product"><Icon name="box" size={16} /> {contextProduct.name}</p>}
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
