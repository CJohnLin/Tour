<script setup>
import { ref, watch, computed, onMounted } from 'vue'

// --- 1. 基礎狀態與分頁 ---
const currentTab = ref('itinerary')
const isShowModal = ref(false)         // 行程彈窗
const isShowExpenseModal = ref(false)  // 記帳彈窗
const isShowShoppingModal = ref(false) // 購物彈窗

// --- 2. 即時匯率邏輯 (JPY to TWD) ---
const exchangeRate = ref(0.21) 
const lastUpdate = ref('')

const fetchExchangeRate = async () => {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY')
    const data = await res.json()
    if (data?.rates?.TWD) {
      exchangeRate.value = data.rates.TWD.toFixed(4)
      lastUpdate.value = new Date().toLocaleTimeString()
    }
  } catch (error) {
    console.error('匯率獲取失敗，使用預設值', error)
  }
}

onMounted(() => {
  fetchExchangeRate()
})

// --- 3. 行程數據邏輯 ---
const itineraryList = ref(JSON.parse(localStorage.getItem('my_itinerary')) || [])
watch(itineraryList, (newVal) => localStorage.setItem('my_itinerary', JSON.stringify(newVal)), { deep: true })

const newEntry = ref({ time: '', from: '', to: '', flightNo: '', type: 'flight' })

const saveEntry = () => {
  if (!newEntry.value.from || !newEntry.value.to) return alert('請填寫完整行程')
  itineraryList.value.push({ id: Date.now(), ...newEntry.value, status: '已確認' })
  newEntry.value = { time: '', from: '', to: '', flightNo: '', type: 'flight' }
  isShowModal.value = false
}

const deleteItem = (id) => {
  if (confirm('確定刪除行程？')) itineraryList.value = itineraryList.value.filter(i => i.id !== id)
}

// --- 4. 記帳數據邏輯 (TWD) ---
const expenseList = ref(JSON.parse(localStorage.getItem('my_expenses')) || [])
watch(expenseList, (newVal) => localStorage.setItem('my_expenses', JSON.stringify(newVal)), { deep: true })

const newExpense = ref({ title: '', jpy: 0 })
const totalTWD = computed(() => expenseList.value.reduce((sum, item) => sum + Number(item.twd), 0))
const totalJPY = computed(() => expenseList.value.reduce((sum, item) => sum + Number(item.jpy), 0))

const saveExpense = () => {
  if (!newExpense.value.title || newExpense.value.jpy <= 0) return alert('請輸入金額')
  const twdAmount = (newExpense.value.jpy * exchangeRate.value).toFixed(0)
  expenseList.value.unshift({ id: Date.now(), ...newExpense.value, twd: twdAmount, date: new Date().toLocaleDateString() })
  newExpense.value = { title: '', jpy: 0 }
  isShowExpenseModal.value = false
}

const deleteExpense = (id) => {
  if (confirm('確定刪除帳目？')) expenseList.value = expenseList.value.filter(e => e.id !== id)
}

// --- 5. 購物清單邏輯 (含圖片) ---
const shoppingList = ref(JSON.parse(localStorage.getItem('my_shopping')) || [])
watch(shoppingList, (newVal) => localStorage.setItem('my_shopping', JSON.stringify(newVal)), { deep: true })

const newShoppingItem = ref({ title: '', jpy: 0, image: '' })

const handleImageUpload = (e) => {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => { newShoppingItem.value.image = event.target.result }
    reader.readAsDataURL(file)
  }
}

const saveShoppingItem = () => {
  if (!newShoppingItem.value.title) return alert('請輸入商品名稱')
  shoppingList.value.push({ id: Date.now(), ...newShoppingItem.value, bought: false })
  newShoppingItem.value = { title: '', jpy: 0, image: '' }
  isShowShoppingModal.value = false
}

const deleteShoppingItem = (id) => {
  if (confirm('確定刪除商品？')) shoppingList.value = shoppingList.value.filter(item => item.id !== id)
}
</script>

<template>
  <div class="min-h-screen w-full bg-cover bg-center bg-fixed text-slate-800 pb-32" 
       style="background-image: url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop');">
    
    <header class="p-6 pt-12 backdrop-blur-sm bg-white/10 flex justify-between items-end text-white">
      <div><h1 class="text-3xl font-bold drop-shadow-lg">eMenu Tokyo ▲</h1></div>
      <div class="text-right">
        <p class="text-[10px] opacity-70">即時匯率 (JPY/TWD)</p>
        <span class="text-lg font-bold text-blue-200">1 ≈ {{ exchangeRate }}</span>
      </div>
    </header>

    <main class="p-4 space-y-6">
      <div v-if="currentTab === 'itinerary'" class="space-y-4 animate-fade-in">
        <div class="flex justify-between items-center px-2 text-white">
          <h2 class="text-xl font-bold drop-shadow-md">行程安排</h2>
          <button @click="isShowModal = true" class="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-sm">+ 新增</button>
        </div>
        <div v-for="item in itineraryList" :key="item.id">
          <div v-if="item.type === 'flight'" class="bg-gradient-to-br from-blue-600/90 to-indigo-700/90 backdrop-blur-lg rounded-[32px] p-6 text-white shadow-xl mb-4">
            <div class="flex justify-between mb-6"><span class="bg-white/20 px-3 py-1 rounded-lg text-xs">Flight {{ item.time }}</span><button @click="deleteItem(item.id)" class="opacity-40">✕</button></div>
            <div class="flex justify-between items-center mb-6"><h3 class="text-3xl font-black">{{ item.from }}</h3><span class="text-xl">✈️</span><h3 class="text-3xl font-black">{{ item.to }}</h3></div>
            <div class="bg-white/10 rounded-xl p-3 flex justify-between text-sm"><span>{{ item.flightNo }}</span><span class="bg-white text-blue-600 px-3 py-1 rounded-lg font-bold text-xs">{{ item.status }}</span></div>
          </div>
          <div v-else class="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-lg mb-4 flex items-center gap-4">
            <div class="bg-blue-100 p-3 rounded-2xl text-2xl">🚆</div>
            <div class="flex-1"><div class="flex justify-between text-blue-500 font-bold text-xs"><span>{{ item.time }}</span><button @click="deleteItem(item.id)" class="text-slate-300">✕</button></div><h4 class="font-bold text-slate-700 text-lg">{{ item.from }} → {{ item.to }}</h4></div>
          </div>
        </div>
      </div>

      <div v-else-if="currentTab === 'ledger'" class="space-y-6 animate-fade-in">
        <div class="bg-gradient-to-br from-indigo-600/90 to-blue-700/90 backdrop-blur-lg rounded-[40px] p-8 text-white shadow-2xl text-center border border-white/20">
          <p class="text-sm opacity-80 mb-2 uppercase">總支出 (TWD)</p>
          <h2 class="text-5xl font-black mb-2">$ {{ totalTWD.toLocaleString() }}</h2>
          <div class="bg-white/10 rounded-full py-1 px-4 inline-block text-xs">日幣 ¥{{ totalJPY.toLocaleString() }}</div>
        </div>
        <button @click="isShowExpenseModal = true" class="w-full bg-white/20 backdrop-blur-md text-white py-4 rounded-3xl font-bold">+ 新增開銷</button>
        <div v-for="item in expenseList" :key="item.id" class="bg-white/90 backdrop-blur-md rounded-3xl p-5 flex justify-between items-center shadow-lg">
          <div><p class="font-bold text-slate-700">{{ item.title }}</p><p class="text-[10px] text-slate-400">¥{{ item.jpy }}</p></div>
          <div class="flex items-center gap-4"><span class="text-lg font-black text-blue-600">$ {{ item.twd }}</span><button @click="deleteExpense(item.id)" class="text-slate-300">✕</button></div>
        </div>
      </div>

      <div v-else-if="currentTab === 'shopping'" class="space-y-4 animate-fade-in">
        <div class="flex justify-between items-center px-2 text-white">
          <h2 class="text-xl font-bold drop-shadow-md">購物清單</h2>
          <button @click="isShowShoppingModal = true" class="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-sm">+ 新增商品</button>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div v-for="item in shoppingList" :key="item.id" class="bg-white/90 backdrop-blur-md rounded-[28px] overflow-hidden shadow-lg relative">
            <div class="h-32 bg-slate-200"><img v-if="item.image" :src="item.image" class="w-full h-full object-cover"><div v-else class="h-full flex items-center justify-center text-3xl">🎁</div></div>
            <div class="p-4"><h4 class="font-bold text-slate-700 truncate text-sm">{{ item.title }}</h4><p class="text-blue-600 font-black">¥ {{ item.jpy }}</p></div>
            <div class="absolute top-2 right-2 flex flex-col gap-2"><button @click="deleteShoppingItem(item.id)" class="bg-black/20 text-white rounded-full w-6 h-6 text-xs">✕</button><button @click="item.bought = !item.bought" :class="item.bought ? 'bg-green-500' : 'bg-white/50'" class="rounded-full w-6 h-6 border flex items-center justify-center">{{ item.bought ? '✓' : '' }}</button></div>
          </div>
        </div>
      </div>
    </main>

    <nav class="fixed bottom-8 left-6 right-6 bg-white/80 backdrop-blur-2xl rounded-[40px] shadow-2xl flex justify-around p-4 z-50">
      <button @click="currentTab = 'itinerary'" :class="currentTab === 'itinerary' ? 'text-blue-600' : 'text-slate-400'"><span class="text-2xl">🗺️</span></button>
      <button @click="currentTab = 'ledger'" :class="currentTab === 'ledger' ? 'text-blue-600' : 'text-slate-400'"><span class="text-2xl">👛</span></button>
      <button @click="currentTab = 'shopping'" :class="currentTab === 'shopping' ? 'text-blue-600' : 'text-slate-400'"><span class="text-2xl">🛍️</span></button>
    </nav>

    <div v-if="isShowModal || isShowExpenseModal || isShowShoppingModal" class="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-md" @click="isShowModal = isShowExpenseModal = isShowShoppingModal = false"></div>
      
      <div v-if="isShowModal" class="relative bg-white rounded-[32px] w-full max-w-md p-8 animate-pop-in">
        <h3 class="text-2xl font-bold mb-6 text-center">新增行程</h3>
        <input v-model="newEntry.time" type="time" class="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none">
        <div class="grid grid-cols-2 gap-2 mb-4"><input v-model="newEntry.from" placeholder="從" class="w-full bg-slate-100 rounded-2xl p-4 outline-none"><input v-model="newEntry.to" placeholder="到" class="w-full bg-slate-100 rounded-2xl p-4 outline-none"></div>
        <select v-model="newEntry.type" class="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none"><option value="flight">✈️ 航班樣式</option><option value="train">🚆 交通樣式</option></select>
        <button @click="saveEntry" class="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl">確認新增</button>
      </div>

      <div v-if="isShowExpenseModal" class="relative bg-white rounded-[32px] w-full max-w-md p-8 animate-pop-in">
        <h3 class="text-2xl font-bold mb-6 text-center">新增開銷</h3>
        <input v-model="newExpense.title" placeholder="項目" class="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none">
        <input v-model="newExpense.jpy" type="number" placeholder="日幣 ¥" class="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none">
        <button @click="saveExpense" class="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl">確認新增</button>
      </div>

      <div v-if="isShowShoppingModal" class="relative bg-white rounded-[32px] w-full max-w-md p-8 animate-pop-in">
        <h3 class="text-2xl font-bold mb-6 text-center">新增購物項目</h3>
        <div class="h-32 bg-slate-100 rounded-2xl mb-4 relative flex items-center justify-center border-2 border-dashed border-slate-300">
          <img v-if="newShoppingItem.image" :src="newShoppingItem.image" class="w-full h-full object-cover rounded-2xl">
          <span v-else class="text-slate-400">📸 上傳照片</span>
          <input type="file" @change="handleImageUpload" class="absolute inset-0 opacity-0">
        </div>
        <input v-model="newShoppingItem.title" placeholder="商品名稱" class="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none">
        <input v-model="newShoppingItem.jpy" type="number" placeholder="價格 ¥" class="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none">
        <button @click="saveShoppingItem" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl">加入清單</button>
      </div>
    </div>
  </div>
</template>

<style>
.animate-fade-in { animation: fadeIn 0.4s ease-out; }
.animate-pop-in { animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
::-webkit-scrollbar { display: none; }
</style>