<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
    <!-- 1. 週期性主動收入 -->
    <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
      <div class="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
            <span>💵 週期性主動收入</span>
            <span class="text-xs font-mono text-emerald-400">
              +{{ store.formatMoney(activeIncomeTotal) }} /月
            </span>
          </div>
        </div>
        <button
          @click="openAddIncome"
          class="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition flex items-center gap-1 shadow-sm"
        >
          <span>＋</span>
          <span>新增收入</span>
        </button>
      </div>

      <div class="divide-y divide-white/5 mt-1">
        <div
          v-for="(item, idx) in store.recurringIncomes"
          :key="item.id || idx"
          class="py-3 flex items-center justify-between text-xs"
        >
          <div>
            <div class="font-bold text-white text-sm">{{ item.name }}</div>
            <div class="text-[11px] text-zinc-500 mt-0.5">{{ item.category || '固定薪資' }}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-mono font-bold text-base text-emerald-400">
              +{{ store.formatMoney(item.amount) }}
            </span>
            <div class="inline-flex items-center gap-1.5 ml-1">
              <button
                @click="openEditIncome(item, idx)"
                class="min-h-[34px] px-2.5 py-1 text-zinc-300 hover:text-white bg-white/5 rounded-lg border border-white/5"
              >
                編輯
              </button>
              <button
                @click="removeIncome(idx)"
                class="min-h-[34px] px-2.5 py-1 text-rose-400 hover:bg-rose-500/10 rounded-lg"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
        <div v-if="store.recurringIncomes.length === 0" class="py-6 text-center text-xs text-zinc-500">
          尚無固定主動收入，點擊上方按鈕新增
        </div>
      </div>
    </div>

    <!-- 2. 週期性固定支出 (排除貸款) -->
    <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
      <div class="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
            <span>🛒 週期性生活支出</span>
            <span class="text-xs font-mono text-rose-400">
              -{{ store.formatMoney(livingExpenseTotal) }} /月
            </span>
          </div>
        </div>
        <button
          @click="openAddExpense"
          class="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition flex items-center gap-1 shadow-sm"
        >
          <span>＋</span>
          <span>新增支出</span>
        </button>
      </div>

      <div class="divide-y divide-white/5 mt-1">
        <div
          v-for="(item, idx) in store.recurringExpenses"
          :key="item.id || idx"
          class="py-3 flex items-center justify-between text-xs"
        >
          <div>
            <div class="font-bold text-white text-sm">{{ item.name }}</div>
            <div class="text-[11px] text-zinc-500 mt-0.5">{{ item.category || '生活開銷' }}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-mono font-bold text-base text-rose-400">
              -{{ store.formatMoney(item.amount) }}
            </span>
            <div class="inline-flex items-center gap-1.5 ml-1">
              <button
                @click="openEditExpense(item, idx)"
                class="min-h-[34px] px-2.5 py-1 text-zinc-300 hover:text-white bg-white/5 rounded-lg border border-white/5"
              >
                編輯
              </button>
              <button
                @click="removeExpense(idx)"
                class="min-h-[34px] px-2.5 py-1 text-rose-400 hover:bg-rose-500/10 rounded-lg"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
        <div v-if="store.recurringExpenses.length === 0" class="py-6 text-center text-xs text-zinc-500">
          尚無固定生活開銷項目，點擊上方按鈕新增
        </div>
      </div>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="cashflow"
      :is-editing="isEditing"
      :edit-item="currentItem"
      :edit-index="currentIndex"
      @close="modalOpen = false"
      @save="handleSave"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useFinancialStore } from '../stores/useFinancialStore';
import AssetEditorModal from './AssetEditorModal.vue';

const store = useFinancialStore();

const modalOpen = ref(false);
const isEditing = ref(false);
const currentItem = ref(null);
const currentIndex = ref(-1);

const activeIncomeTotal = computed(() => {
  return store.recurringIncomes.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
});

const livingExpenseTotal = computed(() => {
  return store.recurringExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
});

function openAddIncome() {
  isEditing.value = false;
  currentItem.value = {
    flowType: 'income',
    name: '主業月薪',
    amount: 50000,
  };
  currentIndex.value = -1;
  modalOpen.value = true;
}

function openEditIncome(item, index) {
  isEditing.value = true;
  currentItem.value = { ...item, flowType: 'income' };
  currentIndex.value = index;
  modalOpen.value = true;
}

function openAddExpense() {
  isEditing.value = false;
  currentItem.value = {
    flowType: 'expense',
    name: '生活固定支出',
    amount: 20000,
  };
  currentIndex.value = -1;
  modalOpen.value = true;
}

function openEditExpense(item, index) {
  isEditing.value = true;
  currentItem.value = { ...item, flowType: 'expense' };
  currentIndex.value = index;
  modalOpen.value = true;
}

function handleSave({ isEditing: editing, index, data }) {
  if (!data) return;
  const nowTs = Date.now();
  if (data.flowType === 'income') {
    if (editing && index >= 0) {
      store.recurringIncomes[index] = { ...store.recurringIncomes[index], ...data, updatedAt: nowTs };
    } else {
      store.recurringIncomes.push({
        id: 'ri_' + nowTs,
        ...data,
        updatedAt: nowTs,
      });
    }
  } else {
    if (editing && index >= 0) {
      store.recurringExpenses[index] = { ...store.recurringExpenses[index], ...data, updatedAt: nowTs };
    } else {
      store.recurringExpenses.push({
        id: 're_' + nowTs,
        ...data,
        updatedAt: nowTs,
      });
    }
  }
  store.triggerAutoSave();
}

function removeIncome(index) {
  store.markRecordDeleted(store.recurringIncomes[index]);
  store.recurringIncomes.splice(index, 1);
  store.triggerAutoSave();
}

function removeExpense(index) {
  store.markRecordDeleted(store.recurringExpenses[index]);
  store.recurringExpenses.splice(index, 1);
  store.triggerAutoSave();
}
</script>
