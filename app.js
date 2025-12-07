/* Simple localStorage-based POS */
(() => {
  // ---- Utilities
  const $ = id => document.getElementById(id);
  const q = s => document.querySelector(s);
  const formatCurrency = v => `₹${Number(v||0).toLocaleString()}`;

  // ---- Initial data keys
  const DB_KEY = 'pos_local_db_v1';

  // ---- Default DB
  const defaultDB = {
    storeName: 'My Store',
    products: [
      // sample
      {id: 'p1', name:'Sample Coffee', cat:'Beverages', sku:'C-001', cost:30, price:50, qty:10, img:''}
    ],
    sales: [] // {id, items:[{pid,qty,price}], total, date}
  };

  // ---- Load / Save
  function loadDB(){ try { return JSON.parse(localStorage.getItem(DB_KEY)) || JSON.parse(JSON.stringify(defaultDB)); } catch(e){ return JSON.parse(JSON.stringify(defaultDB)); } }
  function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  // ---- App state
  let DB = loadDB();
  saveDB(DB);

  // ---- Views
  const views = document.querySelectorAll('.view');
  function showView(name){
    views.forEach(v => v.id === name ? v.classList.remove('hidden') : v.classList.add('hidden'));
    // nav active
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.view===name));
    if(name==='dashboard') renderDashboard();
    if(name==='products') renderProducts();
    if(name==='inventory') renderInventory();
    if(name==='pos') renderPos();
    if(name==='reports') renderReports();
  }

  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      showView(a.dataset.view);
    });
  });

  // theme toggle
  const appRoot = document.getElementById('app');
  const themeBtn = $('themeToggle');
  let dark = false;
  themeBtn.addEventListener('click', ()=>{
    dark = !dark;
    appRoot.className = dark ? 'dark' : 'light';
    themeBtn.textContent = dark? 'Light':'Dark';
    // quick CSS for dark
    if(dark){
      document.documentElement.style.setProperty('--bg','#0f1724');
      document.documentElement.style.setProperty('--card','#071226');
      document.documentElement.style.setProperty('--text','#e6eef8');
      document.documentElement.style.setProperty('--muted','#9aa6bd');
      document.documentElement.style.setProperty('--accent','#17a2ff');
    } else {
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--card');
      document.documentElement.style.removeProperty('--text');
      document.documentElement.style.removeProperty('--muted');
      document.documentElement.style.removeProperty('--accent');
    }
  });

  // ----- DASHBOARD
  function renderDashboard(){
    $('storeName').textContent = DB.storeName;
    // totals
    const totalSales = DB.sales.reduce((s,r) => s + (r.total||0), 0);
    $('totalSales').textContent = formatCurrency(totalSales);
    const todays = DB.sales.filter(s => new Date(s.date).toDateString() === (new Date()).toDateString()).length;
    $('todaysOrders').textContent = todays;
    $('productsCount').textContent = DB.products.length;
    const stockValue = DB.products.reduce((s,p) => s + (p.cost||0)*(p.qty||0), 0);
    $('stockValue').textContent = formatCurrency(stockValue);

    // latest products
    const latest = $('latestProducts');
    latest.innerHTML = '';
    DB.products.slice().reverse().slice(0,6).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.name} — ${formatCurrency(p.price)} — ${p.qty}pcs`;
      latest.appendChild(li);
    });

    // quickPos small list
    const qp = $('quickPos');
    qp.innerHTML = '';
    DB.products.slice(0,6).forEach(p=>{
      const b = document.createElement('button');
      b.textContent = `${p.name} • ${formatCurrency(p.price)}`;
      b.style.margin = '4px';
      b.addEventListener('click', ()=>{
        showView('pos'); setTimeout(()=>{ addToCartById(p.id); }, 120);
      });
      qp.appendChild(b);
    });
  }

  // ----- PRODUCTS
  const frm = $('frmProduct');
  let editingId = null;

  function renderProducts(){
    // list
    const tbody = $('tblProducts');
    tbody.innerHTML = '';
    DB.products.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx+1}</td><td>${p.name}</td><td>${formatCurrency(p.price)}</td><td>${p.qty}</td>
        <td>
          <button data-id="${p.id}" class="edit">Edit</button>
          <button data-id="${p.id}" class="del">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    });
    // wire edit/delete
    tbody.querySelectorAll('.edit').forEach(b=>{
      b.addEventListener('click', ()=> openEditProduct(b.dataset.id));
    });
    tbody.querySelectorAll('.del').forEach(b=>{
      b.addEventListener('click', ()=> {
        if(confirm('Delete product?')){
          DB.products = DB.products.filter(x=>x.id!==b.dataset.id); saveDB(DB); renderProducts(); renderDashboard();
        }
      });
    });

    // form buttons
    $('btnAddProduct').onclick = () => openAddProduct();
    $('cancelProduct').onclick = () => hideForm();
    // search
    $('searchProduct').oninput = e => {
      const qv = e.target.value.toLowerCase();
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.forEach((r, idx) => {
        const name = DB.products[idx].name.toLowerCase();
        r.style.display = name.includes(qv) ? '' : 'none';
      });
    };

    // export CSV
    $('exportCSV').onclick = () => {
      const csv = CSVFromProducts(DB.products);
      downloadFile(csv, 'products.csv','text/csv');
    };
  }

  function openAddProduct(){
    editingId = null;
    $('productForm').classList.remove('hidden');
    $('formTitle').textContent = 'Add Product';
    frm.reset();
  }
  function openEditProduct(id){
    editingId = id;
    const p = DB.products.find(x=>x.id===id);
    if(!p) return alert('Not found');
    $('productForm').classList.remove('hidden');
    $('formTitle').textContent = 'Edit Product';
    $('p_name').value = p.name;
    $('p_cat').value = p.cat||'';
    $('p_sku').value = p.sku||'';
    $('p_cost').value = p.cost||0;
    $('p_price').value = p.price||0;
    $('p_qty').value = p.qty||0;
  }
  function hideForm(){ $('productForm').classList.add('hidden'); frm.reset(); editingId=null; }

  // handle image reading and save product
  $('p_img').addEventListener('change', function(e){
    // nothing to do here globally; handled on submit
  });

  frm.addEventListener('submit', async function(e){
    e.preventDefault();
    const p = {
      id: editingId || `p${Date.now()}`,
      name: $('p_name').value.trim(),
      cat: $('p_cat').value.trim(),
      sku: $('p_sku').value.trim(),
      cost: parseFloat($('p_cost').value||0),
      price: parseFloat($('p_price').value||0),
      qty: parseInt($('p_qty').value||0,10),
      img: ''
    };
    // read image (if any)
    const fileInput = $('p_img');
    if(fileInput.files && fileInput.files[0]){
      p.img = await readFileAsDataURL(fileInput.files[0]);
    } else {
      // keep existing image when editing
      if(editingId){
        const existing = DB.products.find(x=>x.id===editingId);
        if(existing) p.img = existing.img || '';
      }
    }

    if(editingId){
      DB.products = DB.products.map(x => x.id===editingId ? p : x);
    } else {
      DB.products.push(p);
    }
    saveDB(DB);
    hideForm(); renderProducts(); renderDashboard();
  });

  // ----- INVENTORY
  function renderInventory(){
    const c = $('invList');
    c.innerHTML = '<table class="table"><thead><tr><th>Name</th><th>Qty</th><th>Cost</th><th>Value</th></tr></thead><tbody>' +
      DB.products.map(p=>`<tr><td>${p.name}</td><td>${p.qty}</td><td>${formatCurrency(p.cost)}</td><td>${formatCurrency((p.cost||0)*(p.qty||0))}</td></tr>`).join('') +
      '</tbody></table>';
  }

  // ----- POS (cart)
  let cart = [];
  function renderPos(){
    // search results list
    $('posResults').innerHTML = DB.products.map(p=>`<li data-id="${p.id}">${p.name} • ${formatCurrency(p.price)} • ${p.qty}pcs</li>`).join('');
    document.querySelectorAll('#posResults li').forEach(li=>{
      li.addEventListener('click', ()=> addToCartById(li.dataset.id));
    });
    // search input
    $('posSearch').oninput = e => {
      const qv = e.target.value.toLowerCase();
      $('posResults').innerHTML = DB.products.filter(p=>p.name.toLowerCase().includes(qv)).map(p=>`<li data-id="${p.id}">${p.name} • ${formatCurrency(p.price)} • ${p.qty}pcs</li>`).join('');
      document.querySelectorAll('#posResults li').forEach(li=>{
        li.addEventListener('click', ()=> addToCartById(li.dataset.id));
      });
    };

    // cart UI
    updateCartUI();

    // summary inputs
    $('taxPct').oninput = updateCartUI;
    $('discPct').oninput = updateCartUI;

    $('btnClearCart').onclick = ()=> { cart=[]; updateCartUI(); };
    $('btnCheckout').onclick = checkout;
  }

  function addToCartById(pid){
    const product = DB.products.find(p=>p.id===pid);
    if(!product) return alert('Product not found');
    const item = cart.find(c=>c.pid===pid);
    if(item){
      item.qty++;
    } else {
      cart.push({pid,qty:1, price:product.price});
    }
    updateCartUI();
  }

  function updateCartUI(){
    const tbody = $('cartBody');
    tbody.innerHTML = '';
    let subtotal = 0;
    cart.forEach((it, idx) => {
      const p = DB.products.find(x=>x.id===it.pid);
      const total = it.qty * (it.price||0);
      subtotal += total;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td>
        <td><input type="number" data-idx="${idx}" class="cartqty" value="${it.qty}" min="1" style="width:60px"></td>
        <td>${formatCurrency(it.price)}</td>
        <td>${formatCurrency(total)}</td>
        <td><button data-idx="${idx}" class="rem">x</button></td>`;
      tbody.appendChild(tr);
    });

    // wire qty & remove
    tbody.querySelectorAll('.cartqty').forEach(inp=>{
      inp.addEventListener('change', e=>{
        const i = +e.target.dataset.idx;
        cart[i].qty = Math.max(1, parseInt(e.target.value||1,10));
        updateCartUI();
      });
    });
    tbody.querySelectorAll('.rem').forEach(b=>{
      b.addEventListener('click', e=>{
        const i = +e.target.dataset.idx;
        cart.splice(i,1); updateCartUI();
      });
    });

    // calc totals
    const taxPct = parseFloat($('taxPct').value||0);
    const discPct = parseFloat($('discPct').value||0);
    const taxVal = subtotal * (taxPct/100);
    const discVal = subtotal * (discPct/100);
    const grand = subtotal + taxVal - discVal;
    $('subtotal').textContent = formatCurrency(subtotal);
    $('grandTotal').textContent = formatCurrency(grand);
  }

  function checkout(){
    if(cart.length===0) return alert('Cart empty');
    const subtotal = parseFloat($('subtotal').textContent.replace(/[^\d\.]/g,'')) || 0;
    const taxPct = parseFloat($('taxPct').value||0);
    const discPct = parseFloat($('discPct').value||0);
    const taxVal = subtotal * (taxPct/100);
    const discVal = subtotal * (discPct/100);
    const grand = subtotal + taxVal - discVal;
    // reduce stock
    cart.forEach(item => {
      const p = DB.products.find(x=>x.id===item.pid);
      if(p) p.qty = Math.max(0, (p.qty||0) - (item.qty||0));
    });

    const sale = {
      id: 's'+Date.now(),
      items: cart.map(it => ({pid:it.pid, qty:it.qty, price:it.price})),
      total: grand,
      date: (new Date()).toISOString()
    };
    DB.sales.push(sale);
    saveDB(DB);
    cart = [];
    updateCartUI();
    renderProducts(); renderDashboard(); alert('Sale saved. Total: '+formatCurrency(grand));
  }

  // ----- REPORTS
  function renderReports(){
    $('r_from').value = '';
    $('r_to').value = '';
    $('btnFilterReports').onclick = filterReports;
    $('btnExportSalesCSV').onclick = ()=> {
      const csv = CSVFromSales(DB.sales);
      downloadFile(csv,'sales.csv','text/csv');
    };
    filterReports();
  }
  function filterReports(){
    const from = $('r_from').value ? new Date($('r_from').value) : null;
    const to = $('r_to').value ? new Date($('r_to').value) : null;
    const out = DB.sales.filter(s=>{
      const d = new Date(s.date);
      if(from && d < from) return false;
      if(to && d > new Date(to.getTime()+24*3600*1000)) return false;
      return true;
    });
    const c = $('reportList'); c.innerHTML = '';
    if(out.length===0) { c.textContent = 'No sales found for selected range.'; return; }
    const rows = out.map(s => {
      return `<div class="panel" style="margin-bottom:8px">
        <div><strong>${new Date(s.date).toLocaleString()}</strong> — Total ${formatCurrency(s.total)}</div>
        <ul>${s.items.map(i=>{
          const p = DB.products.find(x=>x.id===i.pid) || {name:'(deleted)'};
          return `<li>${p.name} x${i.qty} @ ${formatCurrency(i.price)}</li>`;
        }).join('')}</ul>
      </div>`;
    }).join('');
    c.innerHTML = rows;
  }

  // ----- SETTINGS
  $('inputStoreName').value = DB.storeName;
  $('inputStoreName').onchange = e => {
    DB.storeName = e.target.value.trim() || 'My Store';
    saveDB(DB); renderDashboard();
  };
  $('btnResetData').onclick = () => {
    if(confirm('Reset all local data? This cannot be undone.')){
      localStorage.removeItem(DB_KEY);
      DB = loadDB();
      saveDB(DB);
      renderAll();
    }
  };

  // ----- Helpers
  function renderAll(){
    renderDashboard(); renderProducts(); renderInventory(); renderPos(); renderReports();
  }
  renderAll();

  function readFileAsDataURL(file){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = ev => res(ev.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function CSVFromProducts(products){
    const header = ['id','name','category','sku','cost','price','qty'];
    const rows = products.map(p => [p.id, p.name, p.cat||'', p.sku||'', p.cost||0, p.price||0, p.qty||0].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
    return header.join(',') + '\n' + rows.join('\n');
  }
  function CSVFromSales(sales){
    const header = ['saleId','date','total','items'];
    const rows = sales.map(s => `"${s.id}","${s.date}","${s.total}","${s.items.map(i=>i.pid+':'+i.qty).join(';')}"`);
    return header.join(',') + '\n' + rows.join('\n');
  }
  function downloadFile(content, filename, mime){
    const blob = new Blob([content], {type: mime || 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'file.txt';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
})();
