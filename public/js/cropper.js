/* ============================================================
   cropper.js — Ajuste de enquadramento das fotos dos equipamentos (v11.8)
   - Abre por cima do formulário (não fecha o cadastro)
   - Arrastar move a foto; controle deslizante, roda do mouse ou
     pinça (2 dedos) aproximam/afastam; botão gira 90°
   - Afastando além do limite a foto aparece inteira com fundo branco
   - Resultado: JPG 1200 × 800 (proporção 3:2, a mesma do cartão do catálogo)
   ============================================================ */

const CROP_RATIO = 3 / 2;
const CROP_OUT_W = 1200;

function openCropper(src, { ratio = CROP_RATIO, title = 'Ajustar enquadramento' } = {}) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => start(img);
    img.onerror = () => { toast('Não foi possível abrir a imagem para ajuste.', 'error'); resolve(null); };
    img.src = src;

    function start(img) {
      const ov = document.createElement('div');
      ov.className = 'crop-overlay';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', title);
      ov.innerHTML = `
        <div class="crop-box">
          <div class="crop-head"><div><div class="modal-title">${escapeHtml(title)}</div>
            <div class="modal-sub">Arraste para posicionar · use o controle (ou dois dedos) para aproximar</div></div></div>
          <div class="crop-stage"><canvas class="crop-canvas"></canvas><div class="crop-grid" aria-hidden="true"></div></div>
          <div class="crop-tools">
            <button type="button" class="icon-btn" data-act="out" aria-label="Afastar">−</button>
            <input type="range" class="crop-zoom" min="0" max="1000" value="0" aria-label="Aproximação">
            <button type="button" class="icon-btn" data-act="in" aria-label="Aproximar">+</button>
            <button type="button" class="btn small" data-act="rot">↻ Girar</button>
            <button type="button" class="btn small" data-act="fit">Foto inteira</button>
            <button type="button" class="btn small" data-act="fill">Preencher</button>
          </div>
          <div class="crop-foot">
            <button type="button" class="btn" data-act="cancel">Cancelar</button>
            <button type="button" class="btn dark" data-act="ok">${icon('check', 16)} Usar esta foto</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      const stage = ov.querySelector('.crop-stage'), canvas = ov.querySelector('.crop-canvas'), zoom = ov.querySelector('.crop-zoom');
      const ctx = canvas.getContext('2d');
      const st = { rot: 0, scale: 1, x: 0, y: 0, fw: 0, fh: 0 };

      const dims = () => (st.rot % 180 ? { w: img.naturalHeight, h: img.naturalWidth } : { w: img.naturalWidth, h: img.naturalHeight });
      const limits = () => { const { w, h } = dims(); const cover = Math.max(st.fw / w, st.fh / h), contain = Math.min(st.fw / w, st.fh / h); return { cover, contain, max: cover * 4 }; };
      // controle deslizante em escala logarítmica: 0 = foto inteira, 1000 = 4× o preenchimento
      const toSlider = s => { const L = limits(); return Math.round(1000 * Math.log(s / L.contain) / Math.log(L.max / L.contain || 1.0001)); };
      const fromSlider = v => { const L = limits(); return L.contain * Math.pow(L.max / L.contain, v / 1000); };
      function clamp() {
        const L = limits(); st.scale = Math.min(L.max, Math.max(L.contain, st.scale));
        const { w, h } = dims(), sw = w * st.scale, sh = h * st.scale;
        const mx = Math.abs(sw - st.fw) / 2, my = Math.abs(sh - st.fh) / 2;
        st.x = sw >= st.fw ? Math.max(-mx, Math.min(mx, st.x)) : 0;
        st.y = sh >= st.fh ? Math.max(-my, Math.min(my, st.y)) : 0;
      }
      function paint(c, k) {   // k = fator entre a moldura na tela e a imagem final
        const g = c.getContext('2d');
        g.save(); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.translate(c.width / 2 + st.x * k, c.height / 2 + st.y * k);
        g.rotate(st.rot * Math.PI / 180);
        const s = st.scale * k;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, -img.naturalWidth * s / 2, -img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
        g.restore();
      }
      function render() { clamp(); paint(canvas, canvas.width / st.fw); zoom.value = toSlider(st.scale); }
      function layout(first) {
        const old = st.fw;
        st.fw = stage.clientWidth; st.fh = Math.round(st.fw / ratio);
        stage.style.height = st.fh + 'px';
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(st.fw * dpr); canvas.height = Math.round(st.fh * dpr);
        canvas.style.width = st.fw + 'px'; canvas.style.height = st.fh + 'px';
        if (first) st.scale = limits().cover;
        else if (old) { const f = st.fw / old; st.scale *= f; st.x *= f; st.y *= f; }
        render();
      }
      const zoomTo = (s, cx = 0, cy = 0) => {   // mantém fixo o ponto (cx, cy) relativo ao centro
        const f = s / st.scale; st.x = cx - (cx - st.x) * f; st.y = cy - (cy - st.y) * f; st.scale = s; render();
      };

      // arrastar e pinça
      const pts = new Map(); let pinch = null;
      canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: st.scale }; } });
      canvas.addEventListener('pointermove', e => {
        const p = pts.get(e.pointerId); if (!p) return;
        if (pts.size === 1) { st.x += e.clientX - p.x; st.y += e.clientY - p.y; }
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; st.scale = pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; }
        render();
      });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        zoomTo(st.scale * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - st.fw / 2, e.clientY - r.top - st.fh / 2);
      }, { passive: false });
      zoom.addEventListener('input', () => zoomTo(fromSlider(+zoom.value)));

      const finish = out => {
        window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize);
        ov.remove(); resolve(out);
      };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); finish(null); } };
      const onResize = debounce(() => layout(false), 100);
      window.addEventListener('keydown', onKey, true); window.addEventListener('resize', onResize);
      ov.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
        if (act === 'cancel') return finish(null);
        if (act === 'in') return zoomTo(st.scale * 1.15);
        if (act === 'out') return zoomTo(st.scale / 1.15);
        if (act === 'fit') { st.x = st.y = 0; return zoomTo(limits().contain); }
        if (act === 'fill') { st.x = st.y = 0; return zoomTo(limits().cover); }
        if (act === 'rot') { st.rot = (st.rot + 90) % 360; st.x = st.y = 0; st.scale = limits().cover; return render(); }
        if (act === 'ok') {
          const out = document.createElement('canvas');
          out.width = CROP_OUT_W; out.height = Math.round(CROP_OUT_W / ratio);
          paint(out, out.width / st.fw);
          let data = null;
          try { data = out.toDataURL('image/jpeg', 0.82); } catch (_) { toast('Esta foto não pode ser ajustada aqui. Escolha o arquivo novamente.', 'error'); }
          finish(data);
        }
      });
      requestAnimationFrame(() => layout(true));
      ov.querySelector('[data-act=ok]').focus();
    }
  });
}

/* Foto do equipamento: escolhe o arquivo → ajusta o enquadramento → prévia no formulário */
async function cropResourcePhoto(src) {
  const out = await openCropper(src, { title: 'Enquadrar foto do equipamento' });
  if (!out) return;
  window._resourcePhotoData = out;
  const p = document.getElementById('rPhotoPreview'); if (p) { p.src = out; p.hidden = false; }
  const t = document.getElementById('rPhotoText'); if (t) t.textContent = 'Foto carregada — clique para trocar';
  document.getElementById('rPhotoLabel')?.classList.add('has-file');
  const adj = document.getElementById('rPhotoAdjust'); if (adj) adj.hidden = false;
}
// Reenquadrar a foto já cadastrada (usa a imagem que está na prévia)
function adjustCurrentResourcePhoto() {
  const p = document.getElementById('rPhotoPreview');
  const src = window._resourcePhotoOriginal || p?.src;   // foto recém-escolhida: reenquadra a partir do original
  if (!src || /blank\.gif/.test(src)) return toast('A foto ainda está carregando. Tente de novo em instantes.', 'warn');
  cropResourcePhoto(src);
}
