# 购物车增强 + 订单簿 + FAB — 设计文档

> 日期: 2026-07-09
> 状态: 已批准设计

## 概述

在现有 LightweightPOS 基础上增强购物车和订单功能：
1. 订单增加**支付方式**（预设列表选择）、**订单号**（每日顺序递增）、**已付/未付**状态
2. **改单**功能：未付订单可修改数量 + 增删品项
3. 购物车开关改为**两个 FAB 按钮**（购物车 / 订单簿），点击弹出对应侧边面板
4. 两个面板互斥（一次只显示一个）

---

## 数据模型变更

### Order 接口更新

```typescript
export interface Order {
  id?: number
  orderNumber: number       // 当日序号（每天从0开始递增）
  paymentMethod: string     // 支付方式（从settings列表选取的快照）
  paid: boolean             // 是否已付款
  paidAt: Date | null       // 付款时间
  createdAt: Date
  totalAmount: number
  totalCost: number
  itemCount: number
}
```

### DB Schema 升级

```
version 1 → version 2
```

新增字段：`orders` 表增加 `orderNumber`（number）、`paymentMethod`（string）、`paid`（number/boolean）、`paidAt`（Date）

### Settings 新增 key

| key | type | 说明 |
|-----|------|------|
| `paymentMethods` | `string[]` | 支付方式列表，默认 `['现金', '微信扫码', '支付宝', '银行卡']` |

### 订单号生成逻辑

```typescript
async function getNextOrderNumber(): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const maxOrder = await db.orders
    .where('createdAt')
    .between(today, tomorrow)
    .last()  // 按主键排序取最后一个

  return maxOrder ? (maxOrder.orderNumber ?? 0) + 1 : 0
}
```

---

## 组件变更

### 新增组件

| 组件 | 说明 |
|------|------|
| `OrderBookSidebar.vue` | 订单簿侧边面板，显示所有订单，可折叠展开 |
| `CheckoutPanel.vue` | 结账确认面板（支付方式选择 + 已付/未付切换）|

### 修改组件

| 组件 | 变更 |
|------|------|
| `App.vue` | 添加 FAB 按钮 + OrderBookSidebar，重构面板显隐逻辑（互斥） |
| `NavBar.vue` | 移除购物车显隐按钮 |
| `CartSidebar.vue` | 结账按钮改为弹出 CheckoutPanel，而非直接确认 |
| `SettingsPage.vue` | 新增「支付方式管理」区块 |

---

## UI / 交互设计

### FAB 按钮

```
┌─────────────────────────────────────────────┐
│ [❖ 品项] [📦 原材料] [📊 今日] [⚙ 设置]    │
├─────────────────────────────────┬───────────┤
│                                 │   侧边面板  │
│  品项 Grid（不变）              │ (Cart 或   │
│                                 │  OrderBook)│
│                                 │            │
│                                 │            │
└─────────────────────────────────┴─────┬─────┘
                                  ┌────┴────┐
                                  │ 🛒  3   │ ← Cart FAB（显示品项数badge）
                                  │ ─────   │
                                  │ 📋  2   │ ← Orders FAB（显示未付订单数badge）
                                  └─────────┘
```

- 固定在右下角，上下排列，间隔 12px
- 每个 FAB 为 56px 圆形按钮，带阴影
- Cart FAB 图标：🛒（或购物车 SVG），badge 显示当前购物车品项总数
- Orders FAB 图标：📋（或剪贴板 SVG），badge 显示未付订单数
- 点击 FAB 切换对应面板显隐（同时关闭另一个面板）
- 点击面板外部或面板关闭按钮也可关闭

### 两个面板互斥逻辑

```
cartVisible = false
orderBookVisible = false

function toggleCart() {
  cartVisible = !cartVisible
  if (cartVisible) orderBookVisible = false
}

function toggleOrderBook() {
  orderBookVisible = !orderBookVisible
  if (orderBookVisible) cartVisible = false
}
```

### 结账流程

```
购物车 → 点击「结账」
  │
  ▼
购物车内容切换到「结账确认」视图
  ├─ 支付方式：下拉选择 ▼（从settings.paymentMethods读取）
  ├─ 付款状态：[○ 未付] [● 已付]（单选按钮，默认未付）
  │
  ├─ [返回] → 回到购物车列表
  └─ [确认结账]
       │
       ▼
     写入 DB（order + orderItems）
     生成 orderNumber（当天最大+1）
     扣减原材料库存
     清空购物车
     关闭面板
```

### 订单簿（OrderBookSidebar）

```
┌─────────────────────────────────────┐
│  订单簿               [× 关闭]      │
├─────────────────────────────────────┤
│  ▼ #8  │  ✅已付  │ 微信  │ ¥120   │
│    鸡排 x3                    ¥60   │
│    饮料 x1                    ¥15   │
│    甜不辣 x2                  ¥45   │
│  ─────────────────────              │
│                                     │
│  ▶ #7  │  ⏳未付  │ 现金  │ ¥80    │
│                                     │
│  ▶ #6  │  ⏳未付  │ 扫码  │ ¥200   │
│                                     │
│  ▼ #5  │  ⏳未付  │ 扫码  │ ¥200   │
│    鸡排 x5                  ¥100   │
│    奶茶 x2                   ¥40   │
│    薯条 x3                   ¥60   │
│  ─────────────────────              │
│  [改单]                 [标记已付]  │
└─────────────────────────────────────┘
```

- 按创建时间倒序（最新在上）
- 每行头部可点击折叠/展开
- **已付订单**：绿色 ✅ 标签，展开后只读，无操作按钮
- **未付订单**：黄色 ⏳ 标签，展开后显示 `[改单]` 和 `[标记已付]`
- 标记已付 → 设置 `paid=true`, `paidAt=now`，重新渲染

### 改单流程

在订单簿中点击未付订单的 `[改单]` → 该订单进入编辑模式：

```
┌─────────────────────────────────────┐
│  ▶ #5（编辑中）                      │
│    鸡排    [-] 5 [+]        [×删除] │
│    奶茶    [-] 2 [+]        [×删除] │
│    薯条    [-] 3 [+]        [×删除] │
│  [+ 添加品项] 下拉选择 ▼            │
│  ─────────────────────              │
│  总计: ¥200                         │
│                                     │
│  [取消修改]              [保存修改]  │
└─────────────────────────────────────┘
```

- 修改数量：+/- 按钮，数量为0时自动删除该品项
- 删除品项：× 按钮直接移除
- 添加品项：从全部品项/套餐列表中选择，添加到订单
- 保存：更新 `db.orderItems`（全删重建），重新计算 `totalAmount/totalCost/itemCount`，更新 `db.orders`
- 取消：恢复原始状态

---

## 设置页变更

设置页新增「支付方式管理」区块：

```
┌──────────────────────────────────┐
│  支付方式管理                      │
│  ┌────────────────────────────┐  │
│  │ 现金                    [×]│  │
│  │ 微信扫码                [×]│  │
│  │ 支付宝                  [×]│  │
│  │ 银行卡                  [×]│  │
│  └────────────────────────────┘  │
│  [输入框]            [+ 添加]   │
└──────────────────────────────────┘
```

- 数据存储在 `settings` 表的 `paymentMethods` key 下
- 默认值：`['现金', '微信扫码', '支付宝', '银行卡']`
- 删除支付方式不影响已有订单的记录（订单存的是文字快照）

---

## 国际化新增文案

### zh-CN.ts / en.ts 新增

| key | zh-CN | en |
|-----|-------|----|
| `cart.paymentMethod` | 支付方式 | Payment Method |
| `cart.payStatus` | 付款状态 | Payment Status |
| `cart.paid` | 已付 | Paid |
| `cart.unpaid` | 未付 | Unpaid |
| `cart.checkoutConfirm` | 确认结账 | Confirm Checkout |
| `orderBook.title` | 订单簿 | Orders |
| `orderBook.empty` | 暂无订单 | No orders |
| `orderBook.modify` | 改单 | Modify |
| `orderBook.markPaid` | 标记已付 | Mark Paid |
| `orderBook.addItem` | 添加品项 | Add Item |
| `orderBook.saveChanges` | 保存修改 | Save Changes |
| `orderBook.cancelEdit` | 取消修改 | Cancel Edit |
| `orderBook.paidAt` | 已付 | Paid |
| `orderBook.unpaid` | 未付 | Unpaid |
| `settings.paymentMethods` | 支付方式管理 | Payment Methods |
| `settings.addPaymentMethod` | 添加支付方式 | Add Method |
| `fab.cart` | 购物车 | Cart |
| `fab.orders` | 订单簿 | Orders |

---

## 不涉及变更

- ItemsPage、MaterialsPage、SalesPage 的核心逻辑不变
- 原材料成本计算逻辑不变
- 导出功能不变（sales页面仍可查看已付/未付订单数据）
- 路由不变
