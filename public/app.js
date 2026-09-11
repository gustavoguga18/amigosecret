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
  const editNameBtn = document.getElementById('edit-name-btn');
  const peopleListEl = document.getElementById('people-list');
  const panel = document.getElementById('panel');
  const toastEl = document.getElementById('toast');

  // Contagem regressiva para o Natal de 2026
  const christmasTarget = new Date('2026-12-25T00:00:00');

  function getChristmasCountdown(now){
    if(now >= christmasTarget){
      return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, finished: true };
    }

    // Calcula meses completos primeiro e depois o restante em dias/horas/minutos/segundos.
    let months = (christmasTarget.getFullYear() - now.getFullYear()) * 12
      + (christmasTarget.getMonth() - now.getMonth());
    let anchor = new Date(now);
    anchor.setMonth(anchor.getMonth() + months);

    if(anchor > christmasTarget){
      months--;
      anchor = new Date(now);
      anchor.setMonth(anchor.getMonth() + months);
    }

    let remaining = christmasTarget.getTime() - anchor.getTime();
    const days = Math.floor(remaining / 86400000);
    remaining -= days * 86400000;
    const hours = Math.floor(remaining / 3600000);
    remaining -= hours * 3600000;
    const minutes = Math.floor(remaining / 60000);
    remaining -= minutes * 60000;
    const seconds = Math.floor(remaining / 1000);

    return { months, days, hours, minutes, seconds, finished: false };
  }

  function updateChristmasCountdown(){
    const countdowns = document.querySelectorAll('.christmas-countdown');
    if(!countdowns.length) return;

    const value = getChristmasCountdown(new Date());
    countdowns.forEach((box) => {
      const suffix = box.closest('#main-screen') ? '-main' : '';
      const months = box.querySelector('#count-months' + suffix);
      const days = box.querySelector('#count-days' + suffix);
      const hours = box.querySelector('#count-hours' + suffix);
      const minutes = box.querySelector('#count-minutes' + suffix);
      const seconds = box.querySelector('#count-seconds' + suffix);

      if(value.finished){
        box.classList.add('finished');
        box.querySelector('.countdown-title').textContent = '🎄 Feliz Natal! 🎅';
        box.querySelector('.countdown-units').innerHTML = '<div class="countdown-title">Que seja um Natal cheio de alegria e união!</div>';
        return;
      }

      months.textContent = String(value.months);
      days.textContent = String(value.days);
      hours.textContent = String(value.hours).padStart(2, '0');
      minutes.textContent = String(value.minutes).padStart(2, '0');
      seconds.textContent = String(value.seconds).padStart(2, '0');
    });
  }

  updateChristmasCountdown();
  setInterval(updateChristmasCountdown, 1000);

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
              ${g.claimed ? '<span class="tag claimed-tag">já garantido</span>' : ''}
            </div>
            ${g.note ? `<div class="g-note">${escapeHtml(g.note)}</div>` : ''}
            ${g.link ? `<a class="g-link" href="${escapeHtml(g.link)}" target="_blank" rel="noopener">ver link ↗</a>` : ''}
          </div>
          <div class="gift-actions">
            ${!isMine ? `<button class="icon-btn ${g.claimed ? 'claim-on' : ''}" data-action="claim" data-id="${g.id}" ${g.claimed && g.claimed_by !== currentUser ? 'disabled' : ''}>${g.claimed ? (g.claimed_by === currentUser ? 'desmarcar' : 'já escolhido') : 'vou comprar'}</button>` : ''}
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
          <div class="field">
            <label for="f-title">O que você quer</label>
            <input id="f-title" type="text" maxlength="80" placeholder="Ex: livro de receitas, tênis de corrida..." required />
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
            <label for="f-image-file">Imagem (opcional)</label>
            <input id="f-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
            <small class="field-help">Escolha uma foto do celular ou computador (até 3 MB).</small>
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

    // Clique na miniatura para abrir a imagem em tamanho grande
    panel.querySelectorAll('.g-thumb').forEach(img => {
      img.addEventListener('click', () => openImageModal(img.src, img.alt || 'Foto do presente'));
    });

    panel.querySelectorAll('[data-action="claim"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try{
          const data = await api('/gifts/' + id + '/claim', {
            method: 'PATCH',
            body: JSON.stringify({ user: currentUser })
          });
          peopleCache[selectedPerson] = data.gifts;
          renderPanel();
          showToast(data.claimed ? 'Item reservado para você.' : 'Reserva desfeita.');
        }catch(e){ showToast('Não consegui atualizar.'); }
      });
    });

    const form = document.getElementById('add-form');
    const imageFileInput = document.getElementById('f-image-file');
    const imagePreview = document.getElementById('f-image-preview');
    let uploadedImage = '';

    if(imageFileInput){
      imageFileInput.addEventListener('change', () => {
        const file = imageFileInput.files && imageFileInput.files[0];
        uploadedImage = '';
        imagePreview.style.display = 'none';
        if(!file) return;

        if(file.size > 3 * 1024 * 1024){
          imageFileInput.value = '';
          showToast('A imagem deve ter no máximo 3 MB.');
          return;
        }
        if(!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)){
          imageFileInput.value = '';
          showToast('Formato de imagem não suportado.');
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          uploadedImage = String(reader.result || '');
          imagePreview.src = uploadedImage;
          imagePreview.style.display = 'block';
        };
        reader.onerror = () => showToast('Não consegui ler a imagem.');
        reader.readAsDataURL(file);
      });
    }

    if(form){
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('f-title').value.trim();
        if(!title) return;
        const note = document.getElementById('f-note').value.trim();
        const link = document.getElementById('f-link').value.trim();
        try{
          const data = await api('/people/' + encodeURIComponent(selectedPerson) + '/gifts', {
            method: 'POST',
            body: JSON.stringify({ title, note, link, image: uploadedImage })
          });
          peopleCache[selectedPerson] = data.gifts;
          await loadPeopleList();
          renderPeopleList();
          renderPanel();
          showToast('Ideia adicionada à sua lista!');
        }catch(e){ showToast(e.message || 'Não consegui adicionar.'); }
      });
    }
  }


  function openImageModal(src, alt){
    let modal = document.getElementById('image-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'image-modal';
      modal.className = 'image-modal';
      modal.innerHTML = `
        <button class="image-modal-close" type="button" aria-label="Fechar">×</button>
        <div class="image-modal-content">
          <img id="image-modal-img" src="" alt="" />
        </div>`;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if(e.target === modal || e.target.classList.contains('image-modal-content')) closeImageModal();
      });
      modal.querySelector('.image-modal-close').addEventListener('click', closeImageModal);
    }

    const modalImg = document.getElementById('image-modal-img');
    modalImg.src = src;
    modalImg.alt = alt;
    modal.classList.add('show');
    document.body.classList.add('modal-open');
  }

  function closeImageModal(){
    const modal = document.getElementById('image-modal');
    if(!modal) return;
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeImageModal();
  });

  async function editCurrentName(){
    if(!currentUser) return;
    const newName = window.prompt('Digite o novo nome:', currentUser);
    if(newName === null) return;
    const cleanName = newName.trim();
    if(!cleanName || cleanName === currentUser){
      if(!cleanName) showToast('Digite um nome válido.');
      return;
    }

    editNameBtn.disabled = true;
    try{
      const oldName = currentUser;
      const data = await api('/people/' + encodeURIComponent(oldName), {
        method: 'PATCH',
        body: JSON.stringify({ name: cleanName })
      });
      currentUser = data.name;
      selectedPerson = data.name;
      peopleCache[data.name] = data.gifts;
      delete peopleCache[oldName];
      localStorage.setItem(STORAGE_KEY, currentUser);
      meLabel.textContent = currentUser;
      await loadPeopleList();
      renderPeopleList();
      renderPanel();
      showToast('Nome alterado com sucesso!');
    }catch(e){
      showToast(e.message || 'Não consegui alterar o nome.');
    }finally{
      editNameBtn.disabled = false;
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

  editNameBtn.addEventListener('click', editCurrentName);

  switchBtn.addEventListener('click', () => {
    currentUser = null;
    selectedPerson = null;
    localStorage.removeItem(STORAGE_KEY);
    main.style.display = 'none';
    gate.style.display = 'block';
    nameInput.value = '';
    nameInput.focus();
  });
  
  /* =========================================================
     GRÁFICO DE ACESSOS REAIS
     ========================================================= */

  function contributionLevel(value){
    if(value === 0) return 0;
    if(value <= 2) return 1;
    if(value <= 5) return 2;
    if(value <= 10) return 3;
    return 4;
  }

  async function registrarAcesso(){
  try{
    const response = await fetch('/api/acessos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }

  }catch(error){
    console.error('Erro ao registrar acesso:', error);
  }
}


async function buscarAcessos(){
  try{
    const response = await fetch('/api/acessos');

    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();

  }catch(error){
    console.error('Erro ao buscar acessos:', error);
    return {};
  }
}

  async function createContributionGraph(){

  const grid = document.getElementById('contributionGrid');
  const months = document.getElementById('contributionMonths');
  const totalEl = document.getElementById('contributionTotal');

  if(!grid || !months || !totalEl) return;

  grid.innerHTML = '';
  months.innerHTML = '';

  // Busca os acessos reais registrados no Supabase
  const acessosPorDia = await buscarAcessos();

  /*
   * PERÍODO DO GRÁFICO
   *
   * Setembro/2026 até Janeiro/2027
   */
  const startDate = new Date(2026, 8, 1);  // 01/09/2026
  const endDate = new Date(2027, 0, 31);    // 31/01/2027

  /*
   * O gráfico começa sempre na segunda-feira
   * e termina sempre no domingo.
   *
   * JavaScript:
   * Domingo = 0
   * Segunda = 1
   * ...
   * Sábado = 6
   */

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ajusta início para a segunda-feira da semana
  const startDay = start.getDay();

  const daysFromMonday =
    startDay === 0
      ? 6
      : startDay - 1;

  start.setDate(start.getDate() - daysFromMonday);

  // Ajusta fim para o domingo da semana
  const endDay = end.getDay();

  const daysToSunday =
    endDay === 0
      ? 0
      : 7 - endDay;

  end.setDate(end.getDate() + daysToSunday);

  /*
   * Calcula quantidade de semanas completas.
   */
  const totalDays =
    Math.floor(
      (end - start) / 86400000
    ) + 1;

  const totalWeeks =
    Math.ceil(totalDays / 7);

  let total = 0;

  /*
   * Data atual.
   *
   * Dias futuros serão ocultados.
   */
  const today = new Date();

  today.setHours(23, 59, 59, 999);

  /*
   * Cria as semanas.
   */
  for(let week = 0; week < totalWeeks; week++){

    const weekEl =
      document.createElement('div');

    weekEl.className =
      'contribution-week';

    for(let day = 0; day < 7; day++){

      const date =
        new Date(start);

      date.setDate(
        start.getDate() +
        (week * 7) +
        day
      );

      date.setHours(0, 0, 0, 0);

      const square =
        document.createElement('i');

      square.className =
        'contribution-square';

      /*
       * Dias fora do período solicitado:
       *
       * antes de 01/09/2026
       * depois de 31/01/2027
       */
      if(date < startDate || date > endDate){
  square.classList.add('empty');
  square.style.visibility = 'hidden';
} else {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayNumber = String(date.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${dayNumber}`;

  const value = Number(acessosPorDia[dateKey] || 0);

  total += value;

  square.classList.add(`level-${contributionLevel(value)}`);

  const dateText = date.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  );

  square.title = `${value} ${
    value === 1 ? 'acesso' : 'acessos'
  } em ${dateText}`;

  square.setAttribute('aria-label', square.title);
}

      weekEl.appendChild(square);
    }

    grid.appendChild(weekEl);
  }

  /*
   * NOMES DOS MESES
   *
   * Setembro → Outubro → Novembro
   * → Dezembro → Janeiro
   */
  const monthNames = [
    'Jan','Fev','Mar','Abr','Mai','Jun',
    'Jul','Ago','Set','Out','Nov','Dez'
  ];

  const monthsToShow = [
    new Date(2026, 8, 1),  // Setembro
    new Date(2026, 9, 1),  // Outubro
    new Date(2026, 10, 1), // Novembro
    new Date(2026, 11, 1), // Dezembro
    new Date(2027, 0, 1)   // Janeiro
  ];

  /*
   * Posiciona cada mês exatamente na
   * semana correspondente.
   */
  monthsToShow.forEach(monthDate => {

    const monthEl =
      document.createElement('span');

    monthEl.className =
      'contribution-month';

    monthEl.textContent =
      monthNames[monthDate.getMonth()];

    const diffDays =
      Math.floor(
        (monthDate - start) / 86400000
      );

    const weekPosition =
      diffDays / 7;

    monthEl.style.left =
      `${(weekPosition / totalWeeks) * 100}%`;

    months.appendChild(monthEl);
  });

  /*
   * Total de acessos no período:
   *
   * Setembro/2026 → Janeiro/2027
   */
  totalEl.textContent =
    `${total} ${
      total === 1
        ? 'acesso'
        : 'acessos'
    } de Set/2026 a Jan/2027`;
}
  /*
   * Registra o carregamento da página
   * e atualiza o gráfico.
   */
  registrarAcesso();
  createContributionGraph();
  
  // Boot: se já tem nome salvo neste navegador, entra direto
  const savedName = localStorage.getItem(STORAGE_KEY);
  if(savedName){
    nameInput.value = savedName;
    enterAs(savedName);
  } else {
    nameInput.focus();
  }
})();
