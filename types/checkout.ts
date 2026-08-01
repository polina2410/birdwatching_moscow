export type CheckoutErrorCode = 'CART_EMPTY' | 'CART_EXPIRED' | 'CAPACITY_EXCEEDED'

export interface WalkSnapshot {
  id: string
  title: string
  priceKopecks: number
  capacity: number
}

export interface CreatedOrder {
  id: string
  totalKopecks: number
}

export interface OrderLineItem {
  walkId: string
  title: string
  quantity: number
  unitPriceKopecks: number
}
