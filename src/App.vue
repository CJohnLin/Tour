<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from './firebase'
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc } from 'firebase/firestore'

// --- 1. 核心狀態與頁面切換 ---
const currentTab = ref('itinerary') 
const selectedDay = ref('pre')

// 彈窗狀態
const isShowModal = ref(false)
const isShowExpenseModal = ref(false)
const isShowShoppingModal = ref(false)

// --- 2. 天氣與位置 ---
const weather = ref({ temp: '--', rain: '--', location: '定位中...' })
const fetchWeather = async (lat, lon) => {
  try {
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability`)
    const wData = await wRes.json()
    const gRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
    const gData = await gRes.json()
    weather.value = {
      temp: Math.round(wData.current_weather.temperature),
      rain: wData.hourly.precipitation_probability[0],
      location: gData.address.city || gData.address.suburb || gData.address.town || '目前位置'
    }
  } catch (e) { console.error('天氣定位失敗') }
}

// --- 3. 數據同步 ---
const exchangeRate = ref(0.21)
const jpyBudget = ref(100000) // 預設預算
const itineraryList = ref([])
const expenseList = ref([])
const shoppingList = ref([])

onMounted(() => {
  fetch('https://open.er-api.com/v6/latest/JPY').then(r => r.json()).then(d => {
    if (d?.rates?.TWD) exchangeRate.value = Number(d.rates.TWD).toFixed(4)
  })
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude))
  }
  // 監聽雲端預算
  onSnapshot(doc(db, "config", "wallet"), (snap) => {
    if (snap.exists()) jpyBudget.value = Number(snap.data().amount)
  })
  onSnapshot(query(collection(db, "itinerary"), orderBy("createdAt", "asc")), (snap) => {
    itineraryList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
  onSnapshot(query(collection(db, "expenses"), orderBy("createdAt", "desc")), (snap) => {
    expenseList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
  onSnapshot(collection(db, "shopping"), (snap) => {
    shoppingList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
})

// --- 4. 記帳邏輯 (現金 vs 信用卡雙幣) ---
const totalJpyCash = computed(() => expenseList.value.filter(e => e.payBy === 'cash').reduce((sum, i) => sum + Number(i.jpy), 0))
const totalJpyCard = computed(() => expenseList.value.filter(e => e.payBy === 'card').reduce((sum, i) => sum + Number(i.jpy), 0))
const remainingJpy = computed(() => jpyBudget.value - totalJpyCash.value)

// 預算修改功能
const handleUpdateBudget = async () => {
  const input = prompt("請輸入日幣現金總預算 (¥):", jpyBudget.value)
  if (input !== null && !isNaN(input) && input.trim() !== "") {
    await setDoc(doc(db, "config", "wallet"), { amount: Number(input) })
  }
}

const newExpense = ref({ title: '', jpy: 0, payBy: 'cash' })
const saveExpense = async () => {
  if (!newExpense.value.title || newExpense.value.jpy <= 0) return alert('請填寫內容與金額')
  const twd = (newExpense.value.jpy * exchangeRate.value).toFixed(0)
  await addDoc(collection(db, "expenses"), { ...newExpense.value, twd, createdAt: new Date() })
  isShowExpenseModal.value = false
  newExpense.value = { title: '', jpy: 0, payBy: 'cash' }
}

// --- 5. 行程與購物邏輯 ---
const newEntry = ref({ time: '', from: '', to: '', completed: false })
const saveEntry = async () => {
  await addDoc(collection(db, "itinerary"), { ...newEntry.value, day: selectedDay.value, createdAt: new Date() })
  isShowModal.value = false
  newEntry.value = { time: '', from: '', to: '', completed: false }
}

const newShoppingItem = ref({ title: '', jpy: 0, image: '' })
const handleImage = (e) => {
  const reader = new FileReader()
  reader.onload = (ev) => newShoppingItem.value.image = ev.target.result
  reader.readAsDataURL(e.target.files[0])
}
const saveShoppingItem = async () => {
  if (!newShoppingItem.value.title) return alert('請輸入商品名稱')
  await addDoc(collection(db, "shopping"), { ...newShoppingItem.value, bought: false, createdAt: new Date() })
  isShowShoppingModal.value = false
  newShoppingItem.value = { title: '', jpy: 0, image: '' }
}
</script>

<template>
  <div class="min-h-screen w-full bg-[#f8fafc] pb-44 font-sans selection:bg-blue-100">
    
    <header class="bg-white p-6 pt-14 rounded-b-[45px] shadow-sm flex justify-between items-start sticky top-0 z-[60] border-b border-slate-50">
      <div>
        <h1 class="text-2xl font-black text-slate-800 tracking-tight">📍 {{ weather.location }}</h1>
        <div class="mt-2 flex gap-2">
          <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">🌡️ {{ weather.temp }}°C</span>
          <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">💧 {{ weather.rain }}%</span>
        </div>
      </div>
      <div class="text-right">
        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Rate (JPY/TWD)</p>
        <p class="text-lg font-black text-slate-800 mt-1 leading-none">{{ exchangeRate }}</p>
      </div>
    </header>

    <main class="px-5 mt-6">
      
      <div v-if="currentTab === 'itinerary'" key="tab-itinerary" class="space-y-6 animate-fade-in">
        <div class="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button v-for="day in ['pre', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']" :key="day" @click="selectedDay = day"
            :class="selectedDay === day ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'"
            class="px-5 py-3 rounded-2xl text-xs font-black transition-all border-none">{{ day === 'pre' ? '行前清單' : day }}</button>
        </div>
        <div class="flex justify-between items-center px-1">
          <h2 class="text-2xl font-black text-slate-800 tracking-tight">{{ selectedDay === 'pre' ? '準備項目' : '每日行程' }}</h2>
          <button @click="isShowModal = true" class="bg-blue-600 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-lg">+ 新增</button>
        </div>
        <div class="relative space-y-6 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-200">
          <div v-for="item in itineraryList.filter(i => i.day === selectedDay)" :key="item.id" class="relative pl-12">
            <div :class="item.completed ? 'bg-green-500' : 'bg-blue-600'" class="absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-[#f8fafc] flex items-center justify-center text-white z-10 shadow-sm text-xs font-bold">
              {{ selectedDay === 'pre' ? (item.completed ? '✓' : '!') : item.time.split(':')[0] }}
            </div>
            <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-50 flex justify-between items-start">
              <div class="flex-1">
                <p v-if="selectedDay !== 'pre'" class="text-[10px] font-black text-blue-500 mb-1 uppercase tracking-widest">{{ item.time }}</p>
                <h4 :class="item.completed ? 'line-through text-slate-300' : 'text-slate-700'" class="text-lg font-black leading-tight">{{ item.from }} <span v-if="item.to">→ {{ item.to }}</span></h4>
              </div>
              <div class="flex items-center gap-4">
                <input v-if="selectedDay === 'pre'" type="checkbox" :checked="item.completed" @change="updateDoc(doc(db, 'itinerary', item.id), {completed: !item.completed})" class="w-6 h-6 rounded-lg accent-green-500">
                <button @click="deleteDoc(doc(db, 'itinerary', item.id))" class="text-slate-200 hover:text-red-400 transition-colors">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="currentTab === 'ledger'" key="tab-ledger" class="space-y-6 animate-fade-in">
        <div class="bg-slate-900 rounded-[45px] p-10 text-white shadow-2xl relative overflow-hidden">
          <div class="absolute -right-10 -top-10 w-48 h-48 bg-blue-600/30 rounded-full blur-[80px]"></div>
          <div class="relative z-10 text-center">
            <p class="text-[11px] opacity-40 uppercase mb-2 tracking-[0.2em] font-bold">JPY Cash Remaining</p>
            <h2 class="text-6xl font-black text-blue-400 mb-8 tabular-nums">¥ {{ remainingJpy.toLocaleString() }}</h2>
            <div class="grid grid-cols-2 gap-4 border-t border-white/10 pt-8 mt-4">
              <div class="space-y-1 text-center">
                <p class="text-[10px] opacity-40 uppercase font-bold">現金支出</p>
                <p class="text-xl font-black">¥ {{ totalJpyCash.toLocaleString() }}</p>
              </div>
              <div class="space-y-1 border-l border-white/10 text-center">
                <p class="text-[10px] opacity-40 uppercase font-bold">信用卡累計</p>
                <p class="text-xl font-black text-slate-400">¥ {{ totalJpyCard.toLocaleString() }}</p>
              </div>
            </div>
            <button @click="handleUpdateBudget" class="mt-8 px-6 py-2 rounded-full bg-white/5 text-[10px] font-bold border border-white/10 hover:bg-white/20 transition-all uppercase tracking-widest block mx-auto">
              Adjust Budget (¥{{ jpyBudget.toLocaleString() }})
            </button>
          </div>
        </div>

        <div class="flex justify-between items-center px-1">
          <h2 class="text-2xl font-black text-slate-800">開支明細</h2>
          <button @click="isShowExpenseModal = true" class="bg-slate-900 text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg shadow-slate-200">+ 記一筆</button>
        </div>

        <div class="space-y-4">
          <div v-for="item in expenseList" :key="item.id" class="bg-white rounded-[35px] p-6 flex justify-between items-center shadow-sm border border-slate-50 transition-all hover:scale-[1.01]">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-xl shadow-inner">
                {{ item.payBy === 'cash' ? '💵' : '💳' }}
              </div>
              <div>
                <p class="font-black text-slate-700 text-base leading-none mb-1">{{ item.title }}</p>
                <p class="text-[11px] text-slate-400 font-bold uppercase tracking-tighter">¥{{ item.jpy.toLocaleString() }} · {{ item.payBy === 'cash' ? '現金支付' : '信用卡' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-5 text-right">
              <div>
                <p class="font-black text-blue-600 text-xl tracking-tighter">$ {{ item.twd.toLocaleString() }}</p>
                <p class="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">TWD</p>
              </div>
              <button @click="deleteDoc(doc(db, 'expenses', item.id))" class="text-slate-200 hover:text-red-400 transition-colors">✕</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="currentTab === 'shopping'" key="tab-shopping" class="space-y-6 animate-fade-in">
        <div class="flex justify-between items-center px-1">
          <h2 class="text-2xl font-black text-slate-800 tracking-tight">日本必買</h2>
          <button @click="isShowShoppingModal = true" class="bg-blue-600 text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg shadow-blue-200">+ 新增</button>
        </div>
        <div class="grid grid-cols-2 gap-5">
          <div v-for="item in shoppingList" :key="item.id" class="bg-white rounded-[35px] overflow-hidden shadow-sm relative border border-slate-50">
            <div class="h-32 bg-slate-100 flex items-center justify-center overflow-hidden">
              <img v-if="item.image" :src="item.image" class="w-full h-full object-cover">
              <span v-else class="text-3xl">🎁</span>
            </div>
            <div class="p-4 text-center">
              <h4 class="font-black text-slate-700 truncate text-xs">{{ item.title }}</h4>
              <p class="text-blue-600 font-black text-base leading-none">¥ {{ item.jpy.toLocaleString() }}</p>
            </div>
            <div class="absolute top-4 right-4 flex flex-col gap-2">
              <button @click="deleteDoc(doc(db, 'shopping', item.id))" class="bg-black/30 backdrop-blur-md text-white rounded-full w-7 h-7 text-xs flex items-center justify-center hover:bg-red-500 transition-colors">✕</button>
              <button @click="updateDoc(doc(db, 'shopping', item.id), {bought: !item.bought})" :class="item.bought ? 'bg-green-500 border-green-500 shadow-green-100' : 'bg-white/80 border-white shadow-black/5'" class="backdrop-blur-md rounded-full w-7 h-7 border shadow-lg flex items-center justify-center text-[11px] transition-all">{{ item.bought ? '✓' : '' }}</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <nav class="fixed bottom-10 left-10 right-10 bg-white/90 backdrop-blur-2xl rounded-[45px] shadow-2xl flex justify-around p-4 z-[100] border border-white">
      <button @click="currentTab = 'itinerary'" :class="currentTab === 'itinerary' ? 'text-blue-600 scale-125 bg-blue-50' : 'text-slate-300'" class="transition-all p-3 rounded-3xl text-3xl">📋</button>
      <button @click="currentTab = 'ledger'" :class="currentTab === 'ledger' ? 'text-blue-600 scale-125 bg-blue-50' : 'text-slate-300'" class="transition-all p-3 rounded-3xl text-3xl">💰</button>
      <button @click="currentTab = 'shopping'" :class="currentTab === 'shopping' ? 'text-blue-600 scale-125 bg-blue-50' : 'text-slate-300'" class="transition-all p-3 rounded-3xl text-3xl">🛍️</button>
    </nav>

    <div v-if="isShowModal || isShowExpenseModal || isShowShoppingModal" class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      <div class="absolute inset-0" @click="isShowModal = isShowExpenseModal = isShowShoppingModal = false"></div>
      
      <div v-if="isShowModal" class="relative bg-white rounded-[45px] w-full max-w-sm p-10 animate-pop-in">
        <h3 class="text-2xl font-black text-center mb-8 text-slate-800 tracking-tight">{{ selectedDay === 'pre' ? '準備項目' : '行程規劃' }}</h3>
        <div class="space-y-4">
          <input v-if="selectedDay !== 'pre'" v-model="newEntry.time" type="time" class="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-black text-blue-600 text-lg tabular-nums">
          <input v-model="newEntry.from" :placeholder="selectedDay === 'pre' ? '任務內容' : '地點名稱'" class="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-bold text-slate-700">
        </div>
        <div class="flex gap-4 mt-10">
          <button @click="isShowModal = false" class="flex-1 bg-slate-100 text-slate-400 py-5 rounded-3xl font-black text-sm">取消</button>
          <button @click="saveEntry" class="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black text-sm shadow-xl">確認加入</button>
        </div>
      </div>

      <div v-if="isShowExpenseModal" class="relative bg-white rounded-[45px] w-full max-w-sm p-10 animate-pop-in">
        <h3 class="text-2xl font-black text-center mb-8 text-slate-800 tracking-tight">新增支出紀錄</h3>
        <div class="space-y-4">
          <input v-model="newExpense.title" placeholder="買了什麼？" class="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-bold text-slate-700">
          <input v-model="newExpense.jpy" type="number" placeholder="金額 ¥ (日幣)" class="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-black text-blue-600 text-lg tabular-nums">
          <div class="flex gap-2">
            <button @click="newExpense.payBy = 'cash'" :class="newExpense.payBy === 'cash' ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400'" class="flex-1 py-4 rounded-2xl font-black text-xs transition-all border-none">💵 現金</button>
            <button @click="newExpense.payBy = 'card'" :class="newExpense.payBy === 'card' ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400'" class="flex-1 py-4 rounded-2xl font-black text-xs transition-all border-none">💳 信用卡</button>
          </div>
        </div>
        <div class="flex gap-4 mt-10">
          <button @click="isShowExpenseModal = false" class="flex-1 bg-slate-100 text-slate-400 py-5 rounded-3xl font-black text-sm">取消</button>
          <button @click="saveExpense" class="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black text-sm shadow-xl">同步雲端</button>
        </div>
      </div>

      <div v-if="isShowShoppingModal" class="relative bg-white rounded-[45px] w-full max-w-sm p-10 animate-pop-in">
        <h3 class="text-2xl font-black text-center mb-8 text-slate-800 tracking-tight">新增購物商品</h3>
        <div class="space-y-4">
          <div class="h-32 bg-slate-50 rounded-2xl mb-4 relative flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
            <img v-if="newShoppingItem.image" :src="newShoppingItem.image" class="w-full h-full object-cover">
            <span v-else class="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Upload Photo</span>
            <input type="file" @change="handleImage" class="absolute inset-0 opacity-0 cursor-pointer">
          </div>
          <input v-model="newShoppingItem.title" placeholder="商品名稱" class="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-bold text-slate-700">
          <input v-model="newShoppingItem.jpy" type="number" placeholder="日幣金額 ¥" class="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-black text-blue-600 text-lg tabular-nums">
        </div>
        <div class="flex gap-4 mt-10">
          <button @click="isShowShoppingModal = false" class="flex-1 bg-slate-100 text-slate-400 py-5 rounded-3xl font-black text-sm">取消</button>
          <button @click="saveShoppingItem" class="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black text-sm shadow-xl shadow-blue-200">加入清單</button>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
body { font-family: 'Inter', -apple-system, sans-serif; background: #f8fafc; -webkit-tap-highlight-color: transparent; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.animate-fade-in { animation: fadeIn 0.45s cubic-bezier(0.4, 0, 0.2, 1); }
.animate-pop-in { animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
@keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
button:active { transform: scale(0.95); }
</style>