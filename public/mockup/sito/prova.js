// Prova di colori e caratteri per il mockup (non fa parte del sito vero).
// Imposta subito data-palette e data-font su <html>, poi aggiunge il pannello di scelta.
(function () {
  // Pannello nascosto: colori e caratteri confermati (porpora di Roma + Manrope).
  // Per mostrarlo di nuovo, mettere true.
  var PANNELLO_VISIBILE = false;
  if (!PANNELLO_VISIBILE) {
    document.documentElement.setAttribute('data-palette', 'porpora');
    document.documentElement.setAttribute('data-font', 'manrope');
    return;
  }
  var PALETTE = {
    porpora: ['Porpora di Roma su avorio (scelta)', 'Il rosso porpora e l’oro dello stemma di Roma, su fondo avorio chiaro.'],
    notte: ['Notte e oro', 'Blu notte e giallo: istituzionale e deciso.'],
    pino: ['Pino e terracotta', 'Verde pino e terracotta, i colori di Roma. Naturale e accogliente.'],
    inchiostro: ['Inchiostro e vermiglione', 'Quasi nero e rosso-arancio: grafico e contemporaneo.'],
    oltremare: ['Oltremare e rosa antico', 'Blu luminoso e rosa: raffinato, meno istituzionale.']
  };
  var FONT = {
    manrope: ['Manrope (scelto)', 'Senza grazie, pulito e contemporaneo: il carattere scelto per il sito.'],
    fraunces: ['Fraunces + Source Sans', 'Grazie morbide e moderne, calde e molto leggibili.'],
    garamond: ['EB Garamond + Lato', 'Il Garamond dei libri e dei programmi di sala: tradizionale ed elegante.'],
    caslon: ['Libre Caslon + Libre Franklin', 'Forte contrasto tra tratti spessi e sottili: solenne, da frontespizio.'],
    dmserif: ['DM Serif + DM Sans', 'Grazie ad alto contrasto e forme piene: da locandina teatrale.']
  };
  var html = document.documentElement;
  function salvato(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function salva(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var h = location.hash.slice(1).split('&');
  var dalLink = PALETTE[h[0]] ? h[0] : null;
  var fontLink = (h.slice(1).join('&').match(/(?:^|&)font=([a-z]+)/) || [])[1];
  var pal = dalLink || salvato('hv-palette'); if (!PALETTE[pal]) pal = 'porpora';
  var fon = FONT[fontLink] ? fontLink : salvato('hv-font-2'); if (!FONT[fon]) fon = 'manrope';
  html.setAttribute('data-palette', pal); html.setAttribute('data-font', fon);

  function opzioni(obj, scelto) {
    return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === scelto ? ' selected' : '') + '>' + obj[k][0] + '</option>'; }).join('');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.className = 'pannello-prova';
    box.innerHTML =
      '<button class="chiudi" type="button" aria-label="Riduci il pannello">×</button>' +
      '<button class="riapri" type="button">Colori e caratteri ▴</button>' +
      '<label for="prova-pal">Colori</label><select id="prova-pal">' + opzioni(PALETTE, pal) + '</select>' +
      '<div class="campioni" aria-hidden="true"><span data-v="--blu"></span><span data-v="--blu-2"></span><span data-v="--giallo"></span><span data-v="--fondo"></span><span data-v="--testo"></span></div>' +
      '<p class="d-pal"></p><div class="sep"></div>' +
      '<label for="prova-font">Caratteri</label><select id="prova-font">' + opzioni(FONT, fon) + '</select>' +
      '<p class="d-font"></p><p style="margin-top:10px;font-size:12px">La scelta vale per tutte le pagine del mockup.</p>';
    document.body.appendChild(box);
    var sp = box.querySelector('#prova-pal'), sf = box.querySelector('#prova-font');
    function aggiorna() {
      html.setAttribute('data-palette', sp.value); html.setAttribute('data-font', sf.value);
      salva('hv-palette', sp.value); salva('hv-font-2', sf.value);
      box.querySelector('.d-pal').textContent = PALETTE[sp.value][1];
      box.querySelector('.d-font').textContent = FONT[sf.value][1];
      var cs = getComputedStyle(html);
      box.querySelectorAll('.campioni span').forEach(function (s) { s.style.background = cs.getPropertyValue(s.dataset.v); });
      if (location.hash || html.hasAttribute('data-prova-aperta')) history.replaceState(null, '', '#' + sp.value + '&font=' + sf.value);
    }
    sp.addEventListener('change', aggiorna); sf.addEventListener('change', aggiorna);
    box.querySelector('.chiudi').addEventListener('click', function () { box.classList.add('ridotto'); salva('hv-prova-ridotto', '1'); });
    box.querySelector('.riapri').addEventListener('click', function () { box.classList.remove('ridotto'); salva('hv-prova-ridotto', '0'); });
    var aperta = html.hasAttribute('data-prova-aperta') || location.hash.length > 1 || salvato('hv-prova-ridotto') === '0';
    if (!aperta) box.classList.add('ridotto');
    aggiorna();
  });
})();
