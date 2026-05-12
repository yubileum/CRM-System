import React, { useState, useEffect } from 'react';
import { X, MessageCircle, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { fetchWATemplates, saveWATemplates } from '../services/storage';

// ─── Default templates ─────────────────────────────────────────────────────────
export const DEFAULT_WA_TEMPLATES = {
  birthdayToday:
    'Halo {nama}! 🎂 Selamat ulang tahun! Semoga hari spesialmu penuh kebahagiaan. Terima kasih sudah menjadi pelanggan setia kami! 🎉',
  birthdayMonth:
    'Halo {nama}! 🎉 Selamat ulang tahun di bulan ini! Semoga bulan ini penuh kebahagiaan untukmu. Kami senang memilikimu sebagai pelanggan setia!',
  atRisk:
    'Halo {nama}! 👋 Kami kangen kunjunganmu. Yuk mampir lagi dan kumpulkan stamp untuk mendapatkan reward menarik! 🎁',
  nearlyExpiring:
    'Halo {nama}! 🎟️ Voucher "{reward}" kamu akan kedaluwarsa dalam {hari} hari! Jangan sampai terlewat, segera gunakan sebelum {tanggal}. 🚀',
};

export type WATemplateKey = keyof typeof DEFAULT_WA_TEMPLATES;

const TEMPLATE_META: Record<WATemplateKey, { label: string; description: string; params: string[]; previewVars: Record<string, string> }> = {
  birthdayToday: {
    label: '🎂 Birthdays Today',
    description: 'Terkirim saat klik WA di daftar ulang tahun hari ini',
    params: ['{nama}'],
    previewVars: { nama: 'Budi Santoso' },
  },
  birthdayMonth: {
    label: '📅 Birthdays This Month',
    description: 'Terkirim saat klik WA di daftar ulang tahun bulan ini',
    params: ['{nama}'],
    previewVars: { nama: 'Siti Rahayu' },
  },
  atRisk: {
    label: '⚠️ At-Risk Customers',
    description: 'Terkirim saat klik WA di daftar pelanggan tidak aktif',
    params: ['{nama}'],
    previewVars: { nama: 'Ahmad Fauzi' },
  },
  nearlyExpiring: {
    label: '🎟️ Vouchers Expiring in 7 Days',
    description: 'Terkirim saat klik WA di daftar voucher hampir kedaluwarsa',
    params: ['{nama}', '{reward}', '{hari}', '{tanggal}'],
    previewVars: { nama: 'Dewi Lestari', reward: 'Free Coffee', hari: '3', tanggal: '15 Mei' },
  },
};

const LS_KEY = 'crm_wa_templates';

const applyPreview = (tpl: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), tpl);

// ─── Load helpers ──────────────────────────────────────────────────────────────
export const loadCachedTemplates = (): Record<WATemplateKey, string> => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_WA_TEMPLATES, ...JSON.parse(raw) } : { ...DEFAULT_WA_TEMPLATES };
  } catch { return { ...DEFAULT_WA_TEMPLATES }; }
};

export const applyWATemplate = (
  key: WATemplateKey,
  vars: Record<string, string>
): string => {
  const tpl = loadCachedTemplates()[key] ?? DEFAULT_WA_TEMPLATES[key];
  return applyPreview(tpl, vars);
};

// ─── Component ─────────────────────────────────────────────────────────────────
interface WATemplateConfigProps {
  onClose: () => void;
}

export const WATemplateConfig: React.FC<WATemplateConfigProps> = ({ onClose }) => {
  const [drafts, setDrafts] = useState<Record<WATemplateKey, string>>(loadCachedTemplates);
  const [expanded, setExpanded] = useState<WATemplateKey | null>('birthdayToday');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [saveErr, setSaveErr] = useState('');

  // Load from spreadsheet on open
  useEffect(() => {
    fetchWATemplates().then(remote => {
      if (remote && Object.keys(remote).length > 0) {
        const merged = { ...DEFAULT_WA_TEMPLATES, ...remote } as Record<WATemplateKey, string>;
        setDrafts(merged);
        try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch {}
      }
    }).catch(() => setLoadErr('Gagal memuat dari spreadsheet, menggunakan cache lokal.'));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setSaveErr('');
    try {
      const ok = await saveWATemplates(drafts);
      if (ok) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(drafts)); } catch {}
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveErr('Gagal menyimpan ke spreadsheet. Coba lagi.');
      }
    } catch {
      setSaveErr('Network error. Pastikan koneksi internet aktif.');
    } finally {
      setSaving(false);
    }
  };

  const resetKey = (key: WATemplateKey) => {
    setDrafts(d => ({ ...d, [key]: DEFAULT_WA_TEMPLATES[key] }));
  };

  const insertParam = (key: WATemplateKey, param: string) => {
    setDrafts(d => ({ ...d, [key]: d[key] + param }));
  };

  const C = {
    bg: '#0a1610',
    card: '#0e1e14',
    border: '#1a2e23',
    borderLt: '#243b2e',
    green: '#006B3F',
    greenLt: '#00c471',
    text: '#a3c4b0',
    textDim: '#4d7260',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div className="absolute inset-0 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden animate-in zoom-in-95"
        style={{ background: C.bg, border: `1px solid ${C.borderLt}`, boxShadow: '0 0 60px rgba(0,107,63,0.25)' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-5 shrink-0"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', boxShadow: '0 0 20px rgba(37,211,102,0.4)' }}
          >
            <MessageCircle size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-black text-lg leading-none text-white">WhatsApp Templates</h2>
            <p className="text-xs font-bold mt-0.5 uppercase tracking-wider" style={{ color: C.textDim }}>
              Konfigurasi pesan otomatis
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl transition-all hover:bg-white/5"
              style={{ color: C.textDim }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Load error */}
        {loadErr && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
            <AlertCircle size={13} />
            {loadErr}
          </div>
        )}

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {(Object.keys(TEMPLATE_META) as WATemplateKey[]).map(key => {
            const meta = TEMPLATE_META[key];
            const isOpen = expanded === key;
            const preview = applyPreview(drafts[key], meta.previewVars);

            return (
              <div
                key={key}
                className="rounded-2xl overflow-hidden transition-all"
                style={{ border: `1px solid ${isOpen ? C.greenLt + '44' : C.borderLt}`, background: C.card }}
              >
                {/* Section header */}
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all hover:bg-white/[0.02]"
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-white">{meta.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.textDim }}>{meta.description}</p>
                  </div>
                  <span style={{ color: C.textDim }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {/* Editor */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-3">
                    {/* Param chips */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.textDim }}>
                        Parameter dinamis — klik untuk menyisipkan
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {meta.params.map(p => (
                          <button
                            key={p}
                            onClick={() => insertParam(key, p)}
                            className="px-2.5 py-1 rounded-lg text-xs font-black transition-all hover:scale-105 active:scale-95"
                            style={{ background: 'rgba(0,196,113,0.12)', color: C.greenLt, border: `1px solid rgba(0,196,113,0.3)` }}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => resetKey(key)}
                          className="ml-auto px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          <RotateCcw size={10} /> Reset
                        </button>
                      </div>
                    </div>

                    {/* Textarea */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.textDim }}>Template</p>
                      <textarea
                        value={drafts[key]}
                        onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                        rows={4}
                        className="w-full rounded-xl p-3 text-sm font-medium resize-none outline-none transition-all"
                        style={{
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          fontFamily: 'inherit',
                        }}
                        onFocus={e => (e.target.style.borderColor = C.green)}
                        onBlur={e => (e.target.style.borderColor = C.border)}
                      />
                    </div>

                    {/* Preview */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.textDim }}>
                        Preview (contoh data)
                      </p>
                      <div
                        className="rounded-xl p-3 text-xs leading-relaxed"
                        style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', color: C.text, whiteSpace: 'pre-wrap' }}
                      >
                        {preview}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-6 py-4 flex items-center gap-3"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          {saveErr && (
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#f87171' }}>
              <AlertCircle size={13} />{saveErr}
            </p>
          )}
          {saved && (
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: C.greenLt }}>
              <Check size={13} /> Tersimpan!
            </p>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-black transition-all hover:bg-white/5"
              style={{ color: C.textDim, border: `1px solid ${C.border}` }}
            >
              Tutup
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #006B3F, #008f55)', boxShadow: '0 4px 16px rgba(0,107,63,0.4)' }}
            >
              {saving
                ? <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</>
                : <><Check size={14} /> Simpan</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
