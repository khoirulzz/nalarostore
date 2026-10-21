import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  validatePassword,
  verifyPasswordResetCode,
  type PasswordValidationStatus,
} from "firebase/auth";
import { api, type User } from "./api";
import {
  auth,
  authReady,
  authError,
  firebaseConfigured,
  firebaseEmulated,
  passwordRules,
  requireFirebase,
} from "../lib/firebase";
import { StoreDialog } from "./storefront/Commerce";
import { LampLoginFrame } from "./LampLogin";
import { Icon } from "../components/Icon";

function Frame({
  children,
  title,
  description,
  compact = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <main className={`auth-page ${compact ? "auth-page-compact" : ""}`}>
      <Link className="brand" to="/">
        <img src="/favicon-32x32.png" alt="" />
        nalaro store
      </Link>
      <div className="auth-layout">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
          <Link to="/demo/nalaro-fashion">Lihat contoh toko</Link>
        </div>
        {children}
      </div>
    </main>
  );
}
export function PasswordField({
  value,
  change,
  title = "Kata sandi",
  current = false,
}: {
  value: string;
  change: (s: string) => void;
  title?: string;
  current?: boolean;
}) {
  const [show, setShow] = useState(false),
    [policy, setPolicy] = useState<PasswordValidationStatus>();
  useEffect(() => {
    if (current || !auth || firebaseEmulated) return;
    let active = true;
    void validatePassword(auth, "")
      .then((p) => {
        if (active) setPolicy(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [current]);
  return (
    <div>
      <label>
        {title}
        <span className="password-input">
          <input
            aria-label={title}
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={
              current
                ? 1
                : (policy?.passwordPolicy.customStrengthOptions
                    .minPasswordLength ?? 8)
            }
            maxLength={
              policy?.passwordPolicy.customStrengthOptions.maxPasswordLength ??
              4096
            }
            autoComplete={current ? "current-password" : "new-password"}
            value={value}
            onChange={(e) => change(e.target.value)}
            aria-describedby={current ? undefined : "password-rules"}
          />
          <button
            type="button"
            aria-label={
              show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            aria-pressed={show}
            onClick={() => setShow((s) => !s)}
          >
            {show ? "Sembunyikan" : "Lihat"}
          </button>
        </span>
      </label>
      {!current && (
        <ul id="password-rules" className="password-rules">
          {passwordRules(value, policy).map((r) => (
            <li key={r.text} className={value && r.valid ? "met" : ""}>
              {value && r.valid ? "Terpenuhi: " : ""}
              {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
async function dashboardRoute(): Promise<string> {
  // The Worker, not a client-side email comparison, owns platform privileges.
  const { user } = await api<{ user: User | null }>("/api/auth/me");
  if (!user) throw Error("Sesi akun belum tersedia. Silakan masuk kembali.");
  return !user.verified ? "/verify" : user.admin ? "/admin" : "/app";
}

async function checkPassword(password: string) {
  const a = requireFirebase();
  if (firebaseEmulated) {
    if (!passwordRules(password).every((r) => r.valid))
      throw Error("Kata sandi belum memenuhi persyaratan.");
    return;
  }
  const status = await validatePassword(a, password);
  if (!status.isValid || !passwordRules(password, status).every((r) => r.valid))
    throw Error(
      "Kata sandi belum memenuhi persyaratan. Lengkapi kriteria di bawah.",
    );
}
async function passwordAccount(
  email: string,
  password: string,
  register: boolean,
) {
  await authReady;
  const a = requireFirebase();
  if (register) {
    await checkPassword(password);
    return (await createUserWithEmailAndPassword(a, email, password)).user;
  }
  return (await signInWithEmailAndPassword(a, email, password)).user;
}
export function Auth({
  register = false,
  buyer = false,
}: {
  register?: boolean;
  buyer?: boolean;
}) {
  const [search] = useSearchParams();
  const next = search.get("next") || "/account";
  const destination =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/account";
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState("");
  const navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const email = String(
      new FormData(e.currentTarget).get("email") || "",
    ).trim();
    try {
      if (register) {
        const user = await passwordAccount(email, password, true);
        try {
          await sendEmailVerification(user, {
            url: window.location.origin + "/verify" + (buyer ? "?buyer=1" : ""),
          });
        } catch (mailError) {
          navigate(buyer ? "/verify?buyer=1" : "/verify");
          throw mailError;
        }
        navigate(buyer ? "/verify?buyer=1" : "/verify");
      } else {
        await passwordAccount(email, password, false);
        const route = await dashboardRoute();
        navigate(
          buyer
            ? route === "/verify"
              ? "/verify?buyer=1"
              : destination
            : route,
          { replace: true },
        );
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <form className="live-form" onSubmit={submit} aria-busy={busy}>
      <h2>
        {register
          ? buyer
            ? "Buat akun Nalaro"
            : "Buat akun penjual"
          : "Masuk ke akun"}
      </h2>
      {!buyer && (
        <p className="shop-login-form-intro">
          {register
            ? "Daftar untuk mulai menyiapkan tokomu."
            : "Gunakan akun Nalaro Store milikmu."}
        </p>
      )}
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@email.com"
          maxLength={254}
        />
      </label>
      <PasswordField
        value={password}
        change={setPassword}
        current={!register}
      />
      {error && (
        <p role="alert" className="live-error" tabIndex={-1}>
          {error}
        </p>
      )}
      {!firebaseConfigured && (
        <p role="alert">Konfigurasi Firebase belum tersedia.</p>
      )}
      <button
        className="button button-dark"
        disabled={busy || !firebaseConfigured}
      >
        {busy ? "Memproses..." : register ? "Buat akun" : "Masuk"}
        {!buyer && !busy && <Icon name="arrow-right" size={17} />}
      </button>
      {!register && <Link to="/forgot-password">Lupa kata sandi?</Link>}
      <p>
        {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
        <Link
          to={
            (buyer ? "/buyer" : "") +
            (register ? "/login" : "/register") +
            (buyer ? "?next=" + encodeURIComponent(destination) : "")
          }
        >
          {register ? "Masuk" : "Daftar"}
        </Link>
      </p>
    </form>
  );
  if (!buyer)
    return <LampLoginFrame register={register}>{content}</LampLoginFrame>;
  return (
    <Frame
      title={
        buyer
          ? register
            ? "Satu akun untuk belanja di Nalaro."
            : "Selamat datang kembali."
          : register
            ? "Mulai toko atas nama bisnismu."
            : "Kembali ke workspace."
      }
      description={
        buyer
          ? "Simpan alamat, lihat pesanan lintas toko, dan lanjutkan percakapan. Belanja tanpa akun tetap tersedia."
          : "Produk, stok, dan pesanan dikelola dalam satu tempat. Pelanggan tetap bisa berbelanja tanpa membuat akun."
      }
    >
      {content}
    </Frame>
  );
}
export function AuthDrawer({ close }: { close: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [user, setUser] = useState(auth?.currentUser || null),
    [ready, setReady] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void authReady
      .then(() => {
        if (active) setReady(true);
      })
      .catch((e) => {
        if (active) {
          setError(authError(e));
          setReady(true);
        }
      });
    const unsubscribe = auth ? onIdTokenChanged(auth, setUser) : undefined;
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const email = String(
      new FormData(e.currentTarget).get("email") || "",
    ).trim();
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(requireFirebase(), email);
        setMessage(
          "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan spam.",
        );
      } else {
        const account = await passwordAccount(
          email,
          password,
          mode === "register",
        );
        if (mode === "register")
          await sendEmailVerification(account, {
            url: window.location.origin + "/verify?buyer=1",
          });
        if (account.emailVerified) {
          await api("/api/auth/me");
          close();
        } else
          setMessage(
            "Periksa emailmu untuk memverifikasi akun. Kamu bisa melanjutkan belanja di sini.",
          );
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(resend = false) {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (resend) {
        await sendEmailVerification(user, {
          url: window.location.origin + "/verify?buyer=1",
        });
        setMessage("Email verifikasi dikirim. Periksa kotak masuk dan spam.");
      } else {
        await reload(user);
        await user.getIdToken(true);
        if (user.emailVerified) {
          await api("/api/auth/me");
          close();
        } else
          setMessage(
            "Email belum terverifikasi. Buka tautan di email, lalu periksa lagi.",
          );
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <StoreDialog title="Akun Nalaro Store" close={close}>
      <p className="sf-auth-intro">
        Satu akun untuk menyimpan alamat, pesanan, dan percakapan di semua toko
        Nalaro.
      </p>
      {!ready ? (
        <p role="status">Memulihkan sesi akun…</p>
      ) : user ? (
        <div className="sf-auth-session">
          <strong>{user.email}</strong>
          <p>
            {user.emailVerified
              ? "Akunmu siap digunakan untuk belanja."
              : "Verifikasi email untuk menyimpan pesanan dan memakai alamat tersimpan."}
          </p>
          {user.emailVerified ? (
            <Link className="pdp-add" to="/account">
              Buka akun pembeli
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="pdp-add"
                disabled={busy}
                onClick={() => void verify()}
              >
                Saya sudah memverifikasi email
              </button>
              <button
                type="button"
                className="sf-text-button"
                disabled={busy}
                onClick={() => void verify(true)}
              >
                Kirim ulang email verifikasi
              </button>
            </>
          )}
        </div>
      ) : (
        <form className="live-form sf-auth-form" onSubmit={submit}>
          <h3>
            {mode === "register"
              ? "Buat akun baru"
              : mode === "reset"
                ? "Pulihkan kata sandi"
                : "Masuk untuk lanjut belanja"}
          </h3>
          <label>
            Email
            <input
              data-autofocus
              autoFocus
              type="email"
              name="email"
              required
              autoComplete="email"
              maxLength={254}
            />
          </label>
          {mode !== "reset" && (
            <PasswordField
              value={password}
              change={setPassword}
              current={mode === "login"}
            />
          )}
          <button className="pdp-add" disabled={busy || !firebaseConfigured}>
            {busy
              ? "Memproses…"
              : mode === "register"
                ? "Buat akun"
                : mode === "reset"
                  ? "Kirim tautan pemulihan"
                  : "Masuk"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="sf-text-button"
              onClick={() => {
                setMode("reset");
                setError("");
                setMessage("");
              }}
            >
              Lupa kata sandi?
            </button>
          )}
          <p>
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button
              type="button"
              className="sf-text-button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setPassword("");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login" ? "Daftar akun baru" : "Masuk"}
            </button>
          </p>
        </form>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="sf-auth-continue sf-text-button"
        disabled={busy}
        onClick={() => {
          if (user && !user.emailVerified)
            void signOut(requireFirebase())
              .then(close)
              .catch((e) => setError(authError(e)));
          else close();
        }}
      >
        {user?.emailVerified ? "Lanjut belanja" : "Lanjut tanpa akun"} →
      </button>
    </StoreDialog>
  );
}

export function ForgotPassword() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(
        requireFirebase(),
        String(new FormData(e.currentTarget).get("email") || "").trim(),
        { url: window.location.origin + "/login" },
      );
      setMessage(
        "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa inbox dan spam.",
      );
    } catch (e) {
      if ((e as { code?: string }).code === "auth/user-not-found")
        setMessage(
          "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa inbox dan spam.",
        );
      else setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame
      title="Pulihkan akses akunmu."
      description="Gunakan email yang terhubung ke akun merchant."
    >
      <form className="live-form" onSubmit={submit}>
        <h2>Lupa kata sandi</h2>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        {message && <p role="status">{message}</p>}
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-dark" disabled={busy}>
          {busy ? "Mengirim..." : "Kirim tautan pemulihan"}
        </button>
        <Link to="/login">Kembali ke login</Link>
      </form>
    </Frame>
  );
}
export function Verify({ buyer = false }: { buyer?: boolean } = {}) {
  const [search] = useSearchParams(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false),
    [destination, setDestination] = useState("/app");
  async function verify() {
    setBusy(true);
    setMessage("");
    try {
      await authReady;
      const a = requireFirebase(),
        code = search.get("oobCode");
      if (code) await applyActionCode(a, code);
      if (a.currentUser) {
        await reload(a.currentUser);
        await a.currentUser.getIdToken(true);
      }
      if (a.currentUser?.emailVerified) {
        const route = await dashboardRoute();
        const continueURL = search.get("continueUrl");
        let buyerReturn = buyer || search.get("buyer") === "1";
        if (continueURL) {
          try {
            const url = new URL(continueURL);
            buyerReturn ||=
              url.origin === window.location.origin &&
              url.pathname === "/verify" &&
              url.searchParams.get("buyer") === "1";
          } catch {
            /* Ignore an invalid continuation. */
          }
        }
        setDestination(buyerReturn ? "/account" : route);
        setVerified(true);
        setMessage("Email berhasil diverifikasi. Akunmu siap digunakan.");
      } else
        setMessage(
          "Email belum terverifikasi. Buka tautan pada inbox atau folder spam, lalu periksa kembali.",
        );
    } catch (e) {
      setMessage(authError(e));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      await authReady;
      const u = requireFirebase().currentUser;
      if (!u)
        throw Error("Masuk terlebih dahulu untuk mengirim ulang verifikasi.");
      await sendEmailVerification(u, {
        url: window.location.origin + "/verify",
      });
      setMessage("Tautan verifikasi dikirim. Periksa inbox dan spam.");
    } catch (e) {
      setMessage(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame
      compact
      title={verified ? "Email terverifikasi." : "Verifikasi alamat email."}
      description={
        verified
          ? "Akunmu siap digunakan. Kamu bisa melanjutkan dari dashboard."
          : "Satu langkah lagi agar akunmu bisa mengelola toko dengan aman."
      }
    >
      <section className="verify-card" aria-label="Status verifikasi email">
        <div className={`verify-symbol ${verified ? "is-success" : ""}`}>
          <span aria-hidden="true">{verified ? "✓" : "@"}</span>
        </div>
        <p className="verify-eyebrow">KEAMANAN AKUN</p>
        <h2>{verified ? "Verifikasi berhasil" : "Konfirmasi email"}</h2>
        <p className="verify-card-intro">
          {verified
            ? "Alamat email sudah dikonfirmasi."
            : "Periksa inbox atau folder spam untuk menemukan tautan verifikasi."}
        </p>
        <div className="verify-email">
          <span>Email akun</span>
          <strong>{auth?.currentUser?.email || "Belum masuk"}</strong>
        </div>
        {message && (
          <p
            className={`verify-message ${verified ? "is-success" : ""}`}
            role="status"
          >
            {message}
          </p>
        )}
        {!verified ? (
          <div className="verify-actions">
            <button
              className="button button-dark"
              onClick={verify}
              disabled={busy}
            >
              {busy
                ? "Memproses..."
                : search.get("oobCode")
                  ? "Konfirmasi email"
                  : "Saya sudah memverifikasi email"}
            </button>
            <button
              className="verify-secondary"
              onClick={resend}
              disabled={busy}
            >
              Kirim ulang tautan
            </button>
            <Link to="/login">Masuk dengan akun lain</Link>
          </div>
        ) : (
          <Link className="button button-dark verify-primary" to={destination}>
            {destination === "/admin"
              ? "Buka dashboard admin"
              : destination === "/account"
                ? "Buka akun pembeli"
                : "Buka workspace"}{" "}
            ↗
          </Link>
        )}
      </section>
    </Frame>
  );
}
export function AuthAction() {
  const [search] = useSearchParams(),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const code = search.get("oobCode") || "",
    mode = search.get("mode");
  useEffect(() => {
    if (mode !== "resetPassword") return;
    if (!auth) {
      setError("Konfigurasi Firebase belum tersedia.");
      return;
    }
    let active = true;
    void verifyPasswordResetCode(auth, code)
      .then((s) => {
        if (active) setEmail(s);
      })
      .catch((e) => {
        if (active) setError(authError(e));
      });
    return () => {
      active = false;
    };
  }, [code, mode]);
  async function reset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await checkPassword(password);
      await confirmPasswordReset(requireFirebase(), code, password);
      setPassword("");
      setMessage("Kata sandi diperbarui. Masuk dengan kata sandi baru.");
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  if (mode === "verifyEmail") return <Verify />;
  if (mode !== "resetPassword")
    return (
      <Frame
        title="Tautan akun tidak tersedia."
        description="Minta tautan verifikasi atau pemulihan baru."
      >
        <Link to="/login">Kembali ke login</Link>
      </Frame>
    );
  return (
    <Frame
      title="Buat kata sandi baru."
      description="Pilih kata sandi yang hanya kamu gunakan untuk akun ini."
    >
      <form className="live-form" onSubmit={reset}>
        <h2>Reset kata sandi</h2>
        <p>{email}</p>
        {!message && <PasswordField value={password} change={setPassword} />}
        <p
          role={error ? "alert" : "status"}
          className={error ? "live-error" : ""}
        >
          {error || message}
        </p>
        {!message && (
          <button className="button button-dark" disabled={busy || !email}>
            {busy ? "Menyimpan..." : "Simpan kata sandi baru"}
          </button>
        )}
        <Link to="/login">Masuk ke akun</Link>
      </form>
    </Frame>
  );
}
export function AccountSecurity() {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const a = requireFirebase(),
        u = a.currentUser;
      if (!u?.email) throw Error("Masuk kembali untuk mengubah kata sandi.");
      await checkPassword(password);
      await reauthenticateWithCredential(
        u,
        EmailAuthProvider.credential(u.email, current),
      );
      await updatePassword(u, password);
      await signOut(a);
      navigate("/login");
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Keamanan akun</h1>
      <p>{auth?.currentUser?.email}</p>
      <form className="live-form live-editor" onSubmit={save}>
        <h2>Ubah kata sandi</h2>
        <PasswordField
          value={current}
          change={setCurrent}
          current
          title="Kata sandi saat ini"
        />
        <PasswordField
          value={password}
          change={setPassword}
          title="Kata sandi baru"
        />
        <p>
          Setelah kata sandi berubah, masuk kembali. Sesi lama akan ditolak saat
          pemeriksaan akun.
        </p>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        <button className="button button-dark" disabled={busy}>
          {busy ? "Memperbarui..." : "Ubah kata sandi"}
        </button>
      </form>
    </>
  );
}
export function RequireAuth({
  children,
  admin = false,
  buyer = false,
}: {
  children: ReactNode;
  admin?: boolean;
  buyer?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    let active = true,
      generation = 0;
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      const current = ++generation;
      setUser(null);
      setLoading(true);
      setError("");
      try {
        const r = firebaseUser
          ? await api<{ user: User | null }>("/api/auth/me")
          : { user: null };
        if (active && current === generation) setUser(r.user);
      } catch (e) {
        if (active && current === generation) {
          setUser(null);
          setError(authError(e));
        }
      } finally {
        if (active && current === generation) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [revision]);
  if (loading)
    return (
      <main className="auth-page" aria-busy="true">
        Memuat akun...
      </main>
    );
  if (error)
    return (
      <main className="auth-page">
        <h1>Akses akun belum tersedia.</h1>
        <p role="alert">{error}</p>
        <button onClick={() => setRevision((r) => r + 1)}>Coba lagi</button>
        <button onClick={() => void signOut(requireFirebase())}>
          Masuk kembali
        </button>
      </main>
    );
  if (!user) return <Auth buyer={buyer} />;
  if (!user.verified) return <Verify buyer={buyer} />;
  if (admin && !user.admin)
    return (
      <main className="auth-page">
        <h1>Akses khusus pemilik platform.</h1>
        <Link to="/app">Kembali ke toko</Link>
      </main>
    );
  return <div key={user.id}>{children}</div>;
}
