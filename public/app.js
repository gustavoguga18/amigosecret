(function(){
  const STORAGE_KEY = 'amigo-secreto:meu-nome';
  let currentUser = null;
  let selectedPerson = null;
  let peopleCache = {}; // name -> array of gifts
  let peopleOrder = []; // names with counts, from /api/people

  const gate = document.getElementById('gate-screen');
  const main = document.getElementById('main-screen');
  const nameInput = document.getElementById('name-input');
  const enterBtn = document.getElementById('enter-btn');
  const meLabel = document.getElementById('me-label');
  const switchBtn = document.getElementById('switch-btn');
  const peopleListEl = document.getElementById('people-list');
  const panel = document.getElementById('panel');
  const toastEl = document.getElementById('toast');

  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), 1800);
  }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function api(path, options){
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if(!res.ok){
      const body = await res.json().catch(()=>({}));
      throw new Error(body.error || 'Erro na requisição');
    }
    return res.json();
  }

  async function loadPeopleList(){
    peopleOrder = await api('/people');
  }

  async function loadPersonGifts(name){
    const data = await api('/people/' + encodeURIComponent(name));
    peopleCache[name] = data.gifts;
    return data.gifts;
  }

  function renderPeopleList(){
    peopleListEl.innerHTML = '';
    peopleOrder.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'person-tab' + (p.name === selectedPerson ? ' active' : '');
      btn.innerHTML = `<span>${escapeHtml(p.name)}${p.name === currentUser ? ' <span class="you-mark">(você)</span>' : ''}</span><span class="count-pill">${p.count}</span>`;
      btn.addEventListener('click', () => selectPerson(p.name));
      peopleListEl.appendChild(btn);
    });
  }

  function priceTagClass(price){
    if(price === 'baixo') return 'price-baixo';
    if(price === 'alto') return 'price-alto';
    return 'price-medio';
  }
  function priceTagLabel(price){
    if(price === 'baixo') return '$ até 50';
    if(price === 'alto') return '$$$ acima de 150';
    return '$$ 50–150';
  }

  async function selectPerson(name){
    selectedPerson = name;
    panel.innerHTML = '<div class="loading-note">Carregando...</div>';
    renderPeopleList();
    try{
      await loadPersonGifts(name);
    }catch(e){
      panel.innerHTML = '<div class="empty-state">Não consegui carregar essa lista agora.</div>';
      return;
    }
    renderPanel();
  }

  function renderPanel(){
    if(!selectedPerson){
      panel.innerHTML = `<div class="empty-state"><div class="big">Ninguém montou uma lista ainda</div>Seja a primeira pessoa — sua lista aparece aqui do lado.</div>`;
      return;
    }
    const isMine = selectedPerson === currentUser;
    const gifts = peopleCache[selectedPerson] || [];

    let html = `<div class="panel-header"><h2>Lista de ${escapeHtml(selectedPerson)}</h2></div>`;
    html += `<p class="panel-sub">${isMine ? 'Essas são as suas sugestões — adicione quantas quiser.' : 'Ideias de presente para ' + escapeHtml(selectedPerson) + '. Marque um item se você já for comprá-lo, pra ninguém repetir.'}</p>`;

    if(gifts.length === 0){
      html += `<div class="empty-state">${isMine ? 'Você ainda não colocou nenhuma ideia. Use o formulário abaixo.' : 'Essa pessoa ainda não colocou nenhuma ideia de presente.'}</div>`;
    } else {
      html += '<ul class="gift-list">';
      gifts.forEach((g, i) => {
        html += `<li class="gift ${g.claimed ? 'is-claimed' : ''}" data-id="${g.id}">
          <div class="idx">${i+1}.</div>
          ${g.image ? `<img class="g-thumb" src="${escapeHtml(g.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
          <div class="content">
            <div class="title-row">
              <span class="g-title">${escapeHtml(g.title)}</span>
              <span class="tag ${priceTagClass(g.price)}">${priceTagLabel(g.price)}</span>
              ${g.claimed ? '<span class="tag claimed-tag">já garantido</span>' : ''}
            </div>
            ${g.note ? `<div class="g-note">${escapeHtml(g.note)}</div>` : ''}
            ${g.link ? `<a class="g-link" href="${escapeHtml(g.link)}" target="_blank" rel="noopener">ver link ↗</a>` : ''}
          </div>
          <div class="gift-actions">
            ${!isMine ? `<button class="icon-btn ${g.claimed ? 'claim-on' : ''}" data-action="claim" data-id="${g.id}">${g.claimed ? 'desmarcar' : 'vou comprar'}</button>` : ''}
            ${isMine ? `<button class="icon-btn remove" data-action="remove" data-id="${g.id}">remover</button>` : ''}
          </div>
        </li>`;
      });
      html += '</ul>';
    }

    if(isMine){
      html += `
      <form class="add-form" id="add-form">
        <h3>Adicionar ideia de presente</h3>
        <div class="field-row">
          <div class="field" style="flex:2;">
            <label for="f-title">O que você quer</label>
            <input id="f-title" type="text" maxlength="80" placeholder="Ex: livro de receitas, tênis de corrida..." required />
          </div>
          <div class="field" style="max-width:160px;">
            <label for="f-price">Faixa de preço</label>
            <select id="f-price">
              <option value="baixo">até R$ 50</option>
              <option value="medio" selected>R$ 50 a 150</option>
              <option value="alto">acima de R$ 150</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-note">Detalhe (opcional)</label>
            <textarea id="f-note" maxlength="200" placeholder="Tamanho, cor, marca, edição..."></textarea>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-link">Link (opcional)</label>
            <input id="f-link" type="url" placeholder="https://..." />
          </div>
          <div class="field">
            <label for="f-image">Imagem (opcional, cole o link de uma foto)</label>
            <input id="f-image" type="url" placeholder="https://exemplo.com/foto.jpg" />
          </div>
        </div>
        <img id="f-image-preview" class="image-preview" style="display:none;" alt="Pré-visualização" />
        <button type="submit" class="btn">Adicionar à lista</button>
      </form>`;
    }

    panel.innerHTML = html;

    panel.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try{
          const data = await api('/gifts/' + id, { method: 'DELETE' });
          peopleCache[selectedPerson] = data.gifts;
          await loadPeopleList();
          renderPeopleList();
          renderPanel();
          showToast('Item removido.');
        }catch(e){ showToast('Não consegui remover.'); }
      });
    });

    panel.querySelectorAll('[data-action="claim"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try{
          const data = await api('/gifts/' + id + '/claim', { method: 'PATCH' });
          peopleCache[selectedPerson] = data.gifts;
          renderPanel();
          showToast('Atualizado.');
        }catch(e){ showToast('Não consegui atualizar.'); }
      });
    });

    const form = document.getElementById('add-form');
    const imageInput = document.getElementById('f-image');
    const imagePreview = document.getElementById('f-image-preview');
    if(imageInput){
      imageInput.addEventListener('input', () => {
        const url = imageInput.value.trim();
        if(url){
          imagePreview.src = url;
          imagePreview.style.display = 'block';
        } else {
          imagePreview.style.display = 'none';
        }
      });
      imagePreview.addEventListener('error', () => { imagePreview.style.display = 'none'; });
    }
    if(form){
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('f-title').value.trim();
        if(!title) return;
        const price = document.getElementById('f-price').value;
        const note = document.getElementById('f-note').value.trim();
        const link = document.getElementById('f-link').value.trim();
        const image = document.getElementById('f-image').value.trim();
        try{
          const data = await api('/people/' + encodeURIComponent(selectedPerson) + '/gifts', {
            method: 'POST',
            body: JSON.stringify({ title, price, note, link, image })
          });
          peopleCache[selectedPerson] = data.gifts;
          await loadPeopleList();
          renderPeopleList();
          renderPanel();
          showToast('Ideia adicionada à sua lista!');
        }catch(e){ showToast('Não consegui adicionar.'); }
      });
    }
  }

  async function enterAs(name){
    enterBtn.disabled = true;
    enterBtn.textContent = 'Entrando...';
    try{
      const data = await api('/people/' + encodeURIComponent(name) + '/enter', { method: 'POST' });
      currentUser = data.name;
      peopleCache[currentUser] = data.gifts;
      localStorage.setItem(STORAGE_KEY, currentUser);
      await loadPeopleList();
      gate.style.display = 'none';
      main.style.display = 'block';
      meLabel.textContent = currentUser;
      selectPerson(currentUser);
    }catch(e){
      showToast('Não consegui conectar. Tente de novo.');
    }finally{
      enterBtn.disabled = false;
      enterBtn.textContent = 'Entrar';
    }
  }

  enterBtn.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    if(!name){ nameInput.focus(); return; }
    enterAs(name);
  });

  nameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') enterBtn.click();
  });

  switchBtn.addEventListener('click', () => {
    currentUser = null;
    selectedPerson = null;
    localStorage.removeItem(STORAGE_KEY);
    main.style.display = 'none';
    gate.style.display = 'block';
    nameInput.value = '';
    nameInput.focus();
  });

  // Boot: se já tem nome salvo neste navegador, entra direto
  const savedName = localStorage.getItem(STORAGE_KEY);
  if(savedName){
    nameInput.value = savedName;
    enterAs(savedName);
  } else {
    nameInput.focus();
  }
})();
