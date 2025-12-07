/* Simple POS app using localStorage. Copy all files to GitHub and open index.html */

const STORAGE_KEY = 'pos_demo_v1';
const DEFAULT_PRODUCTS = [
  {id: genId(), name:'Espresso', price:120, qty:50},
  {id: genId(), name:'Cappuccino', price:160, qty:40},
  {id: genId(), name:'Latte', price:180, qty:30},
  {id: genId(), name:'Sandwich', price:200, qty:25},
  {id: genId(), name:'Burger', price:250, qty:15}
];

let state = {
  products: [],
  sales: [],
  cart: []
}

/* ---------- helpers ---------- */
function genId(){ return 'p'+Math.random().toString(36).slice(2,9); }
function currency(v){ return '₹'+Number(v||0).toFixed(2); }
function load(){ const raw = localStorage.getItem(STORAGE_KEY); if(!raw){ state.products = DEFAULT_PRODUCTS; state.sales=[]; save(); } else state = JSON.parse(raw); }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

/* ---------- render views ---------- */
function renderDashboard(){
  document.getElementById('dash-total-sales').innerText = currency(state.sales.reduce((s,x)=>s+x.total,0));
  document.getElementById('dash-today-orders').innerText = state.sales.length;
  document.getElementById('dash-products').innerText = state.products.length;
  const stockValue = state.products.reduce((s,p)=>s+p.price*p.qty,0);
  document.getElementById('dash-stock-value').innerText = currency(stockValue);
}

function renderProductsList(filter=''){
  const el = document.getElementById('products-list');
  el.innerHTML = '';
  const list = state.products.filter(p=>p.name.toLowerCase().includes(filter.toLowerCase()));
  if(list.length===0) el.innerHTML = '<em>No products</em>';
  list.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'product-row';
    div.innerHTML = `<strong>${p.name}</strong> <span>${currency(p.price)}</span> <div>Stock: ${p.qty}</div>`;
    div.style.padding='8px'; div.style.borderBottom='1px solid #eee';
    div.onclick = ()=>openEditProduct(p.id);
    el.appendChild(div);
  })
}

function renderInventory(){
  const el = document.getElementById('inventory-list');
  el.innerHTML='';
  state.products.forEach(p=>{
    const div = document.createElement('div');
    div.className='inv-row';
    div.innerHTML = `<strong>${p.name}</strong> — ${currency(p.price)} — <em>qty ${p.qty}</em>`;
    div.style.padding='8px'; div.style.borderBottom='1px dashed #eee';
    el.appendChild(div);
  })
}

function renderSales(){
  const el = document.getElementById('sales-list');
  el.innerHTML='';
  if(state.sales.length===0){ el.innerHTML='<em>No sales yet</em>'; return; }
  state.sales.slice().reverse().forEach(s=>{
    const div = document.createElement('div');
    div.style.padding='8px'; div.style.borderBottom='1px dashed #ddd';
    div.innerHTML = `<div><strong>Order #${s.id}</strong> • ${new Date(s.date).toLocaleString()}</div>
      <div>Total: ${currency(s.total)}</div>
      <details>${s.items.map(i=>`<div>${i.name} x${i.qty} — ${currency(i.price*i.qty)}</div>`).join('')}</details>`;
    el.appendChild(div);
  })
}

/* ---------- POS logic ---------- */
function renderPosProducts(){
  const el = document.getElementById('pos-products');
  el.innerHTML='';
  state.products.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `<div><strong>${p.name}</strong></div><div>${currency(p.price)}</div><div>Stock: ${p.qty}</div>`;
    card.onclick = ()=>addToCart(p.id);
    el.appendChild(card);
  })
}

function addToCart(pid){
  const p = state.products.find(x=>x.id===pid);
  if(!p || p.qty<=0){ alert('Out of stock'); return; }
  const found = state.cart.find(c=>c.id===pid);
  if(found){ if(found.qty < p.qty) found.qty++; else alert('No more stock'); }
  else state.cart.push({id:p.id,name:p.name,price:p.price,qty:1});
  renderCart();
}

function renderCart(){
  const el = document.getElementById('cart-list');
  el.innerHTML='';
  if(state.cart.length===0){ el.innerHTML='<em>Cart empty</em>'; document.getElementById('cart-subtotal').innerText='₹0'; document.getElementById('cart-total').innerText='₹0'; return; }
  let subtotal=0;
  state.cart.forEach((c,idx)=>{
    const row = document.createElement('div'); row.className='cart-row';
    row.innerHTML = `<div>${c.name} x${c.qty}</div><div>${currency(c.price*c.qty)} <button data-i="${idx}" class="small">−</button></div>`;
    el.appendChild(row);
    subtotal += c.price*c.qty;
  })
  document.querySelectorAll('.cart-row button.small').forEach(b=>b.onclick = (e)=>{
    const i = +e.target.dataset.i;
    if(state.cart[i].qty>1) state.cart[i].qty--; else state.cart.splice(i,1);
    renderCart();
  });
  const tax = subtotal*0.05;
  const total = subtotal+tax;
  document.getElementById('cart-subtotal').innerText = currency(subtotal);
  document.getElementById('cart-tax').innerText = currency(tax);
  document.getElementById('cart-total').innerText = currency(total);
}

function clearCart(){ state.cart=[]; renderCart(); }

function checkout(){
  if(state.cart.length===0){ alert('Cart empty'); return; }
  // reduce stock
  for(const c of state.cart){
    const p = state.products.find(x=>x.id===c.id);
    if(!p || p.qty < c.qty){ alert('Stock problem for '+c.name); return; }
  }
  for(const c of state.cart){
    const p = state.products.find(x=>x.id===c.id);
    p.qty -= c.qty;
  }
  const subtotal = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const tax = subtotal*0.05;
  const total = subtotal+tax;
  const sale = {id: 's'+Date.now(), date: new Date().toISOString(), items: state.cart.map(x=>({...x})), subtotal, tax, total};
  state.sales.push(sale);
  state.cart=[];
  save(); renderCart(); renderInventory(); renderSales(); renderDashboard(); alert('Payment done: '+currency(total));
  printReceipt(sale);
}

function printReceipt(sale){
  const w = window.open('','receipt','width=400,height=600');
  w.document.write(`<pre>
  POS Receipt
  Order: ${sale.id}
  Date: ${new Date(sale.date).toLocaleString()}

  Items:
  ${sale.items.map(it=>`${it.name} x${it.qty}  ${currency(it.price*it.qty)}`).join('\n')}

  Subtotal: ${currency(sale.subtotal)}
  Tax: ${currency(sale.tax)}
  Total: ${currency(sale.total)}

  Thank you!
  </pre>`);
  w.print();
}

/* ---------- product modal ---------- */
let editingId = null;
function openAddProduct(){
  editingId = null;
  document.getElementById('m-name').value=''; document.getElementById('m-price').value=''; document.getElementById('m-qty').value='';
  showModal(true);
}
function openEditProduct(id){
  editingId = id;
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('m-name').value = p.name;
  document.getElementById('m-price').value = p.price;
  document.getElementById('m-qty').value = p.qty;
  showModal(true);
}
function saveModal(){
  const name = document.getElementById('m-name').value.trim();
  const price = parseFloat(document.getElementById('m-price').value) || 0;
  const qty = parseInt(document.getElementById('m-qty').value) || 0;
  if(!name){ alert('Name required'); return; }
  if(editingId){
    const p = state.products.find(x=>x.id===editingId);
    p.name = name; p.price = price; p.qty = qty;
  } else {
    state.products.push({id:genId(), name, price, qty});
  }
  save(); showModal(false); renderAll();
}
function showModal(show){
  const m = document.getElementById('modal-add-product');
  if(show) m.classList.add('active'); else m.classList.remove('active');
}

/* ---------- export CSV ---------- */
function exportSalesCSV(){
  if(state.sales.length===0){ alert('No sales'); return; }
  let csv = 'order_id,date,item,qty,price,total\n';
  state.sales.forEach(s=>{
    s.items.forEach(it=>{
      csv += `${s.id},${s.date},"${it.name}",${it.qty},${it.price},${it.price*it.qty}\n`;
    });
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = 'sales_export.csv'; a.click();
}

/* ---------- routing ---------- */
function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.toggle('active', a.dataset.view===name));
}

/* ---------- init ---------- */
function renderAll(){
  renderDashboard(); renderProductsList(); renderInventory(); renderSales(); renderPosProducts();
}

function init(){
  load(); renderAll(); renderCart();

  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      switchView(a.dataset.view);
    })
  });

  document.getElementById('search-product').addEventListener('input', e=>{
    renderProductsList(e.target.value);
  });

  // modal
  document.getElementById('btn-open-add-product').onclick = openAddProduct;
  document.getElementById('m-cancel').onclick = ()=>showModal(false);
  document.getElementById('m-save').onclick = saveModal;

  // cart actions
  document.getElementById('btn-clear-cart').onclick = ()=>{ if(confirm('Clear cart?')) clearCart(); }
  document.getElementById('btn-checkout').onclick = ()=>{ if(confirm('Proceed to checkout?')) checkout(); }

  // clear storage (dev) with Ctrl+Alt+C
  window.addEventListener('keydown', (e)=>{
    if(e.ctrlKey && e.altKey && e.key.toLowerCase()==='c'){
      if(confirm('Clear all data?')){ localStorage.removeItem(STORAGE_KEY); location.reload(); }
    }
  });

  document.getElementById('btn-export-sales').onclick = exportSalesCSV;

  // open POS product card load
  switchView('dashboard');
}

init();
