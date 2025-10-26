'use client';

import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AnimatePresence, motion } from 'framer-motion';

/* ---------- helpers ---------- */
const COST_KEYS = ['xp','xpCost','xp_cost','costXP','cost_xp','unlock_xp','price','cost','unlock_cost'];
const num = (v) => (v == null ? v : Number(v));  // coerce BIGINT/string ids safely

function getCost(it) {
  for (const k of COST_KEYS) {
    const v = it?.[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(+v)) return +v;
  }
  return null;
}
function getImage(it) {
  return it?.image || it?.img || it?.thumbnail || it?.thumb || it?.image_url || it?.url || null;
}

/* map UI tabs -> DB enum; tweak to match your schema exactly */
const typeMap = { footballs: 'football', accessories: 'accessory', boots: 'boot', kits: 'kit' };

/* ---------- tiny modal shell (animated) ---------- */
function Modal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="w-[min(92vw,980px)] rounded-2xl border border-white/10 bg-neutral-900 text-white shadow-2xl">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- “fly to target” overlay ---------- */
function FlyOverlay({ shot, onDone }) {
  if (!shot) return null;
  const { src, from, to } = shot;
  const styleInit = {
    position: 'fixed', left: from.x, top: from.y, width: from.w, height: from.h,
    borderRadius: 12, zIndex: 60,
  };
  return ReactDOM.createPortal(
    <motion.img
      src={src} alt="" style={styleInit}
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{
        x: to.x - from.x, y: to.y - from.y, scale: (to.w / from.w) || 0.5, opacity: 1, borderRadius: 10,
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onDone}
    />,
    document.body
  );
}

/* ---------- success toast ---------- */
function Toast({ open, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed bottom-4 inset-x-0 z-50 flex justify-center pointer-events-none"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
        >
          <div className="pointer-events-auto rounded-lg border border-white/10 bg-neutral-900 text-white px-3 py-2 shadow-xl">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- PREVIEW: cinematic unveil component ---------- */
function PreviewUnveil({ item, onClose, onUnlock }) {
  const img = getImage(item);
  const price = getCost(item);
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  function onMove(e) {
    const b = ref.current?.getBoundingClientRect?.();
    if (!b) return;
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    setTilt({ rx: -(y - 0.5) * 6, ry: (x - 0.5) * 10 });
  }

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
         className="relative overflow-hidden rounded-2xl">
      {/* Curtain reveal */}
      <motion.div className="absolute inset-0 bg-neutral-950 z-40"
                  initial={{ y: 0 }} animate={{ y: '-100%' }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
      {/* Highlight */}
      <motion.div className="pointer-events-none absolute inset-0 z-0"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                  style={{ background: 'radial-gradient(900px 420px at 75% 20%, rgba(255,214,102,.20), transparent 60%)' }} />
      {/* Shimmer */}
      <motion.div className="pointer-events-none absolute -inset-y-20 -left-1/3 -right-1/3 z-10"
                  initial={{ x: '-40%', opacity: 0 }}
                  animate={{ x: '120%', opacity: 1 }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                  style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.18), transparent)' }} />
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
        <div className="text-xs tracking-wide uppercase text-white/70">Preview</div>
        <button type="button" onClick={onClose}
                className="px-2.5 py-1 rounded-md border border-white/15 bg-white/10 text-xs hover:bg-white/15">
          Close
        </button>
      </div>
      {/* content */}
      <div className="grid md:grid-cols-5 gap-0">
        <div className="md:col-span-3 p-5 md:p-6">
          {img && (
            <motion.img
              key={`prev-${item.id}`}
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{
                opacity: 1, y: 0, scale: 1,
                rotateX: tilt.rx, rotateY: tilt.ry, transformPerspective: 900
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              src={img} alt={item?.name ?? `Item #${item?.id}`}
              className="w-full max-h-[78vh] object-contain rounded-xl bg-gradient-to-b from-white/5 to-transparent p-5 shadow-[0_0_80px_rgba(255,215,0,.15)]"
            />
          )}
        </div>
        <div className="md:col-span-2 p-5 md:p-6 border-t md:border-l md:border-t-0 border-white/10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                      className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">{item?.name ?? `Item #${item?.id}`}</div>
              <div className="mt-2 text-sm text-white/70">{price != null ? `Cost: ${price} XP` : 'No cost'}</div>
            </div>
            {price != null && (
              <motion.div initial={{ y: -8, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }}
                          transition={{ delay: 0.25, type: 'spring', stiffness: 320, damping: 20 }}
                          className="ml-3 rounded-md bg-amber-400 text-black text-[11px] font-bold px-2 py-1 shadow">
                XP {price}
              </motion.div>
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                      className="mt-6 flex items-center gap-2 justify-end">
            <button type="button" onClick={onClose}
                    className="px-3 py-1 rounded-md border border-white/15 bg-white/10 text-sm hover:bg-white/15">
              Close
            </button>
            <button type="button" onClick={onUnlock}
                    className="px-3 py-1 rounded-md border text-sm font-bold text-black bg-amber-400 hover:brightness-95">
              Unlock
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ---------- main with fly-to-target ---------- */
export default function LockerRoomStore({
  items = [],
  activeTab,
  player,
  setPlayer,
  ownedItems = [],   // STRING ids
  setOwnedItems,
  view = 'store',
  flyTargetSelector = '#locker-tab',
}) {
  const supabase = createClientComponentClient();
  const [busyId, setBusyId] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [shot, setShot] = useState(null);
  const [toast, setToast] = useState(null);

  /* Hydrate spendable_xp/points so UI shows real values */
  useEffect(() => {
    if (!player?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, spendable_xp, points')
        .eq('id', num(player.id))
        .single();
      if (!error && data) {
        setPlayer(prev => ({
          ...(prev || {}),
          spendable_xp: Number(data.spendable_xp ?? 0),
          points: Number(data.points ?? 0),
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const shown = view === 'store' ? items : items.filter(it => ownedItems.includes(String(it.id)));

  /* Ensure fresh balance when opening confirm modal */
  async function promptUnlock(item) {
    if (!player?.id) { alert('No player id'); return; }
    const { data } = await supabase
      .from('players')
      .select('spendable_xp, points')
      .eq('id', num(player.id))
      .single();
    if (data) {
      setPlayer(p => ({
        ...(p || {}),
        spendable_xp: Number(data.spendable_xp ?? 0),
        points: Number(data.points ?? 0),
      }));
    }
    setConfirmItem(item);
  }

  function flyFromElToTarget(startEl, src) {
    if (!startEl) return;
    const startRect = startEl.getBoundingClientRect();
    const targetEl = document.querySelector(flyTargetSelector);
    if (!targetEl) return;
    const tRect = targetEl.getBoundingClientRect();
    const toW = Math.max(32, Math.min(48, startRect.width * 0.35));
    const toH = Math.max(32, Math.min(48, startRect.height * 0.35));
    const to = {
      x: tRect.left + tRect.width / 2 - toW / 2,
      y: tRect.top + tRect.height / 2 - toH / 2,
      w: toW, h: toH
    };
    setShot({ src, from: { x: startRect.left, y: startRect.top, w: startRect.width, h: startRect.height }, to });
  }

  async function refreshWallet(playerId) {
    const { data, error } = await supabase
      .from('players')
      .select('spendable_xp, points')
      .eq('id', num(playerId))
      .single();
    if (!error && data) {
      setPlayer(prev => ({
        ...(prev || {}),
        spendable_xp: Number(data.spendable_xp ?? 0),
        points: Number(data.points ?? 0),
      }));
      return Number(data.spendable_xp ?? 0);
    }
    return null;
  }

  /* ---------- CORE: spend spendable_xp and insert ownership ---------- */
  async function doUnlock(item) {
    const playerId = player?.id;
    const price = getCost(item) ?? 0;
    const spendable = Number(player?.spendable_xp ?? 0);
    const levelXp = Number(player?.points ?? 0); // for display only
    const isOwned = (ownedItems || []).map(String).includes(String(item.id));
    const itemType = item.item_type ?? item.type ?? item.category ?? item.slot ?? item.tab ?? (typeMap[activeTab] ?? activeTab);

    if (isOwned) { setToast({ text: 'Already unlocked' }); return; }
    if (!playerId) { alert("We couldn't find your player profile. Please re-login."); return; }
    if (!itemType) { alert('Unlock failed: missing item type.'); return; }
    if (spendable < price) { setToast({ text: `Not enough XP — need ${price}, have ${spendable}` }); return; }

    try {
      setBusyId(item.id);

      // 1) Deduct spendable_xp (server-guarded). maybeSingle -> normalize no-row vs success.
      const { data: updRow, error: updErr } = await supabase
        .from('players')
        .update({ spendable_xp: spendable - price })
        .eq('id', num(playerId))     // BIGINT id
        .gte('spendable_xp', price)  // guard: only if enough
        .select('spendable_xp')
        .maybeSingle();              // avoid PostgREST 116 throwing

      // Normalize errors
      if (updErr) {
        const msg = (updErr.message || '').toLowerCase();
        const hint = (updErr.hint || '').toLowerCase();
        const details = (updErr.details || '').toLowerCase();

        if (msg.includes('no api key found') || hint.includes('no `apikey`') || details.includes('apikey')) {
          alert('Supabase request missing API headers. In the browser, ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set and you are creating the client with createClientComponentClient().');
          return;
        }
        if (details.includes('multiple (or no) rows') || msg.includes('multiple (or no) rows')) {
          // 0 rows updated -> RLS/id mismatch/insufficient funds
          if (spendable < price) {
            setToast({ text: `Not enough XP — need ${price}, have ${spendable}` });
          } else {
            alert('Unlock failed: players.spendable_xp update matched 0 rows (RLS or id mismatch).');
          }
          return;
        }
        // Any other DB error
        console.error('[unlock:spendable_xp:update:error]', updErr);
        alert(`Unlock failed (spendable_xp update): ${updErr.message}`);
        return;
      }

      if (!updRow) {
        // No data returned (treat like 0 rows)
        if (spendable < price) {
          setToast({ text: `Not enough XP — need ${price}, have ${spendable}` });
        } else {
          alert('Unlock failed: players.spendable_xp update matched 0 rows (RLS or id mismatch).');
        }
        return;
      }

      const newSpendable = Number(updRow?.spendable_xp);
      if (!Number.isFinite(newSpendable)) {
        alert('Unlock failed: unexpected response updating spendable_xp.');
        return;
      }

      // 2) Record ownership; duplicate = success.
      const { error: insErr } = await supabase
        .from('player_items')
        .insert({ player_id: num(playerId), item_id: String(item.id), item_type: itemType });

      if (insErr && insErr.code !== '23505') {
        // Refund on real insert failure
        await supabase
          .from('players')
          .update({ spendable_xp: newSpendable + price })
          .eq('id', num(playerId));
        alert(`Unlock failed (ownership): ${insErr.message}`);
        return;
      }

      // 3) UI updates
      setOwnedItems(prev => Array.from(new Set([...(prev || []).map(String), String(item.id)])));
      const refreshed = await refreshWallet(playerId);
      setPlayer(prev => ({
        ...(prev || {}),
        spendable_xp: typeof refreshed === 'number' ? refreshed : newSpendable,
        points: levelXp,
      }));

      setConfirmItem(null);

      // Fly animation + toast
      const imgEl = document.getElementById('confirm-image-el');
      const src = getImage(item);
      if (imgEl && src) {
        flyFromElToTarget(imgEl, src);
      } else if (src) {
        const tileImg = document.querySelector(`img[alt="${(item?.name ?? `Item #${item?.id}`)}"]`);
        if (tileImg) flyFromElToTarget(tileImg, src);
      }
      setToast({ text: 'Unlocked!' });
    } catch (e) {
      console.error('[unlock:unexpected:error]', e);
      alert(`Unlock crashed: ${e?.message || e}`);
    } finally {
      setBusyId(null);
      setPreviewItem(null);
    }
  }

  if (!shown.length) {
    return <div className="opacity-70 text-sm">{view === 'store' ? 'No items in this tab yet.' : 'Nothing unlocked yet.'}</div>;
  }

  return (
    <>
      {/* HUD */}
      <div style={{ position: 'sticky', top: 0, zIndex: 80 }} className="mb-2 text-xs text-white/80">
        Spendable XP: <b>{Number(player?.spendable_xp ?? 0)}</b>
        {' '}• Level XP (points): <b>{Number(player?.points ?? 0)}</b>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((item) => {
          const owned = ownedItems.includes(String(item.id));
          const price = getCost(item);
          const spendable = Number(player?.spendable_xp ?? 0);
          const canAfford = spendable >= (price ?? 0);
          const img = getImage(item);

          return (
            <div key={item.id} className="rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shadow-md">
              <div className="relative bg-neutral-800">
                {img && <img src={img} alt={item.name ?? `Item #${item.id}`} className="w-full h-40 object-cover" />}
                {price != null && (
                  <div className="absolute top-2 right-2 rounded-md bg-amber-400 text-black text-[11px] font-bold px-2 py-1 shadow">
                    XP {price}
                  </div>
                )}
                {owned && (
                  <div className="absolute top-2 left-2 rounded-md bg-emerald-500/90 text-white text-[11px] font-semibold px-2 py-1">
                    Unlocked
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
              </div>

              <div className="px-3 py-3 bg-black/50 border-t border-white/10">
                <div className="text-sm font-semibold text-white">{item.name ?? `Item #${item.id}`}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="px-3 py-1 rounded-md border border-white/15 bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (owned) { setToast({ text: 'Already unlocked' }); return; }
                      promptUnlock(item); // fresh read before opening confirm
                    }}
                    disabled={busyId === item.id}
                    className="px-3 py-1 rounded-md border text-xs font-bold text-black bg-amber-400 hover:brightness-95 disabled:opacity-60"
                  >
                    {owned ? 'Unlocked' : busyId === item.id ? 'Unlocking…' : 'Unlock'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PREVIEW MODAL */}
      <Modal open={!!previewItem} onClose={() => setPreviewItem(null)}>
        {previewItem && (
          <PreviewUnveil
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onUnlock={() => { setPreviewItem(null); promptUnlock(previewItem); }}
          />
        )}
      </Modal>

      {/* CONFIRM MODAL */}
      <Modal open={!!confirmItem} onClose={() => setConfirmItem(null)}>
        {confirmItem && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            className="relative overflow-hidden rounded-2xl"
          >
            <div className="pointer-events-none absolute -inset-24 opacity-25 blur-3xl"
                 style={{ background: 'radial-gradient(700px 340px at 85% 15%, rgba(255,205,85,.35), transparent 60%)' }} />
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-neutral-900 text-white">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-amber-400/90 text-black grid place-items-center text-xs font-extrabold">XP</div>
                <div className="text-sm font-semibold">Confirm purchase</div>
              </div>
              <button type="button" onClick={() => setConfirmItem(null)}
                      className="px-2.5 py-1 rounded-md border border-white/15 bg-white/10 text-xs hover:bg-white/15">
                Close
              </button>
            </div>

            <div className="grid md:grid-cols-5 gap-0 bg-neutral-900 text-white">
              <div className="md:col-span-2 p-5 md:p-6">
                <div className="relative rounded-xl border border-white/10 bg-white/5 p-3">
                  {getImage(confirmItem) && (
                    <motion.img
                      id="confirm-image-el"
                      key={`conf-${confirmItem.id}`}
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                      src={getImage(confirmItem)}
                      alt={confirmItem?.name ?? `Item #${confirmItem?.id}`}
                      className="w-full h-36 md:h-44 object-contain rounded-lg"
                    />
                  )}
                  {(function(){ const c = getCost(confirmItem); return c != null ? (
                    <div className="absolute top-2 right-2 rounded-md bg-amber-400 text-black text-[11px] font-bold px-2 py-1 shadow">XP {c}</div>
                  ) : null; })()}
                </div>
              </div>

              <div className="md:col-span-3 p-5 md:p-6 border-t md:border-l md:border-t-0 border-white/10">
                <div className="text-lg md:text-xl font-semibold">
                  Unlock {confirmItem?.name ?? `Item #${confirmItem?.id}`}?
                </div>
                <div className="mt-2 text-sm text-white/70">
                  {(function(){ const c = getCost(confirmItem); return c != null ? `Cost: ${c} XP` : 'No cost'; })()}
                </div>
                <div className="mt-4 text-xs md:text-sm text-white/70">
                  {(function(){
                    const c = getCost(confirmItem) ?? 0;
                    const bal = Number(player?.spendable_xp ?? player?.points ?? 0);
                    const rem = Math.max(0, bal - c);
                    return `Spendable XP: ${bal} → After: ${rem}`;
                  })()}
                </div>
                <div className="mt-6 flex items-center gap-2 justify-end">
                  <button type="button" onClick={() => setConfirmItem(null)}
                          className="px-3 py-1 rounded-md border border-white/15 bg-white/10 text-sm hover:bg-white/15">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => doUnlock(confirmItem)}
                    disabled={busyId === confirmItem?.id}
                    className="px-3 py-1 rounded-md border text-sm font-bold text-black bg-amber-400 hover:brightness-95 disabled:opacity-60"
                  >
                    {busyId === confirmItem?.id ? 'Unlocking…' : 'Confirm unlock'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </Modal>

      <FlyOverlay shot={shot} onDone={() => setShot(null)} />
      <Toast open={!!toast}>{toast?.text}</Toast>
    </>
  );
}
