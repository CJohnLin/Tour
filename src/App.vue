<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from './firebase'
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore'

// --- 1. 基礎狀態 ---
const currentTab = ref('itinerary')
const isShowModal = ref(false)
const isShowExpenseModal = ref(false)
const isShowShoppingModal = ref(false)

// --- 2. 即時匯率 (JPY to TWD) ---
const exchangeRate = ref(0.21)
const fetchExchangeRate = async () => {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY')
    const data = await res.json()
    if (data?.rates?.TWD) exchangeRate.value = data.rates.TWD.toFixed(4)
  } catch (e) { console.error('匯率獲取失敗', e) }
}

// --- 3. Firebase 數據同步邏輯 ---
const itineraryList = ref([])
const expenseList = ref([])
const shoppingList = ref([])

onMounted(() => {
  fetchExchangeRate()

  // 監聽行程
  onSnapshot(query(collection(db, "itinerary"), orderBy("createdAt", "desc")), (snap) => {
    itineraryList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
  // 監聽記帳
  onSnapshot(query(collection(db, "expenses"), orderBy("createdAt", "desc")), (snap) => {
    expenseList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
  // 監聽購物
  onSnapshot(collection(db, "shopping"), (snap) => {
    shoppingList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
})

// --- 4. 功能函數 (Firebase 版) ---

// 行程
const newEntry = ref({ time: '', from: '', to: '', flightNo: '', type: 'flight' })
const saveEntry = async () => {
  await addDoc(collection(db, "itinerary"), { ...newEntry.value, createdAt: new Date() })
  isShowModal.value = false
  newEntry.value = { time: '', from: '', to: '', flightNo: '', type: 'flight' }
}
const deleteItem = async (id) => { if(confirm('確定刪除？')) await deleteDoc(doc(db, "itinerary", id)) }

// 記帳
const newExpense = ref({ title: '', jpy: 0 })
const totalTWD = computed(() => expenseList.value.reduce((sum, i) => sum + Number(i.twd), 0))
const saveExpense = async () => {
  const twd = (newExpense.value.jpy * exchangeRate.value).toFixed(0)
  await addDoc(collection(db, "expenses"), { ...newExpense.value, twd, createdAt: new Date() })
  isShowExpenseModal.value = false
  newExpense.value = { title: '', jpy: 0 }
}
const deleteExpense = async (id) => { await deleteDoc(doc(db, "expenses", id)) }

// 購物 (圖片轉 Base64 存入)
const newShoppingItem = ref({ title: '', jpy: 0, image: '' })
const handleImage = (e) => {
  const reader = new FileReader()
  reader.onload = (ev) => newShoppingItem.value.image = ev.target.result
  reader.readAsDataURL(e.target.files[0])
}
const saveShoppingItem = async () => {
  await addDoc(collection(db, "shopping"), { ...newShoppingItem.value, bought: false })
  isShowShoppingModal.value = false
  newShoppingItem.value = { title: '', jpy: 0, image: '' }
}
const toggleBought = async (item) => { await updateDoc(doc(db, "shopping", item.id), { bought: !item.bought }) }
const deleteShopping = async (id) => { await deleteDoc(doc(db, "shopping", id)) }

</script>

<template>
  <div class="min-h-screen w-full bg-cover bg-center bg-fixed pb-32" style="background-image: url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop');">
    
    <header class="p-6 pt-12 backdrop-blur-sm bg-white/10 flex justify-between items-end text-white">
      <h1 class="text-3xl font-bold drop-shadow-lg">eMenu Tokyo ▲</h1>
      <div class="text-right"><p class="text-[10px] opacity-70">1 JPY ≈</p><span class="text-lg font-bold text-blue-200">{{ exchangeRate }} TWD</span></div>
    </header>

    <main class="p-4 space-y-6">
      <div v-if="currentTab === 'itinerary'" class="space-y-4 animate-fade-in">
        <div class="flex justify-between items-center text-white px-2">
          <h2 class="text-xl font-bold drop-shadow-md">行程安排</h2>
          <button @click="isShowModal = true" class="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-sm">+ 新增</button>
        </div>
        <div v-for="item in itineraryList" :key="item.id">
          <div v-if="item.type === 'flight'" class="bg-gradient-to-br from-blue-600/90 to-indigo-700/90 rounded-[32px] p-6 text-white shadow-xl mb-4">
            <div class="flex justify-between mb-4"><span class="bg-white/20 px-3 py-1 rounded-lg text-xs">{{ item.time }}</span><button @click="deleteItem(item.id)" class="opacity-40">✕</button></div>
            <div class="flex justify-between items-center px-4"><h3 class="text-3xl font-black">{{ item.from }}</h3><span class="text-xl">✈️</span><h3 class="text-3xl font-black">{{ item.to }}</h3></div>
          </div>
          <div v-else class="bg-white/90 rounded-3xl p-5 shadow-lg mb-4 flex justify-between items-center">
             <div class="flex items-center gap-4"><div class="text-2xl">🚆</div><div><p class="text-xs text-blue-500 font-bold">{{ item.time }}</p><h4 class="font-bold text-slate-700">{{ item.from }} → {{ item.to }}</h4></div></div>
             <button @click="deleteItem(item.id)" class="text-slate-300">✕</button>
          </div>
        </div>
      </div>

      <div v-else-if="currentTab === 'ledger'" class="space-y-6 animate-fade-in">
        <div class="bg-gradient-to-br from-indigo-600/90 to-blue-700/90 rounded-[40px] p-8 text-white shadow-2xl text-center">
          <p class="text-xs opacity-80 uppercase tracking-widest mb-1">總支出 (TWD)</p>
          <h2 class="text-5xl font-black mb-2">$ {{ totalTWD.toLocaleString() }}</h2>
        </div>
        <button @click="isShowExpenseModal = true" class="w-full bg-white/30 text-white py-4 rounded-3xl font-bold backdrop-blur-md">+ 新增支出</button>
        <div v-for="item in expenseList" :key="item.id" class="bg-white/90 rounded-3xl p-5 flex justify-between items-center shadow-md">
          <div><p class="font-bold text-slate-700">{{ item.title }}</p><p class="text-[10px] text-slate-400">¥{{ item.jpy }}</p></div>
          <div class="flex items-center gap-4"><span class="text-lg font-black text-blue-600">$ {{ item.twd }}</span><button @click="deleteExpense(item.id)" class="text-slate-300">✕</button></div>
        </div>
      </div>

      <div v-else-if="currentTab === 'shopping'" class="space-y-4 animate-fade-in">
        <div class="flex justify-between items-center text-white px-2">
          <h2 class="text-xl font-bold drop-shadow-md">購物清單</h2>
          <button @click="isShowShoppingModal = true" class="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-sm">+ 新增</button>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div v-for="item in shoppingList" :key="item.id" class="bg-white/90 rounded-[28px] overflow-hidden shadow-lg relative">
            <div class="h-28 bg-slate-200"><img v-if="item.image" :src="item.image" class="w-full h-full object-cover"><div v-else class="h-full flex items-center justify-center text-2xl">🎁</div></div>
            <div class="p-3 text-center"><h4 class="font-bold text-slate-700 truncate text-xs">{{ item.title }}</h4><p class="text-blue-600 font-black text-sm">¥ {{ item.jpy }}</p></div>
            <div class="absolute top-2 right-2 flex flex-col gap-1">
              <button @click="deleteShopping(item.id)" class="bg-black/20 text-white rounded-full w-5 h-5 text-[10px]">✕</button>
              <button @click="toggleBought(item)" :class="item.bought ? 'bg-green-500' : 'bg-white/70'" class="rounded-full w-5 h-5 border flex items-center justify-center text-[10px]">{{ item.bought ? '✓' : '' }}</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <nav class="fixed bottom-8 left-6 right-6 bg-white/80 backdrop-blur-2xl rounded-[40px] shadow-2xl flex justify-around p-4 z-50">
      <button @click="currentTab = 'itinerary'" :class="currentTab === 'itinerary' ? 'scale-125 text-blue-600' : 'text-slate-400'"><span class="text-2xl">🗺️</span></button>
      <button @click="currentTab = 'ledger'" :class="currentTab === 'ledger' ? 'scale-125 text-blue-600' : 'text-slate-400'"><span class="text-2xl">👛</span></button>
      <button @click="currentTab = 'shopping'" :class="currentTab === 'shopping' ? 'scale-125 text-blue-600' : 'text-slate-400'"><span class="text-2xl">🛍️</span></button>
    </nav>

    <div v-if="isShowModal || isShowExpenseModal || isShowShoppingModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="isShowModal = isShowExpenseModal = isShowShoppingModal = false"></div>
      
      <div v-if="isShowModal" class="relative bg-white rounded-[32px] w-full max-w-sm p-8 animate-pop-in">
        <h3 class="text-xl font-bold mb-4 text-center text-slate-800">新增行程</h3>
        <input v-model="newEntry.time" type="time" class="w-full bg-slate-100 rounded-xl p-3 mb-3">
        <div class="flex gap-2 mb-3"><input v-model="newEntry.from" placeholder="從" class="flex-1 bg-slate-100 rounded-xl p-3"><input v-model="newEntry.to" placeholder="到" class="flex-1 bg-slate-100 rounded-xl p-3"></div>
        <select v-model="newEntry.type" class="w-full bg-slate-100 rounded-xl p-3 mb-4"><option value="flight">✈️ 航班樣式</option><option value="train">🚆 交通樣式</option></select>
        <button @click="saveEntry" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg">確認同步</button>
      </div>

      <div v-if="isShowExpenseModal" class="relative bg-white rounded-[32px] w-full max-w-sm p-8 animate-pop-in">
        <h3 class="text-xl font-bold mb-4 text-center text-slate-800">新增支出</h3>
        <input v-model="newExpense.title" placeholder="項目內容" class="w-full bg-slate-100 rounded-xl p-3 mb-3">
        <input v-model="newExpense.jpy" type="number" placeholder="日幣金額 ¥" class="w-full bg-slate-100 rounded-xl p-3 mb-4">
        <button @click="saveExpense" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg">確認同步</button>
      </div>

      <div v-if="isShowShoppingModal" class="relative bg-white rounded-[32px] w-full max-w-sm p-8 animate-pop-in text-center">
        <h3 class="text-xl font-bold mb-4">新增商品</h3>
        <div class="h-28 bg-slate-100 rounded-xl mb-3 relative flex items-center justify-center border-2 border-dashed border-slate-300">
          <img v-if="newShoppingItem.image" :src="newShoppingItem.image" class="w-full h-full object-cover rounded-xl">
          <span v-else class="text-xs text-slate-400">點此上傳照片</span>
          <input type="file" @change="handleImage" class="absolute inset-0 opacity-0 cursor-pointer">
        </div>
        <input v-model="newShoppingItem.title" placeholder="商品名稱" class="w-full bg-slate-100 rounded-xl p-3 mb-3">
        <input v-model="newShoppingItem.jpy" type="number" placeholder="日幣價格 ¥" class="w-full bg-slate-100 rounded-xl p-3 mb-4">
        <button @click="saveShoppingItem" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg">加入雲端</button>
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