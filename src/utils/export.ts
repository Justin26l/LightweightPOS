import * as XLSX from 'xlsx'
import type { Order, OrderItem } from '../types'

interface ExportRow {
  name: string
  qty: number
  revenue: number
  unitCost: number
  totalCost: number
  profit: number
  time?: string
}

function buildRows(orderItems: (OrderItem & { orderTime?: string })[]): ExportRow[] {
  // Aggregate by item name
  const map = new Map<string, { qty: number; revenue: number; unitCost: number; totalCost: number }>()
  for (const oi of orderItems) {
    const existing = map.get(oi.name)
    if (existing) {
      existing.qty += oi.qty
      existing.revenue += oi.unitPrice * oi.qty
      existing.totalCost += oi.unitCost * oi.qty
    } else {
      map.set(oi.name, {
        qty: oi.qty,
        revenue: oi.unitPrice * oi.qty,
        unitCost: oi.unitCost,
        totalCost: oi.unitCost * oi.qty,
      })
    }
  }
  return [...map.entries()].map(([name, data]) => ({
    name,
    ...data,
    profit: data.revenue - data.totalCost,
  }))
}

export function exportToXlsx(
  orderItems: (OrderItem & { orderTime?: string })[],
  storeName: string,
  currencySymbol: string,
  dateStr: string
) {
  const rows = buildRows(orderItems)
  const totals = {
    name: 'TOTAL',
    qty: rows.reduce((s, r) => s + r.qty, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    unitCost: 0,
    totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
    profit: rows.reduce((s, r) => s + r.profit, 0),
  }

  const wsData = [
    [storeName],
    [`Sales Report - ${dateStr}`],
    [],
    ['Item', 'Qty', 'Revenue', 'Unit Cost', 'Total Cost', 'Profit'],
    ...rows.map(r => [r.name, r.qty, r.revenue, r.unitCost, r.totalCost, r.profit]),
    [],
    ['TOTAL', totals.qty, totals.revenue, '', totals.totalCost, totals.profit],
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sales')
  XLSX.writeFile(wb, `sales-${dateStr}.xlsx`)
}

export function exportToCsv(
  orderItems: (OrderItem & { orderTime?: string })[],
  storeName: string,
  dateStr: string
) {
  const rows = buildRows(orderItems)
  const csvRows = [
    `${storeName}`,
    `Sales Report - ${dateStr}`,
    '',
    'Item,Qty,Revenue,Unit Cost,Total Cost,Profit',
    ...rows.map(r => `${r.name},${r.qty},${r.revenue},${r.unitCost},${r.totalCost},${r.profit}`),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-${dateStr}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
