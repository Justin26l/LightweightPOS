# 离线订单系统 — 设计文档

> 日期: 2026-06-28
> 状态: 已批准设计

## 概述

小型离线 PWA 订单系统，用于店铺记录品项销售并总结每日营收。横屏优化、大按钮操作、购物车模式。

### 技术栈

- Vue 3 + TypeScript
- Tailwind CSS
- Dexie.js (IndexedDB 封装)
- Vite + vite-plugin-pwa
- xlsx (SheetJS) 导出 XLSX/CSV
- hash 路由（vue-router hash mode）
- vue-i18n（中英双语国际化）

---

## 路由与导航

```
[❖ 品项]  [📦 原材料]  [📊 今日销售]  [⚙ 设置]
```

| 路由 | 页面 | 说明 |
|------|------|------|
| `#/items` | 品项 grid + 购物车 | 默认页，含套餐分组 + 编辑模式 |
| `#/materials` | 原材料管理 | 原材料 CRUD + 入库调整 |
| `#/sales` | 今日销售 + 导出 | 按日汇总 + 导出 XLSX/CSV |
| `#/settings` | 设置 | 店名、货币符号、分组管理、数据管理 |

---

## 页面布局（横屏）

### 品项页（默认）

```
┌───────────────────────────────────────────────────┐
│ [❖ 品项] [📦 原材料] [📊 今日] [⚙ 设置]  店名 ¥ ◀│
├───────────────────────────────┬───────────────────┤
│ [+ 品项] [+ 套餐] [+ 分组]    │  购物车侧边栏      │
│ ───────── (编辑模式) ──────── │  (默认显示)        │
│                               │                   │
│ ⊞ 套餐                        │  [品项] ×数量     │
│ ─────────                      │  小计: ¥xx       │
│ [套餐名 ¥xx 剩N份]            │                   │
│                               │  ...              │
│ 分组名                         │  ─── 总计 ───     │
│ ─────────                      │  销售额 ¥xxx     │
│ [品项名 ¥xx 剩N份]            │  总成本 ¥xxx     │
│ [品项名 ¥xx ⚠库存不足]       │  利润   ¥xxx     │
│                               │                   │
│ 分组名2                        │  [清空] [结账]    │
│ ─────────                      │  (底部固定大按钮) │
│ [品项名 ¥xx 剩N份]            │                   │
└───────────────────────────────┴───────────────────┘
```

- 左侧区域品项 grid，按分组排列，分组名 + 分隔线
- 右侧购物车侧边栏默认显示，可通过导航栏 ◀ ▶ 切换显隐
- 滑入/滑出动画（购物车）
- 编辑模式：背景变浅黄色，顶部出现添加操作栏

### 原材料页

```
┌───────────────────────────────────────────────────┐
│ [❖ 品项] [📦 原材料] [📊 今日] [⚙ 设置]         │
├───────────────────────────────────────────────────┤
│ [+ 原材料]                                        │
│ ───────────────────────────────────────────────── │
│                                                    │
│ ┌────────────────┐ ┌────────────────┐              │
│ │ 鸡排            │ │ 面粉            │              │
│ │ 库存: 50 个     │ │ 库存: 2000 g    │              │
│ │ 单位成本: ¥2.0  │ │ 单位成本: ¥0.5  │              │
│ │ 预警线: 20个    │ │ 预警线: 500g    │              │
│ │ [入库调整] [编辑]│ │ [入库调整] [编辑]│              │
│ └────────────────┘ └────────────────┘              │
└───────────────────────────────────────────────────┘
```

### 今日销售页

```
┌───────────────────────────────────────────────────┐
│ [❖ 品项] [📦 原材料] [📊 今日] [⚙ 设置]         │
├───────────────────────────────────────────────────┤
│  📅 2026-06-28                                    │
│                                                    │
│  总销售额: ¥1,250    总成本: ¥380    利润: ¥870    │
│  订单数: 23          品项数: 12                    │
│                                                    │
│  按品项汇总:                                       │
│  ─────────────────────────────────────────────    │
│  原味鸡排 x45          ¥675   成本 ¥180  利润 ¥495 │
│  甜不辣   x30          ¥300   成本 ¥90   利润 ¥210 │
│  ...                                               │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐               │
│  │  导出 XLSX    │  │  导出 CSV    │               │
│  └──────────────┘  └──────────────┘               │
└───────────────────────────────────────────────────┘
```

### 设置页

```
┌───────────────────────────────────────────────────┐
│ [❖ 品项] [📦 原材料] [📊 今日] [⚙ 设置]          │
├───────────────────────────────────────────────────┤
│  店铺名称: [输入框]                                │
│  货币符号: [¥ / $ / NT$ / 自定义]                 │
│  语言: [中文 / English]                           │
│                                                    │
│  分组管理:                                         │
│  炸物 [删除]  饮料 [删除]  主食 [删除]             │
│                                                    │
│  数据管理:                                         │
│  [导出数据库备份]  [清空所有数据]                   │
└───────────────────────────────────────────────────┘
```

---

## 数据模型

### IndexedDB 表结构（Dexie.js）

#### `items` — 品项

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| name | string | 品项名称 |
| price | number | 售价 |
| minQty | number | 起售量（默认 1） |
| groupName | string | 分组标签 |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

> 注意：品项不直接记录成本价，成本由配方（item_materials）自动计算。

#### `combos` — 套餐

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| name | string | 套餐名称 |
| price | number | 套餐售价 |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

#### `combo_items` — 套餐品项清单

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| comboId | number | 套餐 ID |
| itemId | number | 品项 ID |
| qty | number | 该品项在套餐中的数量 |

#### `raw_materials` — 原材料

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| name | string | 原材料名称 |
| unit | string | 单位（个/g/ml/包等） |
| unitCost | number | 单位成本 |
| currentStock | number | 当前库存量 |
| alertThreshold | number | 库存预警线（低于此值显示警告） |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

#### `item_materials` — 品项用料配方

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| itemId | number | 品项 ID |
| materialId | number | 原材料 ID |
| amount | number | 用量（按原材料的单位） |

#### `orders` — 订单

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| createdAt | Date | 下单时间 |
| totalAmount | number | 总销售额 |
| totalCost | number | 总成本 |
| itemCount | number | 品项总件数 |

#### `order_items` — 订单明细

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number (autoIncrement) | 主键 |
| orderId | number | 所属订单 ID |
| type | string | 'item' 或 'combo' |
| refId | number | 品项/套餐 ID |
| name | string | 快照名称 |
| qty | number | 数量 |
| unitPrice | number | 快照单价 |
| unitCost | number | 快照单位成本 |

#### `settings` — 设置

| 字段 | 类型 | 说明 |
|------|------|------|
| key | string (主键) | 设置键名 |
| value | any | 设置值 |

预置 key: `storeName`, `currencySymbol`, `locale`

---

## 国际化 (i18n)

### 策略

- 使用 vue-i18n 的 `legacy: false` 模式（Composition API）
- 默认语言根据浏览器 `navigator.language` 自动检测（zh → 中文，其余 → English）
- 语言偏好保存在 `settings` 表中（key: `locale`）
- 设置页提供语言切换开关

### 语言文件结构

```
src/locales/
├── zh-CN.ts        # 中文
├── en.ts           # 英文
└── index.ts        # 导出 & 自动检测逻辑
```

### 覆盖范围

所有 UI 文本均需国际化：
- 导航标签（品项、原材料、今日销售、设置）
- 页面标题和按钮文本
- 表单标签和验证提示
- 购物车操作（结账、清空、编辑、入库调整）
- 库存状态提示（"库存不足" / "Low Stock" 等）
- 导出文件表头
- 设置页标签
- 确认弹窗文本

> 用户自主输入的数据（品项名称、分组标签、原材料名称等）**不翻译**，仅 UI 框架文本走 i18n。

---

## 自动计算逻辑

### 品项单位成本

```
item.unitCost = Σ(raw_material.unitCost × item_material.amount) × minQty
```

遍历品项的所有 `item_materials` 关联，累加 `原材料单位成本 × 配方用量` 得到**单个的单位成本**，再乘以 `minQty` 得到**一份（起售单位）的成本**。

### 品项库存

```
availableUnits = MIN(raw_material.currentStock ÷ item_material.amount)
item.stock     = FLOOR(availableUnits ÷ minQty)
```

`availableUnits` = 最紧缺原材料能做出的**个体数量**，再除以 `minQty` 得到**可售份数**。向下取整。库存为 0 时品项在 grid 上禁用点击。

> 例：原材料鸡排有 50 个，原味鸡排每份用 1 个鸡排，minQty=3 → availableUnits = 50, stock = 16 份

### 套餐成本与库存

```
combo.cost    = Σ(item.unitCost × combo_item.qty)
combo.stock   = MIN(item.stock ÷ combo_item.qty)
```

套餐库存由内含品项的最紧缺比例决定。

### 结账时库存扣减

```
item → 扣减: 每个关联 raw_material.currentStock -= item_material.amount × soldQty
combo → 先展开为品项, 再按品项扣减
```

---

## 组件树

```
App.vue
├── NavBar.vue
│   ├── NavTab.vue
│   └── CartToggleButton.vue
├── RouterView
│   ├── ItemsPage.vue          ← #/items
│   │   ├── EditModeBar.vue    (编辑模式时显示)
│   │   ├── ItemGrid.vue
│   │   │   ├── GroupSection.vue
│   │   │   │   ├── GroupHeader.vue
│   │   │   │   ├── ItemCard.vue
│   │   │   │   └── ComboCard.vue  (套餐分组)
│   │   ├── ItemFormModal.vue
│   │   └── ComboFormModal.vue
│   ├── MaterialsPage.vue      ← #/materials
│   │   ├── MaterialCard.vue
│   │   ├── MaterialFormModal.vue
│   │   └── StockAdjustModal.vue
│   ├── SalesPage.vue          ← #/sales
│   │   ├── SalesSummary.vue
│   │   └── SalesDetailTable.vue
│   └── SettingsPage.vue       ← #/settings
│       ├── StoreSettings.vue
│       ├── GroupManager.vue
│       └── DataManager.vue
└── CartSidebar.vue            ← 全局侧边栏
    ├── CartItemList.vue
    │   ├── CartItem.vue
    │   └── CartCombo.vue
    └── CartFooter.vue
        ├── CartSummary.vue
        └── CartActions.vue
```

---

## 关键交互流程

### 购物车流程

1. 用户点击 ItemCard / ComboCard → 品项/套餐加入购物车
2. 购物车侧边栏滑入显示（若隐藏则自动滑入）
3. 同一品项再次点击 → 数量 +1（按起售量步进）
4. 购物车内可调整数量（大 +/- 按钮）/ 删除单行
5. 底部总计实时更新（销售额、总成本、利润）
6. 点击「结账」→ 确认弹窗 → 写入 order + order_items → 扣原材料库存 → 清空购物车
7. 点击「清空」→ 清空购物车

### 编辑模式

1. 点击「✏ 编辑模式」开关 → 背景变浅黄
2. Grid 上方显示：`[+ 品项] [+ 套餐] [+ 分组]`
3. 品项/套餐卡片右下角出现编辑/删除图标
4. 点击添加 → 弹 modal 表单
5. 再次点击「✏ 编辑模式」→ 恢复正常模式

### 原材料入库调整

1. 在原材料页面点击「入库调整」
2. 弹窗显示当前库存，输入调整数量（正数入库，负数出库）
3. 确认后更新 currentStock

---

## PWA 策略

- **Service Worker**: vite-plugin-pwa 自动生成，cache-first 策略
- **离线存储**: 所有数据在 IndexedDB，完全离线可用
- **安装提示**: 配置 manifest（应用名称、图标、主题色）
- **更新策略**: SW 更新时提示用户刷新

---

## 导出格式

### XLSX/CSV 导出内容

| 列 | 说明 |
|----|------|
| 品项名称 |  |
| 数量 | 当日总销量 |
| 销售额 | 数量 × 售价 |
| 单位成本 | 自动计算 |
| 总成本 | 数量 × 单位成本 |
| 利润 | 销售额 - 总成本 |
| 销售时间 | 每笔订单时间 |

底部汇总行：总销售额、总成本、总利润。

---

## 非功能性需求

- 横屏优先，1024px+ 最佳体验
- 大按钮（最小 48px touch target）
- 离线可用（PWA）
- 打开即用，无需登录
- 数据本地存储，不发送网络
